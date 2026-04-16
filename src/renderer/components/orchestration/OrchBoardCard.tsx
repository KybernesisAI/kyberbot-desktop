/**
 * Kanban board card — individual issue rendered in a column.
 */

import type { OrchIssue, OrchProject } from './types';
import { PRIORITY_COLORS } from './types';

interface Props {
  issue: OrchIssue;
  onOpen: (id: number) => void;
  activeAgents?: string[];
  projects?: OrchProject[];
}

export default function OrchBoardCard({ issue, onOpen, activeAgents = [], projects = [] }: Props) {
  const isAgentActive = issue.assigned_to ? activeAgents.includes(issue.assigned_to) : false;
  const projectName = issue.project_id ? projects.find(p => p.id === issue.project_id)?.name : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(issue.id));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onOpen(issue.id)}
      style={{
        padding: '8px 10px', cursor: 'grab', background: 'var(--bg-secondary)',
        borderLeft: `3px solid ${PRIORITY_COLORS[issue.priority]}`,
        border: `1px solid ${isAgentActive ? 'var(--accent-teal)' : 'var(--border-color)'}`,
        borderLeftWidth: '3px', borderLeftColor: PRIORITY_COLORS[issue.priority],
      }}
    >
      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginBottom: '2px' }}>
        KYB-{issue.id}
      </div>
      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {issue.title}
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {issue.assigned_to && (
          <span style={{
            fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 6px',
            background: isAgentActive ? 'rgba(20,184,166,0.15)' : 'rgba(34,211,238,0.15)',
            color: isAgentActive ? 'var(--accent-teal)' : 'var(--accent-cyan)',
            borderRadius: '4px',
          }}>
            {isAgentActive && '● '}{issue.assigned_to}
          </span>
        )}
        {projectName && (
          <span style={{
            fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 6px',
            background: 'rgba(255,255,255,0.05)', color: 'var(--fg-muted)',
            border: '1px solid var(--border-color)', borderRadius: '4px',
          }}>
            {projectName}
          </span>
        )}
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
          {issue.priority}
        </span>
      </div>
    </div>
  );
}
