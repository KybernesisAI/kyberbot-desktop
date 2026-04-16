import type { OrchActivityEntry } from './types';

export function formatAction(entry: OrchActivityEntry): string {
  const id = entry.entity_id ? `KYB-${entry.entity_id}` : '';
  const action = entry.action;
  if (action === 'comment.added') return `Added a comment to ${id}`;
  if (action === 'issue.created') return `Created issue ${id}`;
  if (action === 'issue.checked_out') return `Checked out ${id}`;
  if (action === 'issue.updated') return `Updated ${id}`;
  if (action === 'issue.recovered') return `Recovered ${id}`;
  if (action === 'goal.created') return `Created a goal`;
  if (action === 'goal.updated') return `Updated a goal`;
  if (action === 'goal.deleted') return `Deleted a goal`;
  if (action === 'project.created') return `Created project ${id}`;
  if (action === 'org.set') return `Updated org chart for ${entry.entity_id || ''}`;
  if (action === 'inbox.created') return `Escalated to inbox`;
  if (action === 'inbox.resolved') return `Resolved inbox item`;
  if (action === 'issue.recovered') return `Recovered stuck issue ${id}`;
  if (action === 'kpi.updated') return `Updated KPI`;
  if (action === 'artifact.created') return `Created artifact`;
  if (action === 'company.updated') return `Updated company settings`;
  if (action === 'heartbeat.started') return `Started heartbeat run`;
  if (action === 'heartbeat.completed') return `Completed heartbeat run`;
  if (action === 'heartbeat.failed') return `Heartbeat run failed`;
  const transMatch = action.match(/issue\.transitioned\.(\w+)_to_(\w+)/);
  if (transMatch) return `Moved ${id} from ${transMatch[1].replace(/_/g, ' ')} to ${transMatch[2].replace(/_/g, ' ')}`;
  return `${action}${id ? ` ${id}` : ''}`;
}
