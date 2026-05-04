/**
 * Human Inbox — two tabs:
 *   - Action Required: escalations needing user input (kind='needs_action')
 *   - Completed: FYI notifications of finished tasks with their artifacts
 *     (kind='completed')
 * Auto-acknowledge happens on the server when an item is opened, so the
 * "pending" badge clears after a click.
 */

import { useState } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchInboxItem, OrchInboxItemWithArtifacts } from './types';
import Modal from '../shared/Modal';
import ActionButton from '../shared/ActionButton';

interface Props {
  orch: UseOrchResult;
  onOpenIssue: (id: number) => void;
}

type Tab = 'action' | 'completed';

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

function fileBasename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

function CompletedItemCard({
  item,
  onOpenIssue,
  onOpenArtifact,
  onDismiss,
}: {
  item: OrchInboxItemWithArtifacts;
  onOpenIssue: (id: number) => void;
  onOpenArtifact: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUnread = item.status === 'pending';
  return (
    <div style={{ padding: '12px 14px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', opacity: isUnread ? 1 : 0.85 }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span role="img" aria-label="completed">✓</span>
          {isUnread && (
            <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', padding: '1px 6px', color: '#ffffff', background: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '1px' }}>NEW</span>
          )}
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
          by {item.source_agent}
        </span>
        {item.related_issue_id && (
          <span
            onClick={() => onOpenIssue(item.related_issue_id!)}
            style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            KYB-{item.related_issue_id}
          </span>
        )}
        {item.artifacts.length > 0 && (
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
            · {item.artifacts.length} artifact{item.artifacts.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {item.body && (
        <div
          onClick={() => setExpanded(e => !e)}
          style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)', lineHeight: '1.5',
            marginBottom: '8px', whiteSpace: 'pre-wrap', cursor: 'pointer',
            maxHeight: expanded ? 'none' : '90px', overflow: 'hidden',
            position: 'relative',
          }}
          title={expanded ? 'click to collapse' : 'click to expand'}
        >
          {item.body}
          {!expanded && item.body.length > 200 && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '32px',
              background: 'linear-gradient(to bottom, transparent, var(--bg-secondary))',
              pointerEvents: 'none',
            }} />
          )}
        </div>
      )}

      {item.artifacts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
          <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Deliverables
          </div>
          {item.artifacts.map(a => (
            <div
              key={a.id}
              onClick={() => onOpenArtifact(a.id)}
              style={{
                fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)',
                padding: '3px 6px', cursor: 'pointer', borderLeft: '2px solid var(--accent-cyan)',
              }}
              title={a.file_path}
            >
              {fileBasename(a.file_path)}
              {a.description && (
                <span style={{ color: 'var(--fg-muted)', marginLeft: '8px' }}>— {a.description.slice(0, 80)}</span>
              )}
            </div>
          ))}
        </div>
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
          onClick={() => onDismiss(item.id)}
          label="Dismiss"
          variant="outline"
          style={{ fontSize: '9px', padding: '3px 10px' }}
        />
      </div>
    </div>
  );
}

export default function OrchInbox({ orch, onOpenIssue }: Props) {
  const {
    inboxItems, archivedInboxItems, loading, dismissInboxItem, dismissAllInbox,
    completedItems, completedPendingCount, loadArtifactContent,
  } = orch;
  const [resolvingItem, setResolvingItem] = useState<OrchInboxItem | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [tab, setTab] = useState<Tab>('action');

  if (loading) return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;

  const handleOpenArtifact = async (id: number) => {
    try {
      const content = await loadArtifactContent(id);
      // Quick preview via window.open with a data URL — falls back gracefully
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error('Failed to load artifact', err);
    }
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '8px 14px',
    background: active ? 'var(--bg-secondary)' : 'transparent',
    color: active ? 'var(--accent-teal)' : 'var(--fg-muted)',
    border: 'none', borderBottom: active ? '2px solid var(--accent-teal)' : '2px solid transparent',
    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
  });

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div className="flex items-center justify-between px-4 py-1 border-b" style={{ borderColor: 'var(--border-color)', minHeight: '52px' }}>
        <div className="flex items-center">
          <button onClick={() => setTab('action')} style={tabBtnStyle(tab === 'action')}>
            // Action Required {inboxItems.length > 0 && `(${inboxItems.length})`}
          </button>
          <button onClick={() => setTab('completed')} style={tabBtnStyle(tab === 'completed')}>
            // Completed {completedPendingCount > 0 && `(${completedPendingCount})`}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'action' && inboxItems.length > 0 && (
            <ActionButton
              onClick={dismissAllInbox}
              label="Dismiss All"
              variant="outline"
              style={{ fontSize: '11px', padding: '8px 16px' }}
            />
          )}
        </div>
      </div>

      {/* ── Action Required tab ───────────────────────────────────── */}
      {tab === 'action' && (
        <>
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
                          <span role="img" aria-label={`${item.urgency} urgency`}>{urgencyIcon}</span>
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

          {/* Archive toggle (action-required items only) */}
          <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={() => setShowArchive(!showArchive)}
              style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              {showArchive ? '▼ Hide Archive' : '▶ Show Archive'} ({archivedInboxItems.length})
            </button>
          </div>

          {showArchive && archivedInboxItems.length > 0 && (
            <div style={{ overflow: 'auto', maxHeight: '300px', padding: '0 16px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {archivedInboxItems.map(item => (
                  <div key={item.id} style={{ padding: '8px 12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', opacity: 0.6 }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 6px', color: '#ffffff', background: item.status === 'resolved' ? '#10b981' : 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          {item.status}
                        </span>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>
                          {item.title}
                        </span>
                      </div>
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                        {new Date(item.created_at + 'Z').toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginTop: '2px' }}>
                      from {item.source_agent}
                      {item.resolved_by && ` · resolved by ${item.resolved_by}`}
                      {item.resolved_at && ` · ${new Date(item.resolved_at + 'Z').toLocaleString()}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Completed tab ────────────────────────────────────────── */}
      {tab === 'completed' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {completedItems.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                No completed tasks yet — agents will post here when they finish work.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {completedItems.map(item => (
                <CompletedItemCard
                  key={item.id}
                  item={item}
                  onOpenIssue={onOpenIssue}
                  onOpenArtifact={handleOpenArtifact}
                  onDismiss={dismissInboxItem}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {resolvingItem && (
        <ResolveModal item={resolvingItem} orch={orch} onClose={() => setResolvingItem(null)} />
      )}
    </div>
  );
}
