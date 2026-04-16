/**
 * Goal Detail Modal — view and edit a goal.
 */

import { useState } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchGoal } from './types';
import Modal from '../shared/Modal';

interface Props {
  goal: OrchGoal;
  orch: UseOrchResult;
  onClose: () => void;
}

export default function OrchGoalDetail({ goal, orch, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description || '');
  const [status, setStatus] = useState(goal.status);
  const [level, setLevel] = useState(goal.level);
  const [owner, setOwner] = useState(goal.owner_agent || '');
  const [projectId, setProjectId] = useState(String(goal.project_id || ''));
  const [saving, setSaving] = useState(false);

  const projectName = goal.project_id ? orch.projects.find(p => p.id === goal.project_id)?.name : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await orch.updateGoal(goal.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        level,
        owner_agent: owner || undefined,
        project_id: projectId ? parseInt(projectId) : null,
      });
      onClose();
    } finally { setSaving(false); }
  };

  const inputStyle = {
    width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)',
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
    color: 'var(--fg-primary)', padding: '8px 10px', outline: 'none',
  };
  const labelStyle = {
    display: 'block' as const, fontSize: '9px', fontFamily: 'var(--font-mono)',
    color: 'var(--fg-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '1px', marginBottom: '6px',
  };

  const statusColor = goal.status === 'completed' ? '#10b981' : goal.status === 'active' ? 'var(--accent-teal)' : goal.status === 'cancelled' ? 'var(--fg-muted)' : '#f59e0b';

  return (
    <Modal title={`Goal #${goal.id}`} onClose={onClose} width={500}>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div className="flex gap-3">
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)} style={inputStyle}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Level</label>
              <select value={level} onChange={e => setLevel(e.target.value as any)} style={inputStyle}>
                <option value="company">Company</option>
                <option value="team">Team</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Owner</label>
              <select value={owner} onChange={e => setOwner(e.target.value)} style={inputStyle}>
                <option value="">None</option>
                {orch.fleetAgentNames.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle}>
              <option value="">No project</option>
              {orch.projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3" style={{ marginTop: '8px' }}>
            <button onClick={() => setEditing(false)} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'var(--accent-teal)', color: '#ffffff', border: 'none', cursor: 'pointer', opacity: saving ? 0.35 : 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', lineHeight: '1.4' }}>
            {goal.title}
          </div>

          <div className="flex items-center gap-3">
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '2px 8px', border: `1px solid ${statusColor}`, color: statusColor }}>
              {goal.status}
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
              {goal.level}
            </span>
            {goal.owner_agent && (
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                {goal.owner_agent}
              </span>
            )}
            {projectName && (
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
                {projectName}
              </span>
            )}
          </div>

          {goal.description && (
            <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {goal.description}
            </p>
          )}

          {!goal.description && (
            <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', fontStyle: 'italic' }}>
              No description
            </p>
          )}

          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
            Created {new Date(goal.created_at + 'Z').toLocaleString()}
          </div>

          <div className="flex justify-between" style={{ marginTop: '8px' }}>
            <button onClick={async () => { if (confirm(`Delete goal "${goal.title}"?`)) { await orch.deleteGoal(goal.id); onClose(); } }} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'transparent', color: '#ef4444', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
              Delete
            </button>
            <button onClick={() => setEditing(true)} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'var(--accent-teal)', color: '#ffffff', border: 'none', cursor: 'pointer' }}>
              Edit
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
