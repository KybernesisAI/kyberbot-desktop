/**
 * App-wide context: API token, server URL, health state, agent root.
 * Delays API readiness until the first successful health update
 * to avoid race condition errors in the server log.
 *
 * Phase 4D: Multi-agent fleet state. When fleetMode is true, serverUrl
 * routes through /agent/{activeAgent} and switching agents is instant
 * (no page reload).
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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
  baseServerUrl: string;  // base URL without /agent/{name} suffix — for fleet-level endpoints
  health: HealthData | null;
  cliStatus: string;
  isReady: boolean;       // config loaded (agent root, token)
  serverReady: boolean;   // server is up and responding to health checks

  // Fleet state
  fleetMode: boolean;
  agents: FleetAgentInfo[];
  activeAgent: string | null;
  setActiveAgent: (name: string) => void;
  fleetStatus: FleetStatusData | null;
}

const AppContext = createContext<AppContextValue>({
  agentRoot: null,
  apiToken: null,
  serverUrl: 'http://localhost:3456',
  baseServerUrl: 'http://localhost:3456',
  health: null,
  cliStatus: 'stopped',
  isReady: false,
  serverReady: false,
  fleetMode: false,
  agents: [],
  activeAgent: null,
  setActiveAgent: () => {},
  fleetStatus: null,
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

  // Fleet state
  const [agents, setAgents] = useState<FleetAgentInfo[]>([]);
  const [activeAgent, setActiveAgentState] = useState<string | null>(null);
  const [fleetStatus, setFleetStatus] = useState<FleetStatusData | null>(null);

  // Fleet mode is derived — true only when fleet server is confirmed running
  const fleetMode = fleetStatus !== null;

  // Compute effective serverUrl — only route through /agent/{name} when fleet is running
  const serverUrl = fleetMode && activeAgent
    ? `${baseServerUrl}/agent/${encodeURIComponent(activeAgent)}`
    : baseServerUrl;

  const setActiveAgent = useCallback((name: string) => {
    setActiveAgentState(name);

    // Find the agent's root and read its token
    const kb = (window as any).kyberbot;
    if (!kb) return;

    const agent = agents.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (agent) {
      // In fleet mode, update the agent root so config reads the right .env
      kb.config.setAgentRoot(agent.root).then(() => {
        setAgentRoot(agent.root);
        kb.config.getApiToken().then((token: string | null) => {
          if (token) setApiToken(token);
        });
      });
    }
  }, [agents]);

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

      // Check fleet status — if fleet server is running, set fleetStatus (which derives fleetMode)
      try {
        const fleetResult = await kb.fleet.getStatus();
        if (fleetResult.fleetMode && fleetResult.fleet) {
          setFleetStatus(fleetResult.fleet);
        }
      } catch {
        // Fleet not available, stay in single-agent mode
      }

      // Load registered agents to detect multi-agent setup
      try {
        const registeredAgents = await kb.fleet.list();
        setAgents(registeredAgents);

        // If 2+ agents registered and no active agent set, default to current
        if (registeredAgents.length >= 2 && root) {
          const currentAgent = registeredAgents.find((a: FleetAgentInfo) => a.root === root);
          if (currentAgent) {
            setActiveAgentState(currentAgent.name);
          }
        }
      } catch {
        // Fleet list not available
      }

      // Just get lifecycle status — don't make any HTTP calls yet
      const { status } = await kb.services.getStatus();
      setCliStatus(status);
      setIsReady(true);
    };
    init();

    // Subscribe to health updates — first successful one marks server as ready
    const unsubHealth = kb.services.onHealthUpdate((h: HealthData) => {
      setHealth(h);
      if (h.status !== 'offline') {
        setCliStatus('running');
        // Re-read token on first health update in case it wasn't available before
        if (!serverReady) {
          kb.config.getApiToken().then((token: string | null) => {
            if (token) setApiToken(token);
            setServerReady(true);
          });
        }
      } else {
        setCliStatus('stopped');
        setServerReady(false);
      }
    });

    const unsubStatus = kb.services.onStatusChange((status: string) => {
      setCliStatus(status);
      if (status === 'stopped' || status === 'crashed') {
        setHealth(null);
        setServerReady(false);
        setFleetStatus(null);
      }
    });

    // Subscribe to fleet status updates
    const unsubFleet = kb.fleet?.onStatusUpdate?.((fleet: FleetStatusData) => {
      setFleetStatus(fleet);

      // Update agent running states from fleet data
      setAgents(prev => prev.map(agent => {
        const fleetAgent = fleet.agents.find(
          fa => fa.name.toLowerCase() === agent.name.toLowerCase()
        );
        return fleetAgent
          ? { ...agent, running: fleetAgent.status === 'running' }
          : agent;
      }));
    }) ?? (() => {});

    return () => {
      unsubHealth();
      unsubStatus();
      unsubFleet();
    };
  }, []);

  return (
    <AppContext.Provider value={{
      agentRoot, apiToken, serverUrl, baseServerUrl, health, cliStatus, isReady, serverReady,
      fleetMode, agents, activeAgent, setActiveAgent, fleetStatus,
    }}>
      {children}
    </AppContext.Provider>
  );
}
