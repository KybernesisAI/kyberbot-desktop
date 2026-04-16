/**
 * Orchestration Run Detail — modal showing full heartbeat run info.
 * Polls for updates when the run is still executing.
 */

import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import Modal from '../shared/Modal';
import type { OrchHeartbeatRun } from './types';

interface Props {
  run: OrchHeartbeatRun;
  onClose: () => void;
}

interface ToolCall {
  name?: string;
  params?: Record<string, unknown>;
  result?: unknown;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) {
    // Show elapsed time for running
    const ms = Date.now() - new Date(start + 'Z').getTime();
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s elapsed`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s elapsed`;
  }
  const ms = new Date(end + 'Z').getTime() - new Date(start + 'Z').getTime();
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function parseToolCalls(json: string | null): ToolCall[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Parse JSONL stream-json output into readable transcript entries.
 */
function parseStreamLog(raw: string): string {
  if (!raw) return '';
  const lines = raw.split('\n').filter(l => l.trim());
  const parts: string[] = [];

  for (const line of lines) {
    try {
      const event = JSON.parse(line.trim());

      if (event.type === 'system' && event.subtype === 'init') {
        parts.push(`[INIT] cwd: ${event.cwd} | model: ${event.model} | mode: ${event.permissionMode}`);
      } else if (event.type === 'system' && event.subtype === 'hook_started') {
        // Skip hook noise
      } else if (event.type === 'system' && event.subtype === 'hook_response') {
        // Skip hook noise
      } else if (event.type === 'assistant') {
        const msg = event.message;
        if (msg?.content) {
          for (const block of msg.content) {
            if (block.type === 'thinking') {
              // Show first 500 chars of thinking
              const thinking = block.thinking || '';
              parts.push(`[THINKING] ${thinking.slice(0, 500)}${thinking.length > 500 ? '...' : ''}`);
            } else if (block.type === 'text') {
              parts.push(`[OUTPUT] ${block.text}`);
            } else if (block.type === 'tool_use') {
              const params = block.input ? JSON.stringify(block.input).slice(0, 200) : '';
              parts.push(`[TOOL] ${block.name}(${params}${params.length >= 200 ? '...' : ''})`);
            }
          }
        }
      } else if (event.type === 'tool_result' || event.type === 'user') {
        const msg = event.message;
        if (msg?.content) {
          for (const block of msg.content) {
            if (block.type === 'tool_result') {
              const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
              parts.push(`[RESULT] ${(content || '').slice(0, 300)}${(content || '').length > 300 ? '...' : ''}`);
            }
          }
        }
      } else if (event.type === 'result') {
        parts.push(`[DONE] ${event.subtype || 'success'} | ${event.num_turns || 0} turns | ${event.duration_ms ? Math.round(event.duration_ms / 1000) + 's' : ''} | cost: $${event.total_cost_usd?.toFixed(4) || '?'}`);
        if (event.result) {
          parts.push(`[FINAL] ${event.result.slice(0, 500)}`);
        }
      }
    } catch {
      // Not valid JSON — show raw line
      if (line.trim()) parts.push(line.trim());
    }
  }

  return parts.join('\n');
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  failed: '#ef4444',
  running: '#22d3ee',
};

const TYPE_COLORS: Record<string, string> = {
  orchestration: 'var(--accent-teal)',
  worker: 'var(--accent-cyan)',
};

const labelStyle: React.CSSProperties = {
  fontSize: '9px', fontFamily: 'var(--font-mono)',
  color: 'var(--fg-muted)', textTransform: 'uppercase',
  letterSpacing: '1px', marginBottom: '4px', display: 'block',
};

const valueStyle: React.CSSProperties = {
  fontSize: '11px', fontFamily: 'var(--font-mono)',
  color: 'var(--fg-primary)',
};

export default function OrchRunDetail({ run: initialRun, onClose }: Props) {
  const { baseServerUrl, apiToken } = useApp();
  const [run, setRun] = useState(initialRun);
  const [elapsed, setElapsed] = useState('');
  const [liveLog, setLiveLog] = useState('');
  const logOffsetRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const logScrollRef = useRef<HTMLDivElement>(null);

  const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}) };

  // Poll for run status + stream log when executing
  useEffect(() => {
    const poll = async () => {
      try {
        // Poll run status
        const runRes = await fetch(`${baseServerUrl}/fleet/orch/runs/${run.id}`, { headers });
        if (runRes.ok) {
          const data = await runRes.json();
          if (data.run) setRun(data.run);
        }

        // Stream log with offset
        const logRes = await fetch(`${baseServerUrl}/fleet/orch/runs/${run.id}/log?offset=${logOffsetRef.current}`, { headers });
        if (logRes.ok) {
          const logData = await logRes.json();
          if (logData.content) {
            setLiveLog(prev => prev + logData.content);
            logOffsetRef.current = logData.totalBytes;
            // Auto-scroll to bottom
            if (logScrollRef.current) {
              logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
            }
          }
        }
      } catch { /* ignore */ }
    };

    poll(); // Initial fetch
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [run.id, baseServerUrl, apiToken]);

  // Live elapsed timer for running runs
  useEffect(() => {
    if (run.status !== 'running') {
      setElapsed('');
      return;
    }
    const update = () => setElapsed(formatDuration(run.started_at, null));
    update();
    tickRef.current = setInterval(update, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [run.status, run.started_at]);

  const toolCalls = parseToolCalls(run.tool_calls_json);

  return (
    <Modal title="Heartbeat Run" onClose={onClose} width={560}>
      {/* Metadata grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <span style={labelStyle}>Agent</span>
          <span style={valueStyle}>{run.agent_name}</span>
        </div>
        <div>
          <span style={labelStyle}>Type</span>
          <span style={{
            fontSize: '10px', fontFamily: 'var(--font-mono)',
            padding: '2px 8px', background: TYPE_COLORS[run.type] || 'var(--fg-muted)',
            color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {run.type}
          </span>
        </div>
        <div>
          <span style={labelStyle}>Status</span>
          <span style={{
            fontSize: '10px', fontFamily: 'var(--font-mono)',
            padding: '2px 8px', background: STATUS_COLORS[run.status] || 'var(--fg-muted)',
            color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {run.status}
          </span>
        </div>
        <div>
          <span style={labelStyle}>Duration</span>
          <span style={valueStyle}>{run.status === 'running' ? elapsed : formatDuration(run.started_at, run.finished_at)}</span>
        </div>
        <div>
          <span style={labelStyle}>Started</span>
          <span style={valueStyle}>{new Date(run.started_at + 'Z').toLocaleString()}</span>
        </div>
        <div>
          <span style={labelStyle}>Finished</span>
          <span style={valueStyle}>{run.finished_at ? new Date(run.finished_at + 'Z').toLocaleString() : '--'}</span>
        </div>
      </div>

      {/* Result summary */}
      {run.result_summary && (
        <div style={{ marginBottom: '20px' }}>
          <span style={labelStyle}>Result Summary</span>
          <div style={{
            padding: '10px 12px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            fontSize: '11px', fontFamily: 'var(--font-mono)',
            color: 'var(--fg-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.5',
          }}>
            {run.result_summary}
          </div>
        </div>
      )}

      {/* Tool calls */}
      {toolCalls.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <span style={labelStyle}>Tool Calls ({toolCalls.length})</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {toolCalls.map((tc, i) => (
              <div key={i} style={{
                padding: '10px 12px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{
                  fontSize: '11px', fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-cyan)', marginBottom: '6px',
                }}>
                  {tc.name || `tool_call_${i}`}
                </div>
                {tc.params && Object.keys(tc.params).length > 0 && (
                  <pre style={{
                    fontSize: '10px', fontFamily: 'var(--font-mono)',
                    color: 'var(--fg-secondary)', margin: 0,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {JSON.stringify(tc.params, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Log */}
      <div style={{ marginBottom: '20px' }}>
        <span style={labelStyle}>
          Session Log
          {run.status === 'running' && <span style={{ color: 'var(--accent-cyan)', marginLeft: '8px' }}>LIVE</span>}
        </span>
        <div
          ref={logScrollRef}
          style={{
            marginTop: '8px', padding: '12px', background: 'var(--bg-secondary)',
            border: `1px solid ${run.status === 'running' ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
            maxHeight: '400px', overflowY: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: '11px',
            color: 'var(--fg-secondary)', lineHeight: '1.5',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {parseStreamLog(liveLog || run.log_output || '') || (run.status === 'running' ? 'Waiting for output...' : 'No log output captured.')}
        </div>
      </div>

      {/* Error */}
      {run.error && (
        <div>
          <span style={labelStyle}>Error</span>
          <div style={{
            padding: '10px 12px', background: 'rgba(239,68,68,0.1)',
            border: '1px solid #ef4444',
            fontSize: '11px', fontFamily: 'var(--font-mono)',
            color: '#ef4444', whiteSpace: 'pre-wrap', lineHeight: '1.5',
          }}>
            {run.error}
          </div>
        </div>
      )}
    </Modal>
  );
}
