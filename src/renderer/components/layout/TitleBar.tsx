/**
 * Title bar — blends with app, Samantha-style.
 * Agent name center, theme toggle + agent switcher on right.
 * Uses lucide-react icons matching Samantha.
 */

import { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, ChevronDown, FolderOpen, Plus, Circle, ArrowUp, Globe, Loader2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { FleetAgentInfo } from '../../context/AppContext';

export default function TitleBar() {
  const { agentRoot, fleetMode, agents: contextAgents, activeAgent, setActiveAgent, runningAgentRoot } = useApp();
  const [agentName, setAgentName] = useState('KyberBot');
  const [isDark, setIsDark] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [fleetAgents, setFleetAgents] = useState<FleetAgentInfo[]>([]);
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [appUpdate, setAppUpdate] = useState(false);
  const [appDownloaded, setAppDownloaded] = useState(false);
  const [cliUpdate, setCliUpdate] = useState(false);
  const [updating, setUpdating] = useState<'cli' | 'app' | null>(null);
  const [showRemoteForm, setShowRemoteForm] = useState(false);
  const [remoteName, setRemoteName] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteToken, setRemoteToken] = useState('');
  const [remoteValidating, setRemoteValidating] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  useEffect(() => {
    const kb = (window as any).kyberbot;
    if (!kb) return;
    kb.config.readIdentity().then((id: any) => {
      if (id?.agent_name) setAgentName(id.agent_name);
    });
    setIsDark(!document.documentElement.classList.contains('light'));
  }, [agentRoot]);

  // Listen for update availability
  useEffect(() => {
    const kb = (window as any).kyberbot;
    if (!kb?.updater) return;
    // Check initial state
    kb.updater.getState().then((s: any) => {
      setAppUpdate(s.appUpdateAvailable);
      setCliUpdate(s.cliUpdateAvailable);
    });
    // Subscribe to changes
    const unsubState = kb.updater.onStateChange((s: any) => {
      setAppUpdate(s.appUpdateAvailable);
      setCliUpdate(s.cliUpdateAvailable);
    });
    const unsubDownloaded = kb.updater.onDownloaded(() => {
      setAppDownloaded(true);
      setUpdating(null);
    });
    return () => { unsubState(); unsubDownloaded(); };
  }, []);

  // Keep fleetAgents in sync with context agents
  useEffect(() => {
    if (contextAgents.length > 0) {
      setFleetAgents(contextAgents);
    }
  }, [contextAgents]);

  // Update displayed name when active agent changes in fleet mode
  useEffect(() => {
    if (fleetMode && activeAgent) {
      setAgentName(activeAgent);
    }
  }, [fleetMode, activeAgent]);

  const loadFleet = useCallback(async () => {
    const kb = (window as any).kyberbot;
    if (!kb?.fleet) return;
    setLoadingFleet(true);
    try {
      const agents = await kb.fleet.list();
      setFleetAgents(agents);
    } catch {
      setFleetAgents([]);
    } finally {
      setLoadingFleet(false);
    }
  }, []);

  const handleDropdownOpen = () => {
    const next = !showMenu;
    setShowMenu(next);
    if (next) loadFleet();
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('kyberbot_theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('kyberbot_theme', 'light');
    }
  };

  const switchToAgent = async (agent: FleetAgentInfo) => {
    // Always switch via context — no page reload needed
    setActiveAgent(agent.name);
    setAgentName(agent.name);
    setShowMenu(false);
  };

  const browseAgent = async () => {
    const kb = (window as any).kyberbot;
    const result = await kb.config.selectAgentRoot();
    if (result?.hasIdentity) window.location.reload();
    else if (result) alert(`No identity.yaml found in ${result.path}`);
    setShowMenu(false);
  };

  const createNewAgent = () => {
    (window as any).kyberbot.config.setAgentRoot('').then(() => window.location.reload());
    setShowMenu(false);
  };

  const submitRemoteAgent = async () => {
    if (!remoteName.trim() || !remoteUrl.trim()) return;
    setRemoteValidating(true);
    setRemoteError(null);
    try {
      const kb = (window as any).kyberbot;
      const result = await kb.fleet.registerRemote(remoteName.trim(), remoteUrl.trim(), remoteToken.trim());
      if (result.ok) {
        setShowRemoteForm(false);
        setRemoteName('');
        setRemoteUrl('');
        setRemoteToken('');
        loadFleet();
      } else {
        setRemoteError(result.error || 'Registration failed');
      }
    } catch (err: any) {
      setRemoteError(err.message || 'Unknown error');
    } finally {
      setRemoteValidating(false);
    }
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    textAlign: 'left',
    padding: '8px 14px',
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--fg-secondary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '36px',
        padding: '0 12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        WebkitAppRegion: 'drag',
        position: 'relative',
      } as any}
    >
      {/* Custom stoplight buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingLeft: '4px', WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={() => (window as any).kyberbot.window.close()}
          style={{
            width: '12px', height: '12px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--stoplight-close)', padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          title="Close"
        />
        <button
          onClick={() => (window as any).kyberbot.window.minimize()}
          style={{
            width: '12px', height: '12px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--stoplight-minimize)', padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          title="Minimize"
        />
        <button
          onClick={() => (window as any).kyberbot.window.maximize()}
          style={{
            width: '12px', height: '12px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--stoplight-maximize)', padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          title="Maximize"
        />
      </div>

      {/* Center: Agent name (display only) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.15em', color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
          {'// ' + agentName}
        </span>
      </div>

      {/* Right: Update badges + Theme toggle */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', WebkitAppRegion: 'no-drag', paddingRight: '8px' } as any}>
        {/* CLI update badge */}
        {cliUpdate && (
          <button
            onClick={async () => {
              if (updating) return;
              setUpdating('cli');
              try {
                const kb = (window as any).kyberbot;
                const result = await kb.updater.updateCli();
                if (result?.ok) setCliUpdate(false);
              } catch {}
              setUpdating(null);
            }}
            title="KyberBot CLI update available"
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '2px 6px',
              fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '1px',
              textTransform: 'uppercase',
              color: '#10b981', border: '1px solid #10b981',
              background: 'transparent', cursor: updating === 'cli' ? 'wait' : 'pointer',
              opacity: updating === 'cli' ? 0.5 : 1,
            }}
          >
            <ArrowUp size={8} />
            {updating === 'cli' ? 'Updating...' : 'CLI'}
          </button>
        )}
        {/* App update badge */}
        {(appUpdate || appDownloaded) && (
          <button
            onClick={async () => {
              if (updating) return;
              const kb = (window as any).kyberbot;
              if (appDownloaded) {
                // Update downloaded — restart to apply
                kb.updater.quitAndInstall();
                return;
              }
              setUpdating('app');
              try {
                await kb.updater.installAppUpdate();
              } catch {}
              // Don't setUpdating(null) here — onDownloaded callback handles it
            }}
            title={appDownloaded ? 'Restart to apply update' : 'Desktop app update available'}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '2px 6px',
              fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '1px',
              textTransform: 'uppercase',
              color: appDownloaded ? '#10b981' : '#22d3ee',
              border: `1px solid ${appDownloaded ? '#10b981' : '#22d3ee'}`,
              background: 'transparent', cursor: updating === 'app' ? 'wait' : 'pointer',
              opacity: updating === 'app' ? 0.5 : 1,
            }}
          >
            <ArrowUp size={8} />
            {appDownloaded ? 'RESTART' : updating === 'app' ? 'Downloading...' : 'APP'}
          </button>
        )}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fg-secondary)', opacity: 0.6,
            width: '24px', height: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        >
          {isDark ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>

      {/* Dropdown */}
    </div>
  );
}
