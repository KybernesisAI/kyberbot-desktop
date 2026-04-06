/**
 * App-wide context: API token, server URL, health state, agent root.
 * Delays API readiness until the first successful health update
 * to avoid race condition errors in the server log.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { HealthData } from '../../types/ipc';

interface AppContextValue {
  agentRoot: string | null;
  apiToken: string | null;
  serverUrl: string;
  health: HealthData | null;
  cliStatus: string;
  isReady: boolean;       // config loaded (agent root, token)
  serverReady: boolean;   // server is up and responding to health checks
}

const AppContext = createContext<AppContextValue>({
  agentRoot: null,
  apiToken: null,
  serverUrl: 'http://localhost:3456',
  health: null,
  cliStatus: 'stopped',
  isReady: false,
  serverReady: false,
});

export function useApp(): AppContextValue {
  return useContext(AppContext);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [agentRoot, setAgentRoot] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('http://localhost:3456');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [cliStatus, setCliStatus] = useState('stopped');
  const [isReady, setIsReady] = useState(false);
  const [serverReady, setServerReady] = useState(false);

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
        setServerUrl(url);
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
      }
    });

    return () => {
      unsubHealth();
      unsubStatus();
    };
  }, []);

  return (
    <AppContext.Provider value={{ agentRoot, apiToken, serverUrl, health, cliStatus, isReady, serverReady }}>
      {children}
    </AppContext.Provider>
  );
}
