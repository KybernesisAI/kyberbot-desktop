/**
 * Title bar — blends with app, Samantha-style.
 * Agent name center, theme toggle + agent switcher on right.
 * Uses lucide-react icons matching Samantha.
 */

import { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, ChevronDown, FolderOpen, Plus, Circle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { FleetAgentInfo } from '../../context/AppContext';

export default function TitleBar() {
  const { agentRoot, fleetMode, agents: contextAgents, activeAgent, setActiveAgent, runningAgentRoot } = useApp();
  const [agentName, setAgentName] = useState('KyberBot');
  const [isDark, setIsDark] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [fleetAgents, setFleetAgents] = useState<FleetAgentInfo[]>([]);
  const [loadingFleet, setLoadingFleet] = useState(false);

  useEffect(() => {
    const kb = (window as any).kyberbot;
    if (!kb) return;
    kb.config.readIdentity().then((id: any) => {
      if (id?.agent_name) setAgentName(id.agent_name);
    });
    setIsDark(!document.documentElement.classList.contains('light'));
  }, [agentRoot]);

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

      {/* Right: Theme toggle */}
      <div style={{ width: '70px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', WebkitAppRegion: 'no-drag' as any }}>
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
                key={agent.root}
                onClick={() => switchToAgent(agent)}
                style={menuItemStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                  <span style={{
                    color: (fleetMode ? agent.name === activeAgent : agent.root === agentRoot)
                      ? 'var(--accent-emerald)' : 'var(--fg-secondary)',
                    fontWeight: (fleetMode ? agent.name === activeAgent : agent.root === agentRoot)
                      ? 600 : 400,
                  }}>
                    {agent.name}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agent.root.replace(/^\/Users\/[^/]+\//, '~/')}
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
