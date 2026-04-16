/**
 * Issue Detail — right slide-over panel.
 * Shows issue metadata, description, comment thread, and supports editing.
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { IssuePriority, IssueStatus } from './types';
import { PRIORITY_COLORS } from './types';

interface Props {
  issueId: number;
  orch: UseOrchResult;
  onClose: () => void;
}

export default function OrchIssueDetail({ issueId, orch, onClose }: Props) {
  const { issues, issueComments, loadIssueComments, addComment, updateIssue, moveIssue, fleetAgentNames, projects } = orch;
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<IssuePriority>('medium');
  const [editAssignee, setEditAssignee] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editStatus, setEditStatus] = useState<IssueStatus>('todo');
  const [saving, setSaving] = useState(false);

  const issue = issues.find(i => i.id === issueId);

  useEffect(() => {
    loadIssueComments(issueId);
  }, [issueId, loadIssueComments]);

  useEffect(() => {
    if (issue) {
      setEditTitle(issue.title);
      setEditDesc(issue.description || '');
      setEditPriority(issue.priority);
      setEditAssignee(issue.assigned_to || '');
      setEditProjectId(String(issue.project_id || ''));
      setEditStatus(issue.status);
      setEditing(false);
    }
  }, [issueId]);

  if (!issue) return null;

  const handleSend = async () => {
    if (!commentText.trim() || sending) return;
    setSending(true);
    try {
      // Auto-prepend @assignee if the comment doesn't already mention anyone
      let text = commentText.trim();
      if (issue.assigned_to && !text.includes('@')) {
        text = `@${issue.assigned_to} ${text}`;
      }
      await addComment(issueId, text);
      setCommentText('');
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateIssue(issueId, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        priority: editPriority,
        assigned_to: editAssignee || undefined,
        project_id: editProjectId ? parseInt(editProjectId) : null,
      } as any);
      // Handle status change separately via transition
      if (editStatus !== issue.status) {
        try { await moveIssue(issueId, editStatus); } catch { /* invalid transition */ }
      }
      setEditing(false);
    } finally { setSaving(false); }
  };

  const inputStyle = {
    width: '100%', fontSize: '11px', fontFamily: 'var(--font-mono)',
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
    color: 'var(--fg-primary)', padding: '6px 8px', outline: 'none',
  };
  const labelStyle = {
    fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)',
    width: '60px', textTransform: 'uppercase' as const, letterSpacing: '1px', flexShrink: 0,
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: '420px',
      background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-color)',
      display: 'flex', flexDirection: 'column', zIndex: 10,
      boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>
          Issue KYB-{issue.id}
        </span>
        <div className="flex items-center gap-2">
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 10px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
              Edit
            </button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: '4px' }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {editing ? (
          /* Edit mode */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <span style={labelStyle}>Title</span>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ ...inputStyle, marginTop: '4px' }} />
            </div>
            <div>
              <span style={labelStyle}>Description</span>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} style={{ ...inputStyle, marginTop: '4px', resize: 'none' }} />
            </div>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Status</span>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value as IssueStatus)} style={{ ...inputStyle, marginTop: '4px' }}>
                  <option value="backlog">Backlog</option>
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Priority</span>
                <select value={editPriority} onChange={e => setEditPriority(e.target.value as IssuePriority)} style={{ ...inputStyle, marginTop: '4px' }}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Assignee</span>
                <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)} style={{ ...inputStyle, marginTop: '4px' }}>
                  <option value="">Unassigned</option>
                  {fleetAgentNames.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Project</span>
                <select value={editProjectId} onChange={e => setEditProjectId(e.target.value)} style={{ ...inputStyle, marginTop: '4px' }}>
                  <option value="">No project</option>
                  {projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: '4px' }}>
              <button onClick={() => setEditing(false)} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '6px 14px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '6px 14px', background: 'var(--accent-teal)', color: '#ffffff', border: 'none', cursor: 'pointer', opacity: saving ? 0.35 : 1 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          /* View mode */
          <>
            <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', marginBottom: '12px', lineHeight: '1.4' }}>
              {issue.title}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              <div className="flex items-center gap-2">
                <span style={labelStyle}>Status</span>
                <span style={{
                  fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '1px',
                  border: '1px solid var(--border-color)', color: issue.status === 'done' ? '#10b981' : issue.status === 'blocked' ? '#ef4444' : 'var(--accent-cyan)',
                }}>
                  {issue.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span style={labelStyle}>Priority</span>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: PRIORITY_COLORS[issue.priority] }}>{issue.priority}</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={labelStyle}>Assignee</span>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{issue.assigned_to || 'unassigned'}</span>
              </div>
              {issue.goal_id && (
                <div className="flex items-center gap-2">
                  <span style={labelStyle}>Goal</span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>#{issue.goal_id}</span>
                </div>
              )}
              {issue.project_id && (
                <div className="flex items-center gap-2">
                  <span style={labelStyle}>Project</span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
                    {projects.find(p => p.id === issue.project_id)?.name || `#${issue.project_id}`}
                  </span>
                </div>
              )}
            </div>

            {issue.description ? (
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Description</span>
                <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)', marginTop: '6px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {issue.description}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', fontStyle: 'italic', marginBottom: '16px' }}>
                No description
              </p>
            )}
          </>
        )}

        {/* Comments (always shown) */}
        <div>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Comments ({issueComments.length})
          </span>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {issueComments.map(comment => (
              <div key={comment.id} style={{ padding: '8px 10px', border: '1px solid var(--border-color)', background: comment.author_agent === 'human' ? 'rgba(20,184,166,0.05)' : 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{
                    fontSize: '10px', fontFamily: 'var(--font-mono)',
                    color: comment.author_agent === 'human' ? 'var(--accent-teal)' : 'var(--accent-cyan)',
                  }}>
                    {comment.author_agent}
                  </span>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                    {new Date(comment.created_at + 'Z').toLocaleString()}
                  </span>
                </div>
                <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {comment.content}
                </p>
              </div>
            ))}
            {issueComments.length === 0 && (
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>No comments yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Comment input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
        <textarea
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSend(); }}
          placeholder="Add a comment..."
          rows={2}
          style={{
            width: '100%', resize: 'none', fontSize: '11px', fontFamily: 'var(--font-mono)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            color: 'var(--fg-primary)', padding: '8px', outline: 'none',
          }}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSend}
            disabled={!commentText.trim() || sending}
            style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
              padding: '6px 16px', cursor: 'pointer',
              background: 'var(--accent-teal)', color: '#ffffff', border: 'none',
              opacity: (!commentText.trim() || sending) ? 0.35 : 1,
            }}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
