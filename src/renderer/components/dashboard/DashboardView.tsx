/**
 * Dashboard — service status cards, start/stop controls, persistent log viewer.
 * Phase 4F: Fleet overview section when in fleet mode.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { FleetStatusData } from '../../context/AppContext';
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

// ── Fleet Overview Component ──

function FleetOverview({ fleetStatus, activeAgent, setActiveAgent }: {
  fleetStatus: FleetStatusData;
  activeAgent: string | null;
  setActiveAgent: (name: string) => void;
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
            fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px',
            textTransform: 'uppercase', color: 'var(--fg-muted)',
          }}>
            {fleetStatus.agents.length} agent{fleetStatus.agents.length !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px',
            textTransform: 'uppercase', color: 'var(--fg-muted)',
          }}>
            uptime {fleetStatus.uptime}
          </span>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {fleetStatus.agents.map((agent) => {
          const isActive = activeAgent?.toLowerCase() === agent.name.toLowerCase();
          return (
            <button
              key={agent.name}
              onClick={() => setActiveAgent(agent.name)}
              className="p-3 border text-left transition-colors"
              style={{
                background: isActive ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                borderColor: isActive ? 'var(--accent-emerald)' : 'var(--border-color)',
                cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="status-dot"
                  style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: agent.status === 'running' ? '#10b981' : agent.status === 'error' ? '#ef4444' : '#6b7280',
                  }}
                />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                  color: isActive ? 'var(--accent-emerald)' : 'var(--fg-primary)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {agent.name}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: statusColor(agent.status),
                  marginLeft: 'auto',
                }}>
                  {agent.status}
                </span>
              </div>

              {/* Agent services */}
              {agent.services && agent.services.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {agent.services.map((svc) => (
                    <span key={svc.name} style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px',
                      color: statusColor(svc.status), opacity: 0.8,
                    }}>
                      {svc.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Agent channels */}
              {agent.channels && agent.channels.length > 0 && (
                <div className="flex gap-2 mt-1">
                  {agent.channels.map((ch) => (
                    <span key={ch.name} style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px',
                      color: ch.connected ? 'var(--status-success)' : 'var(--fg-muted)',
                    }}>
                      {ch.name}
                    </span>
                  ))}
                </div>
              )}

              {agent.uptime && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', marginTop: '4px' }}>
                  up {agent.uptime}
                </div>
              )}
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
  const { health, cliStatus, fleetMode, fleetStatus, agents, activeAgent, setActiveAgent } = useApp();
  const kb = (window as any).kyberbot;
  const [logs, setLogs] = useState<string[]>(getLogBuffer());
  const logContainerRef = useRef<HTMLDivElement>(null);

  const isRunning = cliStatus === 'running';
  const isStopping = cliStatus === 'stopping';
  const isStarting = cliStatus === 'starting';

  const services = health?.services ?? SERVICE_NAMES.map(name => ({ name, status: isRunning ? 'unknown' : 'stopped' }));
  const ansiConverter = useMemo(() => new AnsiToHtml({ fg: '#a1a1aa', bg: 'transparent', newline: false, escapeXML: true }), []);

  // Subscribe to log buffer updates (module-level, persists across tab switches)
  useEffect(() => {
    return subscribeToLogs((lines) => {
      setLogs([...lines]);
    });
  }, []);

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
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="section-title" style={{ color: 'var(--accent-emerald)' }}>
          {fleetMode && activeAgent ? `// ${activeAgent.toUpperCase()} SERVICES` : '// SERVICES'}
        </span>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className="text-[9px] tracking-[1px] uppercase" style={{
            fontFamily: 'var(--font-mono)',
            color: isRunning ? 'var(--status-success)' : isStopping ? 'var(--status-warning)' : isStarting ? 'var(--status-warning)' : 'var(--fg-muted)',
          }}>
            {cliStatus}
          </span>
          <button
            onClick={() => kb?.services.start()}
            disabled={isRunning || isStarting || isStopping}
            className="px-3 py-1 text-[9px] tracking-[1px] uppercase border transition-colors"
            style={{
              fontFamily: 'var(--font-mono)',
              borderColor: isRunning || isStarting || isStopping ? 'var(--fg-muted)' : 'var(--accent-emerald)',
              color: isRunning || isStarting || isStopping ? 'var(--fg-muted)' : 'var(--accent-emerald)',
              background: 'transparent',
              cursor: isRunning || isStarting || isStopping ? 'default' : 'pointer',
              opacity: isRunning || isStarting || isStopping ? 0.3 : 1,
            }}
          >
            Start
          </button>
          <button
            onClick={() => kb?.services.stop()}
            disabled={!isRunning || isStopping}
            className="px-3 py-1 text-[9px] tracking-[1px] uppercase border transition-colors"
            style={{
              fontFamily: 'var(--font-mono)',
              borderColor: isRunning && !isStopping ? 'var(--status-error)' : 'var(--fg-muted)',
              color: isRunning && !isStopping ? 'var(--status-error)' : 'var(--fg-muted)',
              background: 'transparent',
              cursor: isRunning && !isStopping ? 'pointer' : 'default',
              opacity: isRunning && !isStopping ? 1 : 0.3,
            }}
          >
            {isStopping ? 'Stopping...' : 'Stop'}
          </button>
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {services.map((svc) => (
          <div key={svc.name} className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`status-dot ${statusDot(svc.status)}`} />
              <span className="text-[11px] font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>{svc.name}</span>
            </div>
            <span className="text-[9px] uppercase tracking-[1px]" style={{ color: statusColor(svc.status) }}>{svc.status}</span>
          </div>
        ))}
      </div>

      {/* Health Summary */}
      {health && health.status !== 'offline' && (
        <div className="mb-6">
          <span className="section-title" style={{ color: 'var(--accent-cyan)' }}>{'// HEALTH'}</span>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="text-[9px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Uptime</div>
              <div className="text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>{health.uptime}</div>
            </div>
            <div className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="text-[9px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Channels</div>
              <div className="text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>{health.channels.filter(c => c.connected).length}/{health.channels.length}</div>
            </div>
            <div className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="text-[9px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>PID</div>
              <div className="text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>{health.pid}</div>
            </div>
          </div>
        </div>
      )}

      {/* Log Viewer — persistent for entire session */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-title" style={{ color: 'var(--fg-tertiary)' }}>{'// LOGS'}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(logs.join('\n')); }}
            style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: logs.length ? 1 : 0.3 }}
          >
            Copy
          </button>
        </div>
        <div ref={logContainerRef} className="mt-2 border" style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'auto', borderColor: 'var(--border-color)', background: '#0a0a0a' }}>
          <div style={{ padding: '8px', minWidth: '700px' }}>
            {logs.length === 0 && (
              <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'Menlo, Monaco, Consolas, monospace' }}>
                {isRunning ? 'Waiting for log output...' : 'Start services to see logs'}
              </span>
            )}
            {logs.map((line, i) => (
              <div
                key={i}
                style={{ fontSize: '12px', lineHeight: '17px', whiteSpace: 'pre', fontFamily: 'Menlo, Monaco, Consolas, monospace' }}
                dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(line) }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
