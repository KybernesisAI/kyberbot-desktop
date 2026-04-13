/**
 * Dashboard — service status cards, start/stop controls, persistent log viewer.
 * Phase 4F: Fleet overview section when in fleet mode.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { FleetStatusData, FleetAgentInfo } from '../../context/AppContext';
import { getLogBuffer, subscribeToLogs } from '../../hooks/useLogs';
import AnsiToHtml from 'ansi-to-html';


const SERVICE_NAMES = ['ChromaDB', 'Server', 'Heartbeat', 'Sleep Agent', 'Channels', 'Tunnel'];

function statusColor(status: string): string {
  switch (status) {
    case 'running': return 'var(--status-success)';
    case 'disabled': return 'var(--fg-muted)';
    case 'error': return 'var(--status-error)';
    case 'starting': return 'var(--status-warning)';
    default: return 'var(--fg-muted)';
  }
}

function statusDot(status: string): string {
  switch (status) {
    case 'running': return 'status-dot--online';
    case 'error': return 'status-dot--error';
    default: return 'status-dot--offline';
  }
}

// (Agent Bus moved to dedicated Bus tab)

// ── Fleet Overview Component ──

function FleetOverview({ fleetStatus, activeAgent, setActiveAgent, agents: registeredAgents }: {
  fleetStatus: FleetStatusData;
  activeAgent: string | null;
  setActiveAgent: (name: string) => void;
  agents?: FleetAgentInfo[];
}) {
  return (
    <div className="mb-6">
      {/* Fleet header */}
      <div className="flex items-center justify-between mb-3">
        <span className="section-title" style={{ color: 'var(--accent-emerald)' }}>
          {'// FLEET'}
        </span>
        <div className="flex items-center gap-3">
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px',
            textTransform: 'uppercase', color: 'var(--fg-secondary)',
          }}>
            {fleetStatus.agents.length} agent{fleetStatus.agents.length !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px',
            textTransform: 'uppercase', color: 'var(--fg-secondary)',
          }}>
            uptime {fleetStatus.uptime}
          </span>
        </div>
      </div>

      {/* Agent cards — 3 column grid */}
      <div className="grid gap-2 mb-4" style={{
        gridTemplateColumns: 'repeat(3, 1fr)',
      }}>
        {fleetStatus.agents.map((agent) => {
          const isActive = activeAgent?.toLowerCase() === agent.name.toLowerCase();
          const regAgent = registeredAgents?.find(a => a.name.toLowerCase() === agent.name.toLowerCase());
          const isRemote = regAgent?.type === 'remote';
          return (
            <button
              key={agent.name}
              onClick={() => setActiveAgent(agent.name)}
              className="p-3 text-left transition-colors"
              style={{
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'var(--border-color-hover)' : 'var(--border-color)',
                cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: '2px' }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: agent.status === 'running' ? '#10b981' : agent.status === 'error' ? '#ef4444' : '#6b7280',
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600,
                  color: 'var(--fg-primary)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}
                </span>
                {isRemote && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.5px',
                    textTransform: 'uppercase', color: 'var(--accent-cyan)',
                    border: '1px solid rgba(34, 211, 238, 0.3)', padding: '1px 4px', lineHeight: '14px',
                  }}>
                    REMOTE
                  </span>
                )}
              </div>
              {regAgent?.description && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-muted)', lineHeight: '1.4', paddingLeft: '14px', marginBottom: '2px' }}>
                  {isRemote ? 'Remote agent' : regAgent.description}
                </div>
              )}
              <div className="flex items-center gap-2" style={{ paddingLeft: '14px' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: statusColor(agent.status),
                }}>
                  {isRemote ? (agent.status === 'running' ? 'remote' : agent.status) : agent.status}
                </span>
                {!isRemote && agent.uptime && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-secondary)' }}>
                    · {agent.uptime}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Sleep scheduler status */}
      {fleetStatus.sleep && (
        <div className="p-3 border mb-4" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
              sleep scheduler
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', marginLeft: 'auto' }}>
              {fleetStatus.sleep.current_agent
                ? `processing: ${fleetStatus.sleep.current_agent}`
                : 'idle'}
            </span>
            {fleetStatus.sleep.last_run && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)' }}>
                last: {new Date(fleetStatus.sleep.last_run).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Separator */}
      <div style={{ height: '1px', background: 'var(--border-color)', marginBottom: '16px' }} />
    </div>
  );
}

