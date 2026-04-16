/**
 * Orchestration Run Detail — modal showing full heartbeat run info.
 */

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
  if (!end) return 'In progress...';
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

export default function OrchRunDetail({ run, onClose }: Props) {
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
            color: '#ffffff', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {run.type}
          </span>
        </div>
        <div>
          <span style={labelStyle}>Status</span>
          {run.status === 'running' ? (
            <span style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)',
              padding: '2px 8px', background: STATUS_COLORS.running,
              color: '#ffffff', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
              animation: 'pulse-slow 1.5s ease-in-out infinite',
            }}>
              running
            </span>
          ) : (
            <span style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)',
              padding: '2px 8px', background: STATUS_COLORS[run.status] || 'var(--fg-muted)',
              color: '#ffffff', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {run.status}
            </span>
          )}
        </div>
        <div>
          <span style={labelStyle}>Duration</span>
          <span style={valueStyle}>{formatDuration(run.started_at, run.finished_at)}</span>
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

      {/* Prompt summary */}
      {run.prompt_summary && (
        <div style={{ marginBottom: '20px' }}>
          <span style={labelStyle}>Prompt Summary</span>
          <div style={{
            padding: '10px 12px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            fontSize: '11px', fontFamily: 'var(--font-mono)',
            color: 'var(--fg-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.5',
          }}>
            {run.prompt_summary}
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
                  color: 'var(--accent-cyan)', fontWeight: 500, marginBottom: '6px',
                }}>
                  {tc.name || `tool_call_${i}`}
                </div>
                {tc.params && Object.keys(tc.params).length > 0 && (
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ ...labelStyle, fontSize: '8px' }}>Params</span>
                    <pre style={{
                      fontSize: '10px', fontFamily: 'var(--font-mono)',
                      color: 'var(--fg-secondary)', margin: 0,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}>
                      {JSON.stringify(tc.params, null, 2)}
                    </pre>
                  </div>
                )}
                {tc.result !== undefined && tc.result !== null && (
                  <div>
                    <span style={{ ...labelStyle, fontSize: '8px' }}>Result</span>
                    <pre style={{
                      fontSize: '10px', fontFamily: 'var(--font-mono)',
                      color: 'var(--fg-secondary)', margin: 0,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}>
                      {typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Log */}
      {run.status === 'running' && (
        <div style={{ marginBottom: '20px' }}>
          <span style={labelStyle}>Session Log</span>
          <div style={{
            marginTop: '8px', padding: '12px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            fontSize: '11px', fontFamily: 'var(--font-mono)',
            color: 'var(--fg-muted)', fontStyle: 'italic',
          }}>
            Agent is currently executing...
          </div>
        </div>
      )}
      {run.log_output && (
        <div style={{ marginBottom: '20px' }}>
          <span style={labelStyle}>Session Log</span>
          <div style={{
            marginTop: '8px', padding: '12px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)', maxHeight: '400px', overflowY: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--fg-secondary)',
            lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {run.log_output}
          </div>
        </div>
      )}

      {/* Error */}
      {run.error && (
        <div>
          <span style={labelStyle}>Error</span>
          <div style={{
            padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)',
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
