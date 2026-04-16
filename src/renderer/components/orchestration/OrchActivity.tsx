/**
 * Orchestration Activity Log — filterable event feed.
 */

import { useState } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchActivityEntry } from './types';

function formatAction(entry: OrchActivityEntry): string {
  const id = entry.entity_id ? `KYB-${entry.entity_id}` : '';
  const action = entry.action;

  if (action === 'comment.added') return `Added a comment to ${id}`;
  if (action === 'issue.created') return `Created issue ${id}`;
  if (action === 'issue.updated') return `Updated issue ${id}`;
  if (action === 'issue.checked_out') return `Checked out ${id}`;
  if (action === 'goal.created') return `Created a goal`;
  if (action === 'goal.updated') return `Updated a goal`;
  if (action === 'goal.deleted') return `Deleted a goal`;
  if (action === 'project.created') return `Created project ${id}`;
  if (action === 'org.set') return `Updated org chart for ${entry.entity_id || ''}`;
  if (action === 'inbox.created') return `Escalated to inbox`;
  if (action === 'inbox.resolved') return `Resolved inbox item`;
  if (action === 'issue.recovered') return `Recovered stuck issue ${id}`;
  if (action === 'kpi.updated') return `Updated KPI`;
  if (action === 'company.updated') return `Updated company settings`;

  // Transition actions: "issue.transitioned.todo_to_backlog"
  const transMatch = action.match(/issue\.transitioned\.(\w+)_to_(\w+)/);
  if (transMatch) {
    const from = transMatch[1].replace(/_/g, ' ');
    const to = transMatch[2].replace(/_/g, ' ');
    return `Moved ${id} from ${from} to ${to}`;
  }

  // Fallback
  return `${action}${id ? ` ${id}` : ''}`;
}

interface Props {
  orch: UseOrchResult;
}

export default function OrchActivity({ orch }: Props) {
  const { activity, loading } = orch;
  const [filterActor, setFilterActor] = useState('');

  if (loading) return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;

  const actors = [...new Set(activity.map(e => e.actor))];
  const filtered = filterActor ? activity.filter(e => e.actor === filterActor) : activity;

  if (activity.length === 0) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>No activity yet</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <select
          value={filterActor}
          onChange={e => setFilterActor(e.target.value)}
          style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)', color: 'var(--fg-primary)', padding: '4px 8px',
          }}
        >
          <option value="">All actors</option>
          {actors.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
          {filtered.length} entries
        </span>
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {filtered.map(entry => (
          <div key={entry.id} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', minWidth: '70px', flexShrink: 0 }}>
              {new Date(entry.created_at + 'Z').toLocaleTimeString()}
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', minWidth: '60px', flexShrink: 0 }}>
              {entry.actor}
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)', flex: 1 }}>
              {formatAction(entry)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
