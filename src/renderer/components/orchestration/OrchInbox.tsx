/**
 * Human Inbox — escalations needing human attention.
 * Resolve with a response message that gets posted as a comment on the related issue.
 */

import { useState } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchInboxItem } from './types';
import Modal from '../shared/Modal';

interface Props {
  orch: UseOrchResult;
  onOpenIssue: (id: number) => void;
}

function ResolveModal({ item, orch, onClose }: { item: OrchInboxItem; orch: UseOrchResult; onClose: () => void }) {
  const [response, setResponse] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    try {
      // Post response as comment on the related issue, @mentioning the source agent
      if (response.trim() && item.related_issue_id) {
        const text = response.trim().includes('@') ? response.trim() : `@${item.source_agent} ${response.trim()}`;
        await orch.addComment(item.related_issue_id, text);
      }
      await orch.resolveInboxItem(item.id);
      onClose();
    } finally { setResolving(false); }
  };

  return (
    <Modal title="Resolve Escalation" onClose={onClose} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
          {item.title}
        </div>
        {item.body && (
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
            {item.body}
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Your Response {item.related_issue_id ? '(will be posted as a comment on the issue)' : ''}
          </label>
          <textarea
            value={response}
            onChange={e => setResponse(e.target.value)}
            autoFocus
            placeholder="What did you do? What should the agent know?"
            rows={3}
            style={{
              width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              color: 'var(--fg-primary)', padding: '8px 10px', outline: 'none', resize: 'none',
            }}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleResolve} disabled={resolving} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'var(--accent-teal)', color: '#ffffff', border: 'none', cursor: 'pointer', opacity: resolving ? 0.35 : 1 }}>
            {resolving ? 'Resolving...' : 'Resolve'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function OrchInbox({ orch, onOpenIssue }: Props) {
  const { inboxItems, loading } = orch;
  const [resolvingItem, setResolvingItem] = useState<OrchInboxItem | null>(null);

  if (loading) return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;

  if (inboxItems.length === 0) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>Inbox is clear</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', padding: 16 }}>
      <span className="section-title" style={{ color: 'var(--accent-teal)' }}>{'// INBOX'}</span>
      <div className="mt-3" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {inboxItems.map(item => {
          const urgencyIcon = item.urgency === 'high' ? '🔴' : item.urgency === 'normal' ? '🟡' : '🔵';
          return (
            <div key={item.id} style={{ padding: '12px 14px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span>{urgencyIcon}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>
                    {item.title}
                  </span>
                </div>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                  {new Date(item.created_at + 'Z').toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  from {item.source_agent}
                </span>
                {item.related_issue_id && (
                  <span
                    onClick={() => onOpenIssue(item.related_issue_id!)}
                    style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    KYB-{item.related_issue_id}
                  </span>
                )}
              </div>

              {item.body && (
                <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)', lineHeight: '1.5', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                  {item.body}
                </p>
              )}

              <div className="flex gap-2">
                {item.related_issue_id && (
                  <button
                    onClick={() => onOpenIssue(item.related_issue_id!)}
                    style={{
                      fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
                      padding: '4px 12px', background: 'transparent', border: '1px solid var(--accent-teal)',
                      color: 'var(--accent-teal)', cursor: 'pointer',
                    }}
                  >
                    View Issue
                  </button>
                )}
                <button
                  onClick={() => setResolvingItem(item)}
                  style={{
                    fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
                    padding: '4px 12px', background: 'var(--accent-teal)', border: 'none',
                    color: '#ffffff', cursor: 'pointer',
                  }}
                >
                  Resolve
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {resolvingItem && (
        <ResolveModal item={resolvingItem} orch={orch} onClose={() => setResolvingItem(null)} />
      )}
    </div>
  );
}
