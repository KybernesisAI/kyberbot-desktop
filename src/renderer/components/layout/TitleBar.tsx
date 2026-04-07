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
    padding: '6px 12px',
    fontSize: '11px',
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
        WebkitAppRegion: 'drag' as any,
        position: 'relative',
      }}
    >
      {/* Spacer for native macOS stoplight buttons */}
      <div style={{ width: '70px', flexShrink: 0 }} />

      {/* Center: Agent name dropdown */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={handleDropdownOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            WebkitAppRegion: 'no-drag' as any,
            background: 'transparent', border: 'none', cursor: 'pointer',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
            {`// ${agentName}`}
          </span>
          <ChevronDown size={10} style={{ color: 'var(--fg-muted)' }} />
        </button>
      </div>

      {/* Right: Update badges + Theme toggle */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', WebkitAppRegion: 'no-drag' as any, paddingRight: '8px' }}>
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
            color: 'var(--fg-muted)', opacity: 0.4,
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
        >
          {isDark ? <Moon size={12} /> : <Sun size={12} />}
        </button>
      </div>

      {/* Dropdown */}
      {showMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 50, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', padding: '4px 0', minWidth: '240px', WebkitAppRegion: 'no-drag' as any }}>

            {/* Fleet agents */}
            {loadingFleet && (
              <div style={{ ...menuItemStyle, color: 'var(--fg-muted)', cursor: 'default' }}>
                Loading...
              </div>
            )}
            {!loadingFleet && fleetAgents.length > 0 && fleetAgents.map((agent) => (
              <button
                key={agent.type === 'remote' ? `remote-${agent.name}` : agent.root}
                onClick={() => switchToAgent(agent)}
                style={menuItemStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {agent.type === 'remote' ? (
                  <Globe size={8} style={{ flexShrink: 0, color: agent.running ? '#22d3ee' : '#6b7280' }} />
                ) : (
                  <Circle
                    size={6}
                    fill={
                      fleetMode
                        ? (agent.running ? '#10b981' : '#6b7280')
                        : (runningAgentRoot === agent.root ? '#10b981' : '#6b7280')
                    }
                    stroke="none"
                    style={{ flexShrink: 0 }}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      color: (fleetMode ? agent.name === activeAgent : agent.type === 'remote' ? agent.name === activeAgent : agent.root === agentRoot)
                        ? 'var(--accent-emerald)' : 'var(--fg-secondary)',
                      fontWeight: (fleetMode ? agent.name === activeAgent : agent.type === 'remote' ? agent.name === activeAgent : agent.root === agentRoot)
                        ? 600 : 400,
                    }}>
                      {agent.name}
                    </span>
                    {agent.type === 'remote' && (
                      <span style={{
                        fontSize: '7px', letterSpacing: '0.5px', textTransform: 'uppercase',
                        color: '#22d3ee', border: '1px solid #22d3ee', padding: '0px 3px',
                        fontFamily: 'var(--font-mono)', lineHeight: '14px',
                      }}>
                        REMOTE
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agent.type === 'remote' ? (agent.remoteUrl || 'remote') : agent.root.replace(/^\/Users\/[^/]+\//, '~/')}
                  </span>
                </div>
              </button>
            ))}
            {!loadingFleet && fleetAgents.length === 0 && (
              <div style={{ ...menuItemStyle, color: 'var(--fg-muted)', cursor: 'default', fontStyle: 'italic' }}>
                No agents registered
              </div>
            )}

            {/* Separator */}
            <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

            {/* Browse */}
            <button
              onClick={browseAgent}
              style={menuItemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <FolderOpen size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
              Browse...
            </button>

            {/* Add Remote Agent */}
            {!showRemoteForm ? (
              <button
                onClick={() => { setShowRemoteForm(true); setRemoteError(null); }}
                style={{ ...menuItemStyle, color: 'var(--accent-cyan)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Globe size={11} style={{ flexShrink: 0 }} />
                Add Remote Agent
              </button>
            ) : (
              <div style={{ padding: '8px 12px' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                    Add Remote Agent
                  </span>
                  <button onClick={() => { setShowRemoteForm(false); setRemoteError(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 0 }}>
                    <X size={10} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input
                    type="text"
                    placeholder="Name"
                    value={remoteName}
                    onChange={(e) => setRemoteName(e.target.value)}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '10px',
                      padding: '4px 6px', background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)', color: 'var(--fg-primary)',
                      outline: 'none', width: '100%',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="URL (e.g. https://abc123.ngrok.io)"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '10px',
                      padding: '4px 6px', background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)', color: 'var(--fg-primary)',
                      outline: 'none', width: '100%',
                    }}
                  />
                  <input
                    type="password"
                    placeholder="API Token"
                    value={remoteToken}
                    onChange={(e) => setRemoteToken(e.target.value)}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '10px',
                      padding: '4px 6px', background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)', color: 'var(--fg-primary)',
                      outline: 'none', width: '100%',
                    }}
                  />
                  {remoteError && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--status-error)' }}>
                      {remoteError}
                    </span>
                  )}
                  <button
                    onClick={submitRemoteAgent}
                    disabled={remoteValidating || !remoteName.trim() || !remoteUrl.trim()}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px',
                      textTransform: 'uppercase', padding: '4px 8px', marginTop: '2px',
                      background: 'transparent', cursor: remoteValidating ? 'wait' : 'pointer',
                      border: `1px solid ${remoteValidating ? 'var(--fg-muted)' : 'var(--accent-cyan)'}`,
                      color: remoteValidating ? 'var(--fg-muted)' : 'var(--accent-cyan)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      opacity: (!remoteName.trim() || !remoteUrl.trim()) ? 0.3 : 1,
                    }}
                  >
                    {remoteValidating && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}
                    {remoteValidating ? 'Validating...' : 'Connect'}
                  </button>
                </div>
              </div>
            )}

            {/* Create new */}
            <button
              onClick={createNewAgent}
              style={{ ...menuItemStyle, color: 'var(--accent-emerald)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Plus size={11} style={{ flexShrink: 0 }} />
              Create New Agent
            </button>
          </div>
        </>
      )}
    </div>
  );
}
