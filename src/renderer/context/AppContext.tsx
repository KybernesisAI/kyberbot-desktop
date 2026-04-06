/**
 * App-wide context: multi-agent aware.
 *
 * Health and status are polled per-agent via IPC (not event-driven).
 * This eliminates flickering from cross-agent event interference.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { HealthData } from '../../types/ipc';

export interface FleetAgentInfo {
  name: string;
  root: string;
  port: number;
  description: string;
  registered: string;
  running: boolean;
}

export interface FleetStatusData {
  mode: 'fleet';
  agents: Array<{
    name: string;
    status: string;
    uptime?: string;
    services?: Array<{ name: string; status: string }>;
    channels?: Array<{ name: string; connected: boolean }>;
    pid?: number;
  }>;
  sleep?: { current_agent: string | null; last_run: string | null };
  uptime: string;
  pid: number;
}

interface AppContextValue {
  agentRoot: string | null;
  apiToken: string | null;
  serverUrl: string;
  baseServerUrl: string;
  health: HealthData | null;
  cliStatus: string;
  isReady: boolean;
  serverReady: boolean;

  // Multi-agent
  fleetMode: boolean;
  agents: FleetAgentInfo[];
  activeAgent: string | null;
  setActiveAgent: (name: string) => void;
  fleetStatus: FleetStatusData | null;
  runningAgentRoot: string | null;
}

const AppContext = createContext<AppContextValue>({
  agentRoot: null, apiToken: null,
  serverUrl: 'http://localhost:3456', baseServerUrl: 'http://localhost:3456',
  health: null, cliStatus: 'stopped', isReady: false, serverReady: false,
  fleetMode: false, agents: [], activeAgent: null,
  setActiveAgent: () => {}, fleetStatus: null, runningAgentRoot: null,
});

export function useApp(): AppContextValue {
  return useContext(AppContext);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [agentRoot, setAgentRoot] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [baseServerUrl, setBaseServerUrl] = useState('http://localhost:3456');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [cliStatus, setCliStatus] = useState('stopped');
  const [isReady, setIsReady] = useState(false);
  const [serverReady, setServerReady] = useState(false);

  const [agents, setAgents] = useState<FleetAgentInfo[]>([]);
  const [activeAgent, setActiveAgentState] = useState<string | null>(null);
  const [fleetStatus, setFleetStatus] = useState<FleetStatusData | null>(null);
  const [runningAgentRoot, setRunningAgentRoot] = useState<string | null>(null);

  const fleetMode = fleetStatus !== null;

  const serverUrl = fleetMode && activeAgent
    ? `${baseServerUrl}/agent/${encodeURIComponent(activeAgent)}`
    : baseServerUrl;

  // Switch active agent — no reload
  const setActiveAgent = useCallback((name: string) => {
    const kb = (window as any).kyberbot;
    if (!kb) return;
    const agent = agents.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (!agent) return;

    setActiveAgentState(name);
    kb.config.setAgentRoot(agent.root).then(() => {
      setAgentRoot(agent.root);
      kb.config.getServerUrl().then((url: string) => {
        if (!fleetMode) setBaseServerUrl(url);
      });
      kb.config.getApiToken().then((token: string | null) => {
        if (token) setApiToken(token);
      });
    });
  }, [agents, fleetMode]);

  // ── Init ──
  useEffect(() => {
    const kb = (window as any).kyberbot;
    if (!kb) return;

    const init = async () => {
      const root = await kb.config.getAgentRoot();
      setAgentRoot(root);

      if (root) {
        const [token, url] = await Promise.all([
          kb.config.getApiToken(),
          kb.config.getServerUrl(),
        ]);
        setApiToken(token);
        setBaseServerUrl(url);
      }

      // Check fleet
      try {
        const fleetResult = await kb.fleet.getStatus();
        if (fleetResult.fleetMode && fleetResult.fleet) {
          setFleetStatus(fleetResult.fleet);
        }
      } catch {}

      // Load agents
      try {
        const registeredAgents = await kb.fleet.list();
        setAgents(registeredAgents);
        if (root) {
          const current = registeredAgents.find((a: FleetAgentInfo) => a.root === root);
          if (current) setActiveAgentState(current.name);
        }
      } catch {}

      setIsReady(true);
    };
    init();
  }, []);

  // ── Poll viewed agent's state every 3 seconds ──
  useEffect(() => {
    const kb = (window as any).kyberbot;
    if (!kb || !agentRoot || !isReady) return;

    const poll = async () => {
      try {
        const state = await kb.services.getAgentState(agentRoot);
        setCliStatus(state.status || 'stopped');
        setHealth(state.health || null);
        setServerReady(state.isRunning || false);

        // If this agent just became running, re-read token
        if (state.isRunning && !serverReady) {
          const token = await kb.config.getApiToken();
          if (token) setApiToken(token);
        }
      } catch {
        setCliStatus('stopped');
        setHealth(null);
        setServerReady(false);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [agentRoot, isReady]);

  // ── Poll fleet status (when in fleet mode) ──
  useEffect(() => {
    const kb = (window as any).kyberbot;
    if (!kb || !isReady) return;

    const poll = async () => {
      try {
        const result = await kb.fleet.getStatus();
        if (result.fleetMode && result.fleet) {
          setFleetStatus(result.fleet);
        } else {
          setFleetStatus(null);
        }
      } catch {
        setFleetStatus(null);
      }
    };

    // Only poll if we think fleet might be running
    if (fleetStatus) {
      const interval = setInterval(poll, 5000);
      return () => clearInterval(interval);
    }
  }, [isReady, fleetStatus !== null]);

  // ── Update agent running indicators (for dropdown) ──
  useEffect(() => {
    const kb = (window as any).kyberbot;
    if (!kb || !isReady || agents.length === 0) return;

    const updateRunning = async () => {
      const updated = await Promise.all(agents.map(async (a) => {
        try {
          const state = await kb.services.getAgentState(a.root);
          return { ...a, running: state.isRunning };
        } catch {
          return { ...a, running: false };
        }
      }));
      setAgents(updated);

      // Find any running agent root for the dropdown indicator
      const anyRunning = updated.find(a => a.running);
      setRunningAgentRoot(anyRunning?.root || null);
    };

    updateRunning();
    const interval = setInterval(updateRunning, 5000);
    return () => clearInterval(interval);
  }, [isReady, agents.length]);

  return (
    <AppContext.Provider value={{
      agentRoot, apiToken, serverUrl, baseServerUrl, health,
      cliStatus, isReady, serverReady,
      fleetMode, agents, activeAgent, setActiveAgent, fleetStatus,
      runningAgentRoot,
    }}>
      {children}
    </AppContext.Provider>
  );
}
