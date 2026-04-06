/**
 * App-wide context: multi-agent aware.
 *
 * Key concept: `runningAgentRoot` tracks which agent the lifecycle actually started.
 * When viewing a different agent, the dashboard shows "stopped" even though the
 * lifecycle process is alive — because it's not THIS agent's process.
 *
 * In fleet mode (`runningAgentRoot === '__fleet__'`), all agents share one server
 * and switching is instant with /agent/{name} routing.
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
  baseServerUrl: string;
  health: HealthData | null;
  cliStatus: string;            // actual lifecycle status
  effectiveStatus: string;      // status for the VIEWED agent (stopped if not this agent's process)
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
  agentRoot: null,
  apiToken: null,
  serverUrl: 'http://localhost:3456',
  baseServerUrl: 'http://localhost:3456',
  health: null,
  cliStatus: 'stopped',
  effectiveStatus: 'stopped',
  isReady: false,
  serverReady: false,
  fleetMode: false,
  agents: [],
  activeAgent: null,
  setActiveAgent: () => {},
  fleetStatus: null,
  runningAgentRoot: null,
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

  // Multi-agent state
  const [agents, setAgents] = useState<FleetAgentInfo[]>([]);
  const [activeAgent, setActiveAgentState] = useState<string | null>(null);
  const [fleetStatus, setFleetStatus] = useState<FleetStatusData | null>(null);
  const [runningAgentRoot, setRunningAgentRoot] = useState<string | null>(null);

  // Fleet mode = fleet server confirmed running
  const fleetMode = fleetStatus !== null;

  // Is the currently viewed agent the one that's actually running?
  const isThisAgentRunning = fleetMode
    ? true  // fleet serves all agents
    : (runningAgentRoot !== null && runningAgentRoot === agentRoot);

  // Effective status for the viewed agent
  const effectiveStatus = isThisAgentRunning ? cliStatus : 'stopped';

  // Server URL: in fleet mode, route through /agent/{name}
  const serverUrl = fleetMode && activeAgent
    ? `${baseServerUrl}/agent/${encodeURIComponent(activeAgent)}`
    : baseServerUrl;

  // Switch active agent — NO page reload, just context update
  const setActiveAgent = useCallback((name: string) => {
    const kb = (window as any).kyberbot;
    if (!kb) return;

    const agent = agents.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (!agent) return;

    setActiveAgentState(name);

    // Update the store so IPC reads (readIdentity, readEnv) use the right root
    kb.config.setAgentRoot(agent.root).then(() => {
      setAgentRoot(agent.root);
      // Read this agent's server URL (might be different port)
      kb.config.getServerUrl().then((url: string) => {
        if (!fleetMode) setBaseServerUrl(url);
      });
      kb.config.getApiToken().then((token: string | null) => {
        if (token) setApiToken(token);
      });
    });
  }, [agents, fleetMode]);

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

      // Get lifecycle status including which agent is running
      const statusResult = await kb.services.getStatus();
      setCliStatus(statusResult.status);
      setRunningAgentRoot(statusResult.runningAgentRoot || null);

      // Check fleet status
      try {
        const fleetResult = await kb.fleet.getStatus();
        if (fleetResult.fleetMode && fleetResult.fleet) {
          setFleetStatus(fleetResult.fleet);
        }
      } catch { /* not available */ }

      // Load registered agents
      try {
        const registeredAgents = await kb.fleet.list();
        setAgents(registeredAgents);

        // Set active agent to current root's agent
        if (root) {
          const currentAgent = registeredAgents.find((a: FleetAgentInfo) => a.root === root);
          if (currentAgent) {
            setActiveAgentState(currentAgent.name);
          }
        }
      } catch { /* not available */ }

      setIsReady(true);
    };
    init();

    // Health updates — tagged with agent root
    const unsubHealth = kb.services.onHealthUpdate((h: HealthData, root?: string) => {
      // Only apply health to the viewed agent
      const viewedRoot = kb.config.getAgentRoot ? null : null; // we compare below
      setHealth((prev: HealthData | null) => {
        // Always store latest health — effectiveStatus handles showing it correctly
        return h;
      });
      if (h.status !== 'offline') {
        if (!serverReady) {
          kb.config.getApiToken().then((token: string | null) => {
            if (token) setApiToken(token);
            setServerReady(true);
          });
        }
      }
    });

    // Status changes — includes which agent root changed
    const unsubStatus = kb.services.onStatusChange((status: string, root?: string | null) => {
      setCliStatus(status);
      if (root !== undefined) setRunningAgentRoot(root);
      if (status === 'stopped' || status === 'crashed') {
        if (root === '__fleet__' || !root) {
          setFleetStatus(null);
        }
      }
    });

    // Per-agent status changes — update running roots
    const unsubAgentStatus = kb.services.onAgentStatusChange?.((root: string, status: string) => {
      // Update agent running states
      setAgents(prev => prev.map(a =>
        a.root === root ? { ...a, running: status === 'running' || status === 'starting' } : a
      ));
    }) ?? (() => {});

    // Fleet status updates
    const unsubFleet = kb.fleet?.onStatusUpdate?.((fleet: FleetStatusData) => {
      setFleetStatus(fleet);
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
      unsubAgentStatus();
      unsubFleet();
    };
  }, []);

  return (
    <AppContext.Provider value={{
      agentRoot, apiToken, serverUrl, baseServerUrl, health,
      cliStatus, effectiveStatus, isReady, serverReady,
      fleetMode, agents, activeAgent, setActiveAgent, fleetStatus,
      runningAgentRoot,
    }}>
      {children}
    </AppContext.Provider>
  );
}
