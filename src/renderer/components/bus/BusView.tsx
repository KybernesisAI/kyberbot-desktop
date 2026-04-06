/**
 * Bus tab — Inter-agent communication center.
 * Left sidebar: agent list with filters. Main area: message threads. Bottom: send form.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';

interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'query' | 'notify' | 'delegate' | 'response';
  topic?: string;
  payload: string;
  replyTo?: string;
  timestamp: string;
}

export default function BusView() {
  const { baseServerUrl, apiToken, fleetMode, fleetStatus, agents, activeAgent } = useApp();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [recipient, setRecipient] = useState<string>('broadcast');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [filterTopic, setFilterTopic] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
  }), [apiToken]);

  // Fetch bus history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${baseServerUrl}/fleet/bus/history?limit=100`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch { /* bus not available */ }
  }, [baseServerUrl, headers]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5_000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Send
  const handleSend = async () => {
    if (!messageText.trim() || !activeAgent) return;
    setSending(true);
    try {
      const isBroadcast = recipient === 'broadcast';
      const endpoint = isBroadcast
        ? `${baseServerUrl}/fleet/bus/broadcast`
        : `${baseServerUrl}/fleet/bus/send`;
      const body = isBroadcast
        ? { from: activeAgent, message: messageText.trim() }
        : { from: activeAgent, to: recipient, message: messageText.trim() };

      await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      setMessageText('');
      await fetchHistory();
    } catch { /* failed */ }
    finally { setSending(false); }
  };

  // Extract unique topics and agent names from messages
  const topics = useMemo(() => {
    const set = new Set<string>();
    messages.forEach(m => { if (m.topic) set.add(m.topic); });
    return [...set].sort();
  }, [messages]);

  const agentNames = useMemo(() => {
    const set = new Set<string>();
    messages.forEach(m => { set.add(m.from); if (m.to !== '*') set.add(m.to); });
    return [...set].sort();
  }, [messages]);

  // Filter messages
  const filtered = useMemo(() => {
    let result = messages;
    if (filterAgent) {
      result = result.filter(m => m.from === filterAgent || m.to === filterAgent);
    }
    if (filterTopic) {
      result = result.filter(m => m.topic === filterTopic);
    }
    return result;
  }, [messages, filterAgent, filterTopic]);

  // Group messages into conversations (message + response pairs)
  const grouped = useMemo(() => {
    const pairs: { message: AgentMessage; response?: AgentMessage }[] = [];
    const responseMap = new Map<string, AgentMessage>();
    for (const m of filtered) {
      if (m.replyTo) responseMap.set(m.replyTo, m);
    }
    for (const m of filtered) {
      if (!m.replyTo) {
        pairs.push({ message: m, response: responseMap.get(m.id) });
      }
    }
    return pairs;
  }, [filtered]);

  const otherAgents = agents.filter(a => a.name.toLowerCase() !== activeAgent?.toLowerCase());

  if (!fleetMode) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--fg-muted)', marginBottom: 8 }}>
            Inter-agent communication requires fleet mode.
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-muted)', opacity: 0.6 }}>
            Start the fleet from the Dashboard to enable the Agent Bus.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <div style={{
        width: 200,
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '12px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px',
            textTransform: 'uppercase', color: 'var(--accent-emerald)',
          }}>
            // AGENTS
          </span>
        </div>

        {/* Agent filter list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          <button
            onClick={() => setFilterAgent(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '8px 12px',
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: !filterAgent ? 'var(--accent-emerald)' : 'var(--fg-secondary)',
              background: !filterAgent ? 'var(--bg-tertiary)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            All Agents
          </button>
          {agentNames.map(name => {
            const isActive = filterAgent === name;
            const msgCount = messages.filter(m => m.from === name || m.to === name).length;
            const fleetAgent = fleetStatus?.agents.find(a => a.name.toLowerCase() === name.toLowerCase());
            return (
              <button
                key={name}
                onClick={() => setFilterAgent(isActive ? null : name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  color: isActive ? 'var(--accent-emerald)' : 'var(--fg-secondary)',
                  background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: fleetAgent?.status === 'running' ? '#10b981' : '#6b7280',
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{name}</span>
                {msgCount > 0 && (
                  <span style={{ fontSize: '9px', color: 'var(--fg-muted)' }}>{msgCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Topic filters */}
        {topics.length > 0 && (
          <>
            <div style={{
              padding: '12px',
              borderTop: '1px solid var(--border-color)',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px',
                textTransform: 'uppercase', color: 'var(--accent-cyan)',
              }}>
                // TOPICS
              </span>
            </div>
            <div style={{ overflowY: 'auto', padding: '4px 0', maxHeight: 150 }}>
              <button
                onClick={() => setFilterTopic(null)}
                style={{
                  display: 'block', width: '100%', padding: '6px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  color: !filterTopic ? 'var(--accent-cyan)' : 'var(--fg-muted)',
                  background: !filterTopic ? 'var(--bg-tertiary)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                All Topics
              </button>
              {topics.map(t => (
                <button
                  key={t}
                  onClick={() => setFilterTopic(filterTopic === t ? null : t)}
                  style={{
                    display: 'block', width: '100%', padding: '6px 12px',
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    color: filterTopic === t ? 'var(--accent-cyan)' : 'var(--fg-muted)',
                    background: filterTopic === t ? 'var(--bg-tertiary)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Main message area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px',
            textTransform: 'uppercase', color: 'var(--accent-emerald)',
          }}>
            // AGENT BUS
            {filterAgent && <span style={{ color: 'var(--fg-muted)' }}>{' / '}{filterAgent}</span>}
            {filterTopic && <span style={{ color: 'var(--accent-cyan)' }}>{' / '}{filterTopic}</span>}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)',
          }}>
            {filtered.length} message{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {grouped.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: 'var(--fg-muted)',
            }}>
              {messages.length === 0 ? 'No messages yet — send one below' : 'No messages match filters'}
            </div>
          ) : (
            grouped.map(({ message: msg, response }) => {
              const isBroadcast = msg.to === '*';
              return (
                <div key={msg.id} style={{ marginBottom: 12 }}>
                  {/* Outgoing message */}
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--bg-elevated)',
                    borderLeft: '2px solid #10b981',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>{msg.from}</span>
                        <span style={{ color: 'var(--fg-muted)' }}>{' \u2192 '}</span>
                        <span style={{ color: isBroadcast ? 'var(--accent-cyan)' : '#10b981', fontWeight: 600 }}>
                          {isBroadcast ? 'all agents' : msg.to}
                        </span>
                        {msg.topic && (
                          <span style={{
                            marginLeft: 8, padding: '1px 6px',
                            fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '1px',
                            textTransform: 'uppercase',
                            color: 'var(--accent-cyan)', background: 'rgba(34, 211, 238, 0.1)',
                          }}>
                            {msg.topic}
                          </span>
                        )}
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)' }}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '12px',
                      color: 'var(--fg-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                    }}>
                      {msg.payload}
                    </div>
                  </div>

                  {/* Response */}
                  {response && (
                    <div style={{
                      padding: '10px 14px', marginTop: 2,
                      background: 'var(--bg-secondary)',
                      borderLeft: '2px solid var(--accent-cyan)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{response.from}</span>
                          <span style={{ color: 'var(--fg-muted)' }}>{' replied'}</span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)' }}>
                          {formatTime(response.timestamp)}
                        </span>
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '12px',
                        color: 'var(--fg-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                      }}>
                        {response.payload}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Send form */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-secondary)',
        }}>
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: 'var(--fg-primary)', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)', padding: '6px 8px',
              cursor: 'pointer', outline: 'none', flexShrink: 0,
            }}
          >
            <option value="broadcast">Broadcast</option>
            {otherAgents.map(a => (
              <option key={a.name} value={a.name}>{a.name}</option>
            ))}
          </select>

          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Send as ${activeAgent || 'agent'}...`}
            style={{
              flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px',
              color: 'var(--fg-primary)', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)', padding: '6px 10px', outline: 'none',
            }}
          />

          <button
            onClick={handleSend}
            disabled={sending || !messageText.trim()}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px',
              textTransform: 'uppercase',
              color: sending || !messageText.trim() ? 'var(--fg-muted)' : 'var(--accent-emerald)',
              background: 'transparent',
              border: `1px solid ${sending || !messageText.trim() ? 'var(--fg-muted)' : 'var(--accent-emerald)'}`,
              padding: '6px 14px', cursor: sending || !messageText.trim() ? 'default' : 'pointer',
              opacity: sending || !messageText.trim() ? 0.3 : 1, flexShrink: 0,
            }}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}
