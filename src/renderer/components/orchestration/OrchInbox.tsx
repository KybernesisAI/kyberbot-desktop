/**
 * Human Inbox — escalations needing attention.
 * Dismiss, resolve with response, or view related issues.
 * Shows archived (acknowledged/resolved) items below.
 */

import { useState, useEffect } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchInboxItem } from './types';
import Modal from '../shared/Modal';
import ActionButton from '../shared/ActionButton';

interface Props {
  orch: UseOrchResult;
  onOpenIssue: (id: number) => void;
}

function ResolveModal({ item, orch, onClose }: { item: OrchInboxItem; orch: UseOrchResult; onClose: () => void }) {
  const [response, setResponse] = useState('');

  const handleResolve = async () => {
    if (response.trim() && item.related_issue_id) {
      const text = response.trim().includes('@') ? response.trim() : `@${item.source_agent} ${response.trim()}`;
      await orch.addComment(item.related_issue_id, text);
    }
    await orch.resolveInboxItem(item.id);
    onClose();
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
            Your Response {item.related_issue_id ? '(posted as comment on issue)' : ''}
          </label>
          <textarea
            value={response} onChange={e => setResponse(e.target.value)} autoFocus
            placeholder="What did you do? What should the agent know?"
            rows={3}
            style={{ width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--fg-primary)', padding: '8px 10px', outline: 'none', resize: 'none' }}
          />
        </div>
        <div className="flex justify-end gap-3">
          <ActionButton onClick={onClose} label="Cancel" variant="outline" />
          <ActionButton onClick={handleResolve} label="Resolve" loadingLabel="Resolving" />
        </div>
      </div>
    </Modal>
  );
}

export default function OrchInbox({ orch, onOpenIssue }: Props) {
  const { inboxItems, loading, dismissInboxItem, dismissAllInbox } = orch;
  const [resolvingItem, setResolvingItem] = useState<OrchInboxItem | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archivedItems, setArchivedItems] = useState<OrchInboxItem[]>([]);

  // Fetch archived items when toggled
  useEffect(() => {
    if (!showArchive) return;
    const fetchArchived = async () => {
      try {
        const res = await fetch(`${(orch as any).dashboard ? '' : 'http://localhost:3456'}/fleet/orch/inbox`, {
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        });
        // Fallback: just use empty for now, the main fetch already filters
      } catch { /* ignore */ }
    };
    fetchArchived();
  }, [showArchive]);

  if (loading) return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <span className="section-title" style={{ color: 'var(--accent-teal)' }}>
          {'// INBOX'} {inboxItems.length > 0 && `(${inboxItems.length})`}
        </span>
        <div className="flex items-center gap-2">
          {inboxItems.length > 0 && (
            <ActionButton
              onClick={dismissAllInbox}
              label="Dismiss All"
              variant="outline"
              style={{ fontSize: '9px', padding: '3px 10px' }}
            />
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {inboxItems.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>Inbox is clear</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      <ActionButton
                        onClick={async () => onOpenIssue(item.related_issue_id!)}
                        label="View Issue"
                        variant="outline"
                        style={{ fontSize: '9px', padding: '3px 10px' }}
                      />
                    )}
                    <ActionButton
                      onClick={() => dismissInboxItem(item.id)}
                      label="Dismiss"
                      variant="outline"
                      style={{ fontSize: '9px', padding: '3px 10px' }}
                    />
                    <ActionButton
                      onClick={async () => setResolvingItem(item)}
                      label="Resolve"
                      style={{ fontSize: '9px', padding: '3px 10px' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {resolvingItem && (
        <ResolveModal item={resolvingItem} orch={orch} onClose={() => setResolvingItem(null)} />
      )}
    </div>
  );
}
