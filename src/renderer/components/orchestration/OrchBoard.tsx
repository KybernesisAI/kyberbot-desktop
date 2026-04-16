/**
 * Orchestration Kanban Board — drag-and-drop issue board.
 * Uses HTML5 Drag and Drop API (no library).
 * Issue creation via modal.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { IssueStatus, IssuePriority } from './types';
import { KANBAN_COLUMNS } from './types';
import OrchBoardCard from './OrchBoardCard';
import Modal from '../shared/Modal';

interface Props {
  orch: UseOrchResult;
  onOpenIssue: (id: number) => void;
}

export default function OrchBoard({ orch, onOpenIssue }: Props) {
  const { issues, moveIssue, createIssue, fleetAgentNames, orgChart, projects } = orch;
  const [dragOverColumn, setDragOverColumn] = useState<IssueStatus | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<IssuePriority>('medium');
  const [newAssignee, setNewAssignee] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [creating, setCreating] = useState(false);

  const agents = [...new Set(issues.map(i => i.assigned_to).filter(Boolean))];
  const filtered = issues.filter(i => {
    if (filterAgent && i.assigned_to !== filterAgent) return false;
    if (filterProject && String(i.project_id || '') !== filterProject) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      await createIssue({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        priority: newPriority,
        assigned_to: newAssignee || undefined,
        project_id: newProjectId ? parseInt(newProjectId) : undefined,
        status: 'todo' as IssueStatus,
      } as any);
      setNewTitle(''); setNewDesc(''); setNewPriority('medium'); setNewAssignee(''); setNewProjectId('');
      setShowCreate(false);
    } finally { setCreating(false); }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: IssueStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const issueId = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(issueId)) return;
    try {
      await moveIssue(issueId, targetStatus);
    } catch (err) {
      console.error('Move failed:', (err as Error).message);
    }
  };

  // Build agent display names from org chart
  const getAgentLabel = (key: string) => {
    const node = orgChart.find(n => n.agent_name === key);
    return node?.title || key;
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

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)', color: 'var(--fg-primary)', padding: '4px 8px',
          }}
        >
          <option value="">All agents</option>
          {agents.map(a => <option key={a} value={a!}>{getAgentLabel(a!)} ({a})</option>)}
        </select>
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)', color: 'var(--fg-primary)', padding: '4px 8px',
          }}
        >
          <option value="">All projects</option>
          {projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
            padding: '4px 12px', background: 'var(--accent-teal)',
            color: '#ffffff', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={10} /> New Issue
        </button>
      </div>

      {/* Create issue modal */}
      {showCreate && (
        <Modal title="New Issue" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus placeholder="What needs to be done?" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Details, acceptance criteria, context..." rows={3} style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Priority</label>
                <select value={newPriority} onChange={e => setNewPriority(e.target.value as IssuePriority)} style={inputStyle}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Assign To</label>
                <select value={newAssignee} onChange={e => setNewAssignee(e.target.value)} style={inputStyle}>
                  <option value="">Unassigned</option>
                  {fleetAgentNames.map(a => <option key={a} value={a}>{getAgentLabel(a)} ({a})</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Project</label>
                <select value={newProjectId} onChange={e => setNewProjectId(e.target.value)} style={inputStyle}>
                  <option value="">No project</option>
                  {projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => setShowCreate(false)} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!newTitle.trim() || creating} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'var(--accent-teal)', color: '#ffffff', border: 'none', cursor: newTitle.trim() ? 'pointer' : 'default', opacity: (!newTitle.trim() || creating) ? 0.35 : 1 }}>
                {creating ? 'Creating...' : 'Create Issue'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Columns — horizontal scroll with fixed-width columns */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', minWidth: 'max-content' }}>
        {KANBAN_COLUMNS.map(col => {
          const columnIssues = filtered.filter(i => i.status === col.id);
          const isDragOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.id); }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{
                width: '240px', minWidth: '240px', display: 'flex', flexDirection: 'column',
                borderTop: `2px solid ${col.color}`,
                background: isDragOver ? 'rgba(20,184,166,0.05)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-2 py-2">
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: col.color, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 500 }}>
                  {col.label}
                </span>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', padding: '0 4px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                  {columnIssues.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', padding: '0 2px' }}>
                {columnIssues.map(issue => (
                  <OrchBoardCard key={issue.id} issue={issue} onOpen={onOpenIssue} activeAgents={orch.dashboard?.activeAgents} projects={orch.projects} />
                ))}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
