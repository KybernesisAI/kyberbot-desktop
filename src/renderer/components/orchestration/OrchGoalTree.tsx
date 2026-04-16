/**
 * Goal Tree — hierarchical goal visualization with expand/collapse.
 * Goal creation via modal.
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchGoal } from './types';
import Modal from '../shared/Modal';
import OrchGoalDetail from './OrchGoalDetail';

interface Props {
  orch: UseOrchResult;
}

function GoalNode({ goal, allGoals, depth, onOpen, projects }: { goal: OrchGoal; allGoals: OrchGoal[]; depth: number; onOpen: (goal: OrchGoal) => void; projects: { id: number; name: string }[] }) {
  const [expanded, setExpanded] = useState(true);
  const children = allGoals.filter(g => g.parent_goal_id === goal.id);
  const hasChildren = children.length > 0;

  const statusColor = goal.status === 'completed' ? '#10b981' : goal.status === 'active' ? 'var(--accent-teal)' : goal.status === 'cancelled' ? 'var(--fg-muted)' : '#f59e0b';

  return (
    <div style={{ marginLeft: depth > 0 ? '20px' : 0 }}>
      <div
        className="flex items-center gap-2 py-1 px-2"
        style={{ cursor: 'pointer', borderLeft: depth > 0 ? '1px solid var(--border-color)' : 'none' }}
      >
        {hasChildren ? (
          <span onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
            {expanded ? <ChevronDown size={12} color="var(--fg-muted)" /> : <ChevronRight size={12} color="var(--fg-muted)" />}
          </span>
        ) : (
          <span style={{ width: '12px' }} />
        )}
        <span style={{
          fontSize: '9px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
          padding: '1px 6px', border: `1px solid ${statusColor}`, color: statusColor,
        }}>
          {goal.status}
        </span>
        <span onClick={() => onOpen(goal)} style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', cursor: 'pointer' }}>
          {goal.title}
        </span>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
          ({goal.level})
        </span>
        {goal.owner_agent && (
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            {goal.owner_agent}
          </span>
        )}
        {goal.project_id && (() => {
          const proj = projects.find(p => p.id === goal.project_id);
          return proj ? (
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', padding: '1px 6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              {proj.name}
            </span>
          ) : null;
        })()}
      </div>
      {expanded && children.map(child => (
        <GoalNode key={child.id} goal={child} allGoals={allGoals} depth={depth + 1} onOpen={onOpen} projects={projects} />
      ))}
    </div>
  );
}

export default function OrchGoalTree({ orch }: Props) {
  const { goals, loading, createGoal, fleetAgentNames, orgChart, projects } = orch;
  const [selectedGoal, setSelectedGoal] = useState<OrchGoal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLevel, setNewLevel] = useState<'company' | 'team' | 'agent'>('company');
  const [newOwner, setNewOwner] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      await createGoal({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        level: newLevel,
        owner_agent: newOwner || undefined,
        project_id: newProjectId ? parseInt(newProjectId) : undefined,
      } as any);
      setNewTitle(''); setNewDesc(''); setNewLevel('company'); setNewOwner(''); setNewProjectId('');
      setShowCreate(false);
    } finally { setCreating(false); }
  };

  const getAgentLabel = (key: string) => {
    const node = orgChart.find(n => n.agent_name === key);
    return node?.title || key;
  };

  if (loading) return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;

  const rootGoals = goals.filter(g => !g.parent_goal_id);

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
        <span className="section-title" style={{ color: 'var(--accent-teal)' }}>{'// GOALS'}</span>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
            padding: '8px 16px', background: 'var(--accent-teal)',
            color: '#ffffff', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={10} /> New Goal
        </button>
      </div>

      {/* Create goal modal */}
      {showCreate && (
        <Modal title="New Goal" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus placeholder="What is the goal?" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Why does this matter? How will you measure success?" rows={3} style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Level</label>
                <select value={newLevel} onChange={e => setNewLevel(e.target.value as any)} style={inputStyle}>
                  <option value="company">Company</option>
                  <option value="team">Team</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Owner</label>
                <select value={newOwner} onChange={e => setNewOwner(e.target.value)} style={inputStyle}>
                  <option value="">No owner</option>
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
                {creating ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Goal tree or empty state */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {goals.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginBottom: '12px' }}>
              No goals yet. Set your company's north star.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
                padding: '8px 16px', background: 'var(--accent-teal)', color: '#ffffff', border: 'none', cursor: 'pointer',
              }}
            >
              <Plus size={10} /> Create First Goal
            </button>
          </div>
        ) : (
          rootGoals.map(goal => (
            <GoalNode key={goal.id} goal={goal} allGoals={goals} depth={0} onOpen={setSelectedGoal} projects={projects} />
          ))
        )}
      </div>

      {/* Goal detail modal */}
      {selectedGoal && (
        <OrchGoalDetail goal={selectedGoal} orch={orch} onClose={() => setSelectedGoal(null)} />
      )}
    </div>
  );
}
