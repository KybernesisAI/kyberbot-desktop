/**
 * Orchestration Activity Log — filterable event feed.
 */

import { useState } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import { formatAction } from './utils';

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
