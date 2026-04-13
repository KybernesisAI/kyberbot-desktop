/**
 * Bug Report Modal — sends report + logs to kybernesis.ai webhook which creates a Linear issue.
 */

import { useState, useEffect } from 'react';

const BUG_REPORT_URL = 'https://kybernesis.ai/api/bug-report';

interface BugReportModalProps {
  logs: string;
  appVersion: string;
  agentName: string;
  onClose: () => void;
}

export default function BugReportModal({ logs, appVersion, agentName, onClose }: BugReportModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; issueId?: string; issueUrl?: string; error?: string } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const submit = async () => {
    if (!title.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(BUG_REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          logs,
          appVersion,
          agentName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, issueId: data.issueId, issueUrl: data.issueUrl });
      } else {
        setResult({ success: false, error: data.error || 'Failed to submit report' });
      }
    } catch (err) {
      setResult({ success: false, error: 'Network error — could not reach the server' });
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '12px',
    background: 'var(--bg-tertiary)', color: 'var(--fg-primary)',
    border: '1px solid var(--border-color)', outline: 'none',
    width: '100%', padding: '8px 10px',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: '540px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span className="section-title" style={{ color: 'var(--accent-emerald)' }}>{'// SEND BUG REPORT'}</span>
          <button onClick={onClose} style={{ fontSize: '18px', color: 'var(--fg-muted)', background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {result ? (
          // Result state
          <div>
            {result.success ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '12px', border: '1px solid var(--accent-emerald)', background: 'rgba(16,185,129,0.05)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>Bug report submitted successfully</div>
                  {result.issueId && (
                    <div style={{ fontSize: '11px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-mono)' }}>
                      Issue: {result.issueId}
                    </div>
                  )}
                </div>
                <button onClick={onClose} style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                  background: 'var(--accent-emerald)', color: '#ffffff', border: '1px solid var(--accent-emerald)',
                  padding: '8px 12px', cursor: 'pointer',
                }}>
                  Close
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '12px', border: '1px solid var(--status-error)', background: 'rgba(239,68,68,0.05)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--status-error)', fontFamily: 'var(--font-mono)' }}>{result.error}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setResult(null)} style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                    background: 'transparent', color: 'var(--fg-secondary)', border: '1px solid var(--border-color)',
                    padding: '8px 12px', cursor: 'pointer',
                  }}>
                    Try Again
                  </button>
                  <button onClick={onClose} style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                    background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)',
                    padding: '8px 12px', cursor: 'pointer',
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Form state
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '12px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              Describe the issue. Current log output will be attached automatically.
            </p>
            <div>
              <label style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of the bug"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <label style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Details (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Steps to reproduce, what you expected, what happened..."
                rows={4}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              {logs.length > 0 ? `${logs.split('\n').length} log lines will be attached` : 'No log output to attach'}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                background: 'transparent', color: 'var(--fg-secondary)', border: '1px solid var(--border-color)',
                padding: '8px 12px', cursor: 'pointer',
              }}>
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!title.trim() || sending}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                  background: (!title.trim() || sending) ? 'var(--fg-muted)' : 'var(--accent-emerald)',
                  color: '#ffffff', border: 'none',
                  padding: '8px 12px', cursor: (!title.trim() || sending) ? 'default' : 'pointer',
                  opacity: (!title.trim() || sending) ? 0.4 : 1,
                }}
              >
                {sending ? 'Sending...' : 'Send Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
