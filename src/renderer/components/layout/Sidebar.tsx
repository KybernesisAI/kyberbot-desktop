/**
 * Sidebar navigation — replaces horizontal TabBar.
 * V1 dark aesthetic: monospace, uppercase, emerald accents.
 */

import {
  MessageCircle,
  LayoutDashboard,
  Clock,
  Sparkles,
  Brain,
  Radio,
  Share2,
  Settings,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  FolderOpen,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';

export type NavId = 'chat' | 'dashboard' | 'heartbeat' | 'skills' | 'brain' | 'bus' | 'channels' | 'settings';

const NAV_ITEMS: Array<{ id: NavId; label: string; icon: typeof MessageCircle }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'heartbeat', label: 'Heartbeat', icon: Clock },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'brain', label: 'Brain', icon: Brain },
  { id: 'bus', label: 'Dispatch', icon: Radio },
  { id: 'channels', label: 'Channels', icon: Share2 },
];

interface SidebarProps {
  activeNav: NavId;
  onNavChange: (id: NavId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ activeNav, onNavChange, collapsed, onToggleCollapse }: SidebarProps) {
  const { agents, activeAgent, setActiveAgent, fleetMode, agentRoot } = useApp();
  const [isDark, setIsDark] = useState(() => !document.documentElement.classList.contains('light'));
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [showRemoteForm, setShowRemoteForm] = useState(false);
  const [remoteName, setRemoteName] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteToken, setRemoteToken] = useState('');
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('kyberbot_theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    const saved = localStorage.getItem('kyberbot_theme');
    if (saved === 'light') {
      document.documentElement.classList.add('light');
      setIsDark(false);
    }
  }, []);

  useEffect(() => {
    if (!agentDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAgentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [agentDropdownOpen]);

  const currentAgent = activeAgent
    ? agents.find(a => a.name.toLowerCase() === activeAgent.toLowerCase())
    : agents[0];
  const agentName = currentAgent?.name || 'KyberBot';

  const navButtonStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
    color: isActive ? 'var(--accent-emerald)' : 'var(--fg-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as const,
    fontWeight: 400,
    cursor: 'pointer',
    transition: 'background var(--transition-fast), color var(--transition-fast)',
    textAlign: 'left' as const,
  });

  return (
    <aside
      style={{
        width: collapsed ? '56px' : '220px',
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 150ms ease',
      }}
    >
      {/* Agent switcher */}
      {!collapsed && <div ref={dropdownRef} style={{ padding: '8px 10px 8px', position: 'relative' }}>
        <button
          onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '14px 12px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            textAlign: 'left',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => { if (!agentDropdownOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => { if (!agentDropdownOpen) e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: '11px', letterSpacing: '0.15em', color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
            {'// ' + agentName}
          </span>
          {agentDropdownOpen
            ? <ChevronUp size={12} style={{ color: 'var(--fg-muted)', flexShrink: 0, marginLeft: 'auto' }} />
            : <ChevronDown size={12} style={{ color: 'var(--fg-muted)', flexShrink: 0, marginLeft: 'auto' }} />
          }
        </button>

        {/* Dropdown */}
        {agentDropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '8px',
            right: '8px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            zIndex: 50,
            padding: '4px 0',
            marginTop: '4px',
            maxHeight: '520px',
            overflowY: 'auto',
          }}>
            {agents.length > 0 && (
              <>
                {agents.map(agent => {
                  const isSelected = agent.name.toLowerCase() === (activeAgent || agents[0]?.name || '').toLowerCase();
                  return (
                    <button
                      key={agent.name}
                      onClick={() => { setActiveAgent(agent.name); setAgentDropdownOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                        padding: '8px 12px', border: 'none',
                        background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                        cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '12px',
                        color: isSelected ? 'var(--accent-emerald)' : 'var(--fg-secondary)',
                        textAlign: 'left',
                        transition: 'background var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
                    >
                      <span style={{
                        fontWeight: isSelected ? 600 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}
                      </span>
                      {agent.type === 'remote' && (
                        <span style={{ fontSize: '8px', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent-cyan)', border: '1px solid rgba(34,211,238,0.3)', padding: '0px 3px', lineHeight: '12px' }}>
                          REMOTE
                        </span>
                      )}
                      {isSelected && <Check size={12} style={{ color: 'var(--accent-emerald)', flexShrink: 0, marginLeft: 'auto' }} />}
                    </button>
                  );
                })}
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
              </>
            )}

            {/* Management actions */}
            {([
              { icon: Plus, label: 'Create new agent', action: () => { (window as any).kyberbot.config.setAgentRoot('').then(() => window.location.reload()); setAgentDropdownOpen(false); } },
              { icon: FolderOpen, label: 'Browse...', action: async () => { const result = await (window as any).kyberbot.config.selectAgentRoot(); if (result?.hasIdentity) window.location.reload(); else if (result) alert('No identity.yaml found.'); setAgentDropdownOpen(false); } },
              { icon: Globe, label: 'Add remote agent', action: () => { setShowRemoteForm(!showRemoteForm); } },
            ] as const).map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '8px 12px', border: 'none',
                  background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                  fontSize: '11px', color: 'var(--fg-muted)', textAlign: 'left',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={12} strokeWidth={1.8} />
                {label}
              </button>
            ))}

            {showRemoteForm && (
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input value={remoteName} onChange={(e) => setRemoteName(e.target.value)} placeholder="Agent name"
                  style={{ padding: '6px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--fg-primary)', outline: 'none' }} />
                <input value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} placeholder="URL (https://...)"
                  style={{ padding: '6px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--fg-primary)', outline: 'none' }} />
                <input value={remoteToken} onChange={(e) => setRemoteToken(e.target.value)} placeholder="API token (optional)"
                  style={{ padding: '6px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--fg-primary)', outline: 'none' }} />
                {remoteError && <div style={{ fontSize: '10px', color: 'var(--status-error)' }}>{remoteError}</div>}
                <button
                  onClick={async () => {
                    if (!remoteName.trim() || !remoteUrl.trim()) return;
                    setRemoteError(null);
                    try {
                      const result = await (window as any).kyberbot.fleet.registerRemote(remoteName.trim(), remoteUrl.trim(), remoteToken.trim());
                      if (result.ok) { setShowRemoteForm(false); setRemoteName(''); setRemoteUrl(''); setRemoteToken(''); setAgentDropdownOpen(false); window.location.reload(); }
                      else setRemoteError(result.error || 'Failed');
                    } catch (err: any) { setRemoteError(err.message); }
                  }}
                  disabled={!remoteName.trim() || !remoteUrl.trim()}
                  style={{
                    padding: '6px 12px', fontSize: '11px', fontFamily: 'var(--font-mono)',
                    border: '1px solid var(--accent-emerald)', color: 'var(--accent-emerald)', background: 'transparent',
                    cursor: remoteName.trim() && remoteUrl.trim() ? 'pointer' : 'default',
                    opacity: remoteName.trim() && remoteUrl.trim() ? 1 : 0.4,
                    textTransform: 'uppercase', letterSpacing: '1px',
                  }}
                >Add</button>
              </div>
            )}
          </div>
        )}
      </div>}

      {/* Navigation items */}
      <nav style={{ flex: 1, padding: collapsed ? '4px 6px' : '4px 8px', overflow: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                ...navButtonStyle(isActive),
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '8px' : '8px 12px',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={16} strokeWidth={1.8} />
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div style={{ padding: collapsed ? '4px 6px' : '4px 8px' }}>
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            ...navButtonStyle(false),
            color: 'var(--fg-muted)',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '8px' : '8px 12px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.8} /> : <PanelLeftClose size={16} strokeWidth={1.8} />}
          {!collapsed && 'Collapse'}
        </button>
      </div>

      {/* Bottom: Settings + Theme toggle */}
      <div style={{ padding: collapsed ? '8px 6px' : '8px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={() => onNavChange('settings')}
          title={collapsed ? 'Settings' : undefined}
          style={{
            ...navButtonStyle(activeNav === 'settings'),
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '8px' : '8px 12px',
          }}
          onMouseEnter={(e) => { if (activeNav !== 'settings') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => { if (activeNav !== 'settings') e.currentTarget.style.background = activeNav === 'settings' ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
        >
          <Settings size={16} strokeWidth={1.8} />
          {!collapsed && 'Settings'}
        </button>

      </div>
    </aside>
  );
}