export default function DashboardView() {
  const { health, cliStatus, fleetMode, fleetStatus, agents, activeAgent, setActiveAgent, agentRoot, runningAgentRoot } = useApp();
  const kb = (window as any).kyberbot;
  const [logs, setLogs] = useState<string[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [selectedFleetAgents, setSelectedFleetAgents] = useState<Set<string>>(new Set());
  const logContainerRef = useRef<HTMLDivElement>(null);

  const currentAgent = agents.find(a => a.name?.toLowerCase() === activeAgent?.toLowerCase());
  const isRemoteAgent = currentAgent?.type === 'remote';

  const isRunning = cliStatus === 'running';
  const isStopping = cliStatus === 'stopping';
  const isStarting = cliStatus === 'starting';

  const services = health?.services ?? SERVICE_NAMES.map(name => ({ name, status: isRunning ? 'unknown' : 'stopped' }));
  const ansiConverter = useMemo(() => new AnsiToHtml({ fg: '#a1a1aa', bg: 'transparent', newline: false, escapeXML: true }), []);

  // Initialize fleet agent selection — all selected by default
  useEffect(() => {
    if (agents.length > 0 && selectedFleetAgents.size === 0) {
      setSelectedFleetAgents(new Set(agents.map(a => a.name)));
    }
  }, [agents]);

  // Load logs — in fleet mode all agents share one log stream ('__fleet__')
  const logKey = fleetMode ? '__fleet__' : agentRoot;
  useEffect(() => {
    setLogs([...getLogBuffer(logKey)]);
    return subscribeToLogs((root, lines) => {
      if (root === logKey) {
        setLogs([...lines]);
      }
    });
  }, [logKey]);

  // Auto-scroll only the log container
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", padding: 16, background: "var(--bg-primary)" }}>
      {/* Fleet Overview (only in fleet mode) */}
      {fleetMode && fleetStatus && (
        <FleetOverview
          fleetStatus={fleetStatus}
          activeAgent={activeAgent}
          setActiveAgent={setActiveAgent}
          agents={agents}
        />
      )}

      {/* Agent Bus moved to dedicated Bus tab */}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="section-title" style={{ color: isRemoteAgent ? 'var(--accent-cyan)' : 'var(--accent-emerald)' }}>
            {fleetMode && activeAgent ? `// ${activeAgent.toUpperCase()} SERVICES` : '// SERVICES'}
          </span>
          {isRemoteAgent && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--accent-cyan)',
              border: '1px solid var(--accent-cyan)', padding: '1px 5px', lineHeight: '14px',
            }}>
              REMOTE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className="text-[11px] tracking-[1px] uppercase" style={{
            fontFamily: 'var(--font-mono)',
            color: isRemoteAgent
              ? (isRunning ? '#22d3ee' : 'var(--fg-muted)')
              : (isRunning ? 'var(--status-success)' : isStopping ? 'var(--status-warning)' : isStarting ? 'var(--status-warning)' : 'var(--fg-muted)'),
          }}>
            {isRemoteAgent ? (isRunning ? 'remote' : 'offline') : cliStatus}
          </span>
          {/* Start/Stop — hidden for remote agents */}
          {!isRemoteAgent && (
            <>
              <button
                onClick={async () => {
                  await kb?.services.start();
                }}
                disabled={isRunning || isStarting || isStopping}
                className="px-4 py-2 text-[11px] tracking-[1px] uppercase border transition-colors"
                style={{
                  fontFamily: 'var(--font-mono)',
                  borderColor: isRunning || isStarting || isStopping ? 'var(--fg-muted)' : 'var(--accent-emerald)',
                  color: isRunning || isStarting || isStopping ? 'var(--fg-muted)' : '#ffffff',
                  background: isRunning || isStarting || isStopping ? 'transparent' : 'var(--accent-emerald)',
                  cursor: isRunning || isStarting || isStopping ? 'default' : 'pointer',
                  opacity: isRunning || isStarting || isStopping ? 0.3 : 1,
                }}
              >
                {`Start ${activeAgent || 'Agent'}`}
              </button>
              <button
                onClick={async () => {
                  if (fleetMode && fleetStatus) {
                    await kb?.fleet.stop();
                  } else {
                    await kb?.services.stop();
                  }
                }}
                disabled={!isRunning || isStopping}
                className="px-4 py-2 text-[11px] tracking-[1px] uppercase border transition-colors"
                style={{
                  fontFamily: 'var(--font-mono)',
                  borderColor: isRunning && !isStopping ? 'var(--status-error)' : 'var(--fg-muted)',
                  color: isRunning && !isStopping ? 'var(--status-error)' : 'var(--fg-muted)',
                  background: 'transparent',
                  cursor: isRunning && !isStopping ? 'pointer' : 'default',
                  opacity: isRunning && !isStopping ? 1 : 0.3,
                }}
              >
                {isStopping ? 'Stopping...' : (fleetMode && fleetStatus ? 'Stop Fleet' : `Stop ${activeAgent || 'Agent'}`)}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {services.map((svc) => (
          <div key={svc.name} className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`status-dot ${statusDot(svc.status)}`} />
              <span className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>{svc.name}</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.5px]" style={{ color: statusColor(svc.status), border: `1px solid ${statusColor(svc.status)}`, padding: '1px 6px', fontFamily: 'var(--font-mono)', lineHeight: '14px', display: 'inline-block', opacity: 0.8 }}>{svc.status}</span>
          </div>
        ))}
      </div>

      {/* Health Summary */}
      {health && health.status !== 'offline' && (
        <div className="mb-6">
          <span className="section-title" style={{ color: 'var(--accent-cyan)' }}>{'// HEALTH'}</span>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="text-[11px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--fg-secondary)' }}>Uptime</div>
              <div className="text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>{health.uptime}</div>
            </div>
            <div className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="text-[11px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--fg-secondary)' }}>Channels</div>
              <div className="text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>{(health.channels || []).filter(c => c.connected).length}/{(health.channels || []).length}</div>
            </div>
            <div className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="text-[11px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--fg-secondary)' }}>PID</div>
              <div className="text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>{health.pid}</div>
            </div>
          </div>
        </div>
      )}

      {/* Fleet Mode — agent registry management (hidden when fleet is running) */}
      {agents.length > 0 && !fleetMode && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="section-title" style={{ color: 'var(--accent-cyan)' }}>{'// FLEET MODE'}</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] tracking-[1px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
                {selectedFleetAgents.size}/{agents.length} selected
              </span>
              {agents.length >= 2 && !isStarting && (
                <button
                  onClick={async () => {
                    const selected = [...selectedFleetAgents];
                    if (selected.length > 0) {
                      await kb?.fleet.start(selected);
                    }
                  }}
                  disabled={isRunning || isStarting || isStopping || selectedFleetAgents.size === 0}
                  className="px-4 py-2 text-[11px] tracking-[1px] uppercase border transition-colors"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    borderColor: isRunning || isStarting || isStopping || selectedFleetAgents.size === 0 ? 'var(--fg-muted)' : 'var(--accent-cyan)',
                    color: isRunning || isStarting || isStopping || selectedFleetAgents.size === 0 ? 'var(--fg-muted)' : '#ffffff',
                    background: isRunning || isStarting || isStopping || selectedFleetAgents.size === 0 ? 'transparent' : 'var(--accent-cyan)',
                    cursor: isRunning || isStarting || isStopping || selectedFleetAgents.size === 0 ? 'default' : 'pointer',
                    opacity: isRunning || isStarting || isStopping || selectedFleetAgents.size === 0 ? 0.3 : 1,
                  }}
                >
                  Start Fleet ({selectedFleetAgents.size})
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {agents.map((agent: any) => {
              const isSelected = selectedFleetAgents.has(agent.name);
              const toggleSelect = () => {
                setSelectedFleetAgents(prev => {
                  const next = new Set(prev);
                  if (next.has(agent.name)) next.delete(agent.name);
                  else next.add(agent.name);
                  return next;
                });
              };
              return (
                <div key={agent.name} className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center justify-between">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={toggleSelect}
                        style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                      />
                      <span className="text-[12px]" style={{ fontFamily: 'var(--font-mono)', color: isSelected ? 'var(--fg-primary)' : 'var(--fg-secondary)' }}>{agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}</span>
                      {agent.type === 'remote' && (
                        <span style={{ fontSize: '9px', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent-cyan)', border: '1px solid var(--accent-cyan)', padding: '1px 4px', fontFamily: 'var(--font-mono)', lineHeight: '14px' }}>REMOTE</span>
                      )}
                      <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '200px' }}>
                        {agent.type === 'remote' ? (agent.remoteUrl || '') : (agent.root || '').replace(/^\/Users\/[^/]+\//, '~/')}
                      </span>
                    </div>
                    <button
                    onClick={async () => {
                      if (confirm(`Unregister "${agent.name}" from the fleet? This does not delete any files.`)) {
                        if (agent.type === 'remote') {
                          await kb?.fleet.unregisterRemote(agent.name);
                        } else {
                          await kb?.fleet.unregister(agent.name);
                        }
                        setSelectedFleetAgents(prev => { const next = new Set(prev); next.delete(agent.name); return next; });
                      }
                    }}
                    className="text-[8px] tracking-[0.5px] uppercase"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-error)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                  >
                    Unregister
                    </button>
                  </div>
                  {agent.description && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-muted)', lineHeight: '1.4', marginTop: '4px', paddingLeft: '22px' }}>
                      {agent.type === 'remote' ? 'Remote agent' : agent.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Log Viewer — collapsible */}
      <div>
        <button
          onClick={() => setLogsOpen(!logsOpen)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          <span className="section-title" style={{ color: 'var(--fg-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {'// LOGS'}
            <span style={{ fontSize: '10px', fontWeight: 400, letterSpacing: '0' }}>
              {logsOpen ? '▾' : '▸'}
            </span>
            {!logsOpen && logs.length > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 400, letterSpacing: '0', color: 'var(--fg-muted)' }}>
                ({logs.length} lines)
              </span>
            )}
          </span>
          {logsOpen && (
            <span
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(logs.join('\n')); }}
              style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', cursor: 'pointer', opacity: logs.length ? 1 : 0.3 }}
            >
              Copy
            </span>
          )}
        </button>
        {logsOpen && (
          <div ref={logContainerRef} className="mt-2 border" style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'auto', borderColor: 'var(--border-color)', background: '#0a0a0a' }}>
            <div style={{ padding: '8px', minWidth: '700px' }}>
              {logs.length === 0 && (
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'Menlo, Monaco, Consolas, monospace' }}>
                  {isRunning ? 'Waiting for log output...' : 'Start services to see logs'}
                </span>
              )}
              {logs.map((line, i) => (
                <div
                  key={i}
                  style={{ fontSize: '12px', lineHeight: '17px', whiteSpace: 'pre', fontFamily: 'Menlo, Monaco, Consolas, monospace', color: '#a1a1aa' }}
                  dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(line) }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
