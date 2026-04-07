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
  type?: 'local' | 'remote';
  remoteUrl?: string;
  remoteToken?: string;
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
    ? `${baseServerUrl}/agent/${encodeURIComponent(activeAgent.toLowerCase())}`
    : baseServerUrl;

  // Switch active agent — no reload
  const setActiveAgent = useCallback((name: string) => {
    const kb = (window as any).kyberbot;
    if (!kb) return;
    const agent = agents.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (!agent) return;

    setActiveAgentState(name);

    if (agent.type === 'remote') {
      // Remote agent — point to remote URL, use remote token, skip local root config
      if (agent.remoteUrl) setBaseServerUrl(agent.remoteUrl);
      if (agent.remoteToken) setApiToken(agent.remoteToken);
      // Don't call kb.config.setAgentRoot for remote agents
      return;
    }

    // Local agent — configure local root
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

  // ── Master poll: agent state + fleet status, every 3 seconds ──
  useEffect(() => {
    const kb = (window as any).kyberbot;
    if (!kb || !isReady) return;

    // Find the current active agent info
    const currentAgent = agents.find(a => a.name.toLowerCase() === activeAgent?.toLowerCase());
    const isRemoteAgent = currentAgent?.type === 'remote';

    // Remote agents don't need agentRoot, but local agents do
    if (!isRemoteAgent && !agentRoot) return;

    const poll = async () => {
      try {
        // If viewing a remote agent, poll its health directly
        if (isRemoteAgent && currentAgent?.remoteUrl) {
          try {
            const headers: Record<string, string> = {};
            if (currentAgent.remoteToken) headers['Authorization'] = `Bearer ${currentAgent.remoteToken}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${currentAgent.remoteUrl}/health`, {
              signal: controller.signal,
              headers,
            });
            clearTimeout(timeout);
            if (res.ok) {
              const data = await res.json();
              setHealth({
                status: data.status || 'ok',
                timestamp: data.timestamp || new Date().toISOString(),
                uptime: data.uptime || '0s',
                channels: data.channels || [],
                services: data.services || [],
                errors: data.errors || 0,
                memory: data.memory || {},
                pid: data.pid || 0,
                node_version: data.node_version || '',
              });
              setCliStatus('running');
              setServerReady(true);
            } else {
              setHealth(null);
              setCliStatus('stopped');
              setServerReady(false);
            }
          } catch {
            setHealth(null);
            setCliStatus('stopped');
            setServerReady(false);
          }

          // Update remote agent running indicators
          if (agents.length > 0) {
            const updated = await Promise.all(agents.map(async (a) => {
              if (a.type === 'remote' && a.remoteUrl) {
                try {
                  const ctrl = new AbortController();
                  const t = setTimeout(() => ctrl.abort(), 2000);
                  const hdrs: Record<string, string> = {};
                  if (a.remoteToken) hdrs['Authorization'] = `Bearer ${a.remoteToken}`;
                  const r = await fetch(`${a.remoteUrl}/health`, { signal: ctrl.signal, headers: hdrs });
                  clearTimeout(t);
                  return { ...a, running: r.ok };
                } catch {
                  return { ...a, running: false };
                }
              }
              try {
                const s = await kb.services.getAgentState(a.root);
                return { ...a, running: s.isRunning };
              } catch {
                return { ...a, running: false };
              }
            }));
            setAgents(updated);
          }
          return;
        }

        // 1. Check fleet status first
        const fleetResult = await kb.fleet.getStatus();
        const isFleet = fleetResult.fleetMode && fleetResult.fleet;

        if (isFleet) {
          // Fleet mode — status comes from fleet, not individual agents
          setFleetStatus(fleetResult.fleet);
          setCliStatus('running');
          setServerReady(true);

          // Always re-read token (closure may have stale value)
          const freshToken = await kb.config.getApiToken();
          if (freshToken) setApiToken(freshToken);

          // Synthesize health from fleet data for the viewed agent
          const fleetAgent = fleetResult.fleet.agents?.find(
            (a: any) => a.name.toLowerCase() === activeAgent?.toLowerCase()
          );
          if (fleetAgent) {
            setHealth({
              status: fleetAgent.status === 'running' ? 'ok' : 'degraded',
              timestamp: new Date().toISOString(),
              uptime: fleetAgent.uptime || '0s',
              channels: fleetAgent.channels || [],
              services: fleetAgent.services || [],
              errors: 0, memory: {}, pid: fleetResult.fleet.pid || 0, node_version: '',
            } as any);
          }

          // Update agent running indicators from fleet data
          if (fleetResult.fleet?.agents) {
            setAgents(prev => prev.map(a => {
              if (a.type === 'remote') return a; // Remote agents manage their own status
              const fa = fleetResult.fleet.agents.find(
                (f: any) => f.name.toLowerCase() === a.name.toLowerCase()
              );
              return fa ? { ...a, running: fa.status === 'running' } : a;
            }));
          }
          setRunningAgentRoot('__fleet__');
          return;
        } else {
          // Not in fleet mode — always clear (avoids stale closure check)
          setFleetStatus(null);
        }

        // 2. Single-agent mode — poll this agent's state
        const state = await kb.services.getAgentState(agentRoot);
        setCliStatus(state.status || 'stopped');
        setHealth(state.health || null);
        setServerReady(state.isRunning || false);

        if (state.isRunning && !serverReady) {
          const token = await kb.config.getApiToken();
          if (token) setApiToken(token);
        }

        // 3. Update all agent running indicators
        if (agents.length > 0) {
          const updated = await Promise.all(agents.map(async (a) => {
            if (a.type === 'remote' && a.remoteUrl) {
              try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 2000);
                const hdrs: Record<string, string> = {};
                if (a.remoteToken) hdrs['Authorization'] = `Bearer ${a.remoteToken}`;
                const r = await fetch(`${a.remoteUrl}/health`, { signal: ctrl.signal, headers: hdrs });
                clearTimeout(t);
                return { ...a, running: r.ok };
              } catch {
                return { ...a, running: false };
              }
            }
            try {
              const s = await kb.services.getAgentState(a.root);
              return { ...a, running: s.isRunning };
            } catch {
              return { ...a, running: false };
            }
          }));
          setAgents(updated);
          const anyRunning = updated.find(a => a.running);
          setRunningAgentRoot(anyRunning?.root || null);
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
  }, [agentRoot, activeAgent, isReady]);

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
