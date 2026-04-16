/**
 * Projects tab — create, edit, archive, delete projects.
 * Active projects at top, archived projects grayed out below.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchProject } from './types';
import Modal from '../shared/Modal';

interface Props {
  orch: UseOrchResult;
}

function ProjectCard({ project, orch }: { project: OrchProject; orch: UseOrchResult }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [saving, setSaving] = useState(false);

  const isArchived = project.status === 'archived';
  const goalCount = orch.goals.filter(g => g.project_id === project.id).length;
  const issueCount = orch.issues.filter(i => i.project_id === project.id).length;
  const openIssueCount = orch.issues.filter(i => i.project_id === project.id && i.status !== 'done' && i.status !== 'cancelled').length;

  const handleSave = async () => {
    setSaving(true);
    try {
      await orch.updateProject(project.id, { name: name.trim(), description: description.trim() || undefined });
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleArchive = async () => {
    await orch.updateProject(project.id, { status: isArchived ? 'active' : 'archived' });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${project.name}"? Goals and issues linked to this project will be unlinked.`)) return;
    await orch.deleteProject(project.id);
  };

  const inputStyle = {
    width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)',
    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    color: 'var(--fg-primary)', padding: '8px 10px', outline: 'none',
  };

  if (editing) {
    return (
      <div style={{ padding: '14px 16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" style={inputStyle} />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" rows={2} style={{ ...inputStyle, resize: 'none' }} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 14px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !name.trim()} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 14px', background: 'var(--accent-teal)', color: '#ffffff', border: 'none', cursor: 'pointer', opacity: (saving || !name.trim()) ? 0.35 : 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '14px 16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
      opacity: isArchived ? 0.5 : 1,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>
          {project.name}
        </div>
        {project.description && (
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginTop: '4px', lineHeight: '1.5' }}>
            {project.description}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
            {goalCount} goal{goalCount !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
            {openIssueCount} open / {issueCount} total issues
          </span>
          {isArchived && (
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '1px 6px', border: '1px solid var(--fg-muted)' }}>
              Archived
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
        <button onClick={() => { setName(project.name); setDescription(project.description || ''); setEditing(true); }} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 10px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
          Edit
        </button>
        <button onClick={handleArchive} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 10px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
          {isArchived ? 'Restore' : 'Archive'}
        </button>
        <button onClick={handleDelete} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 10px', background: 'transparent', color: '#ef4444', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
          Delete
        </button>
      </div>
    </div>
  );
}

export default function OrchProjects({ orch }: Props) {
  const { projects, loading, createProject } = orch;
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      await createProject({ name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName(''); setNewDesc('');
      setShowCreate(false);
    } finally { setCreating(false); }
  };

  if (loading) return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;

  const active = projects.filter(p => p.status === 'active');
  const archived = projects.filter(p => p.status === 'archived');

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
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border-color)', minHeight: '52px' }}>
        <span className="section-title" style={{ color: 'var(--accent-teal)' }}>{'// PROJECTS'}</span>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
            padding: '8px 16px', background: 'var(--accent-teal)',
            color: '#ffffff', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={10} /> New Project
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal title="New Project" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="e.g. KyberBot" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What is this project?" rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!newName.trim() || creating} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 20px', background: 'var(--accent-teal)', color: '#ffffff', border: 'none', cursor: 'pointer', opacity: (!newName.trim() || creating) ? 0.35 : 1 }}>
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Project list */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {projects.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginBottom: '12px' }}>
              No projects yet. Projects help you organize goals and issues.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
                padding: '8px 16px', background: 'var(--accent-teal)', color: '#ffffff', border: 'none', cursor: 'pointer',
              }}
            >
              <Plus size={10} /> Create First Project
            </button>
          </div>
        ) : (
          <>
            {/* Active projects */}
            {active.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: archived.length > 0 ? '24px' : 0 }}>
                {active.map(p => <ProjectCard key={p.id} project={p} orch={orch} />)}
              </div>
            )}

            {/* Archived projects */}
            {archived.length > 0 && (
              <>
                <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                  Archived
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {archived.map(p => <ProjectCard key={p.id} project={p} orch={orch} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
