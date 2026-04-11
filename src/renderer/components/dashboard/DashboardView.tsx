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

function _removedAgentBusPlaceholder({ agents, activeAgent }: {
  agents: Array<{ name: string; status: string }>;
  activeAgent: string | null;
}) {
  const { baseServerUrl, apiToken } = useApp();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [recipient, setRecipient] = useState<string>('broadcast');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
  }), [apiToken]);

  // Fetch bus history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${baseServerUrl}/fleet/bus/history?limit=50`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch {
      // Bus not available yet
    }
  }, [baseServerUrl, headers]);

  // Poll every 10 seconds
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10_000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Send message
  const handleSend = async () => {
    if (!messageText.trim() || !activeAgent) return;
    setSending(true);
    try {
      const isBroadcast = recipient === 'broadcast';
      const endpoint = isBroadcast
        ? `${baseServerUrl}/fleet/bus/broadcast`
        : `${baseServerUrl}/fleet/bus/send`;
      const body = isBroadcast
        ? { from: activeAgent, message: messageText.trim(), topic: 'manual' }
        : { from: activeAgent, to: recipient, message: messageText.trim(), topic: 'manual' };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMessageText('');
        // Immediately refresh history after send
        await fetchHistory();
      }
    } catch {
      // Send failed
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Available recipients: other agents in the fleet
  const otherAgents = agents.filter(a => a.name.toLowerCase() !== activeAgent?.toLowerCase());

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <span className="section-title" style={{ color: 'var(--accent-emerald)' }}>
          {'// AGENT BUS'}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px',
          textTransform: 'uppercase', color: 'var(--fg-muted)',
        }}>
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Message history */}
      <div
        ref={scrollContainerRef}
        className="border"
        style={{
          maxHeight: '240px',
          overflowY: 'auto',
          borderColor: 'var(--border-color)',
          background: 'var(--bg-secondary)',
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--fg-muted)',
            textAlign: 'center',
          }}>
            No messages yet
          </div>
        ) : (
          <div style={{ padding: '4px 0' }}>
            {messages.map((msg) => {
              const isBroadcast = msg.to === '*';
              return (
                <div
                  key={msg.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-elevated)',
                    marginBottom: '1px',
                  }}
                >
                  {/* Header: [From -> To] + timestamp */}
                  <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <span style={{ color: 'var(--fg-muted)' }}>[</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{msg.from}</span>
                      <span style={{ color: 'var(--fg-muted)' }}>{' \u2192 '}</span>
                      <span style={{ color: isBroadcast ? 'var(--accent-cyan)' : '#10b981', fontWeight: 600 }}>
                        {isBroadcast ? 'all' : msg.to}
                      </span>
                      <span style={{ color: 'var(--fg-muted)' }}>]</span>
                      {msg.topic && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '1px 6px',
                          fontSize: '9px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent-cyan)',
                          border: '1px solid var(--accent-cyan-muted)',
                          background: 'var(--accent-cyan-muted)',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                        }}>
                          {msg.topic}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--fg-secondary)',
                      flexShrink: 0,
                      marginLeft: '8px',
                    }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  {/* Message content */}
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--fg-primary)',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.payload}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Send message form */}
      <div
        className="flex items-center gap-2 mt-2 border"
        style={{
          padding: '8px',
          borderColor: 'var(--border-color)',
          background: 'var(--bg-secondary)',
        }}
      >
        {/* Recipient dropdown */}
        <select
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--fg-primary)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            padding: '4px 8px',
            cursor: 'pointer',
            outline: 'none',
            flexShrink: 0,
          }}
        >
          <option value="broadcast">Broadcast</option>
          {otherAgents.map((a) => (
            <option key={a.name} value={a.name}>{a.name}</option>
          ))}
        </select>

        {/* Message input */}
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--fg-primary)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            padding: '4px 8px',
            outline: 'none',
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || !messageText.trim()}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: sending || !messageText.trim() ? 'var(--fg-muted)' : 'var(--accent-emerald)',
            background: 'transparent',
            border: `1px solid ${sending || !messageText.trim() ? 'var(--fg-muted)' : 'var(--accent-emerald)'}`,
            padding: '4px 12px',
            cursor: sending || !messageText.trim() ? 'default' : 'pointer',
            opacity: sending || !messageText.trim() ? 0.3 : 1,
            flexShrink: 0,
          }}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Separator */}
      <div style={{ height: '1px', background: 'var(--border-color)', marginTop: '16px' }} />
    </div>
  );
}

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

      {/* Agent cards — responsive columns based on count */}
      <div className="grid gap-3 mb-4" style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${fleetStatus.agents.length <= 4 ? '240px' : '180px'}, 1fr))`,
      }}>
        {fleetStatus.agents.map((agent) => {
          const isActive = activeAgent?.toLowerCase() === agent.name.toLowerCase();
          const regAgent = registeredAgents?.find(a => a.name.toLowerCase() === agent.name.toLowerCase());
          const isRemote = regAgent?.type === 'remote';
          return (
            <button
              key={agent.name}
              onClick={() => setActiveAgent(agent.name)}
              className="p-3 border text-left transition-colors"
              style={{
                background: isActive ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                borderColor: isActive ? (isRemote ? 'var(--accent-cyan)' : 'var(--accent-emerald)') : 'var(--border-color)',
                cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-2">
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: agent.status === 'running' ? '#10b981' : agent.status === 'error' ? '#ef4444' : '#6b7280',
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                  color: isActive ? (isRemote ? 'var(--accent-cyan)' : 'var(--accent-emerald)') : 'var(--fg-primary)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {agent.name}
                </span>
                {isRemote && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '7px', letterSpacing: '0.5px',
                    textTransform: 'uppercase', color: '#22d3ee',
                    border: '1px solid #22d3ee', padding: '0px 3px', lineHeight: '14px',
                  }}>
                    REMOTE
                  </span>
                )}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: isRemote ? (agent.status === 'running' ? '#22d3ee' : statusColor(agent.status)) : statusColor(agent.status),
                  marginLeft: 'auto',
                }}>
                  {isRemote ? (agent.status === 'running' ? 'remote' : agent.status) : agent.status}
                </span>
                {!isRemote && agent.uptime && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)' }}>
                    {agent.uptime}
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
              textTransform: 'uppercase', color: '#22d3ee',
              border: '1px solid #22d3ee', padding: '1px 5px', lineHeight: '14px',
            }}>
              REMOTE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className="text-[9px] tracking-[1px] uppercase" style={{
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
              <div className="text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>{(health.channels || []).filter(c => c.connected).length}/{(health.channels || []).length}</div>
            </div>
            <div className="p-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="text-[9px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>PID</div>
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
              <span className="text-[9px] tracking-[1px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
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
                  className="px-3 py-1 text-[9px] tracking-[1px] uppercase border transition-colors"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    borderColor: isRunning || isStarting || isStopping || selectedFleetAgents.size === 0 ? 'var(--fg-muted)' : 'var(--accent-cyan)',
                    color: isRunning || isStarting || isStopping || selectedFleetAgents.size === 0 ? 'var(--fg-muted)' : 'var(--accent-cyan)',
                    background: 'transparent',
                    cursor: isRunning || isStarting || isStopping || selectedFleetAgents.size === 0 ? 'default' : 'pointer',
                    opacity: isRunning || isStarting || isStopping || selectedFleetAgents.size === 0 ? 0.3 : 1,
                  }}
                >
                  Start Fleet ({selectedFleetAgents.size})
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
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
                <div key={agent.name} className="flex items-center justify-between p-2 border" style={{ background: 'var(--bg-secondary)', borderColor: isSelected ? 'rgba(34,211,238,0.2)' : 'var(--border-color)' }}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={toggleSelect}
                      style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                    />
                    <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: isSelected ? 'var(--fg-primary)' : 'var(--fg-muted)' }}>{agent.name}</span>
                    {agent.type === 'remote' && (
                      <span style={{ fontSize: '7px', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#22d3ee', border: '1px solid #22d3ee', padding: '0px 3px', fontFamily: 'var(--font-mono)', lineHeight: '12px' }}>REMOTE</span>
                    )}
                    <span className="text-[9px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
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
              );
            })}
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
