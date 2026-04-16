/**
 * Orchestration UI — TypeScript interfaces
 * Matches the backend types from packages/cli/src/orchestration/types.ts
 */

export interface OrchOrgNode {
  agent_name: string;
  role: string;
  title: string | null;
  reports_to: string | null;
  is_ceo: boolean;
  department: string | null;
}

export interface OrchProject {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface OrchGoal {
  id: number;
  title: string;
  description: string | null;
  level: 'company' | 'team' | 'agent';
  owner_agent: string | null;
  parent_goal_id: number | null;
  project_id: number | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrchGoalKPI {
  id: number;
  goal_id: number;
  name: string;
  target_value: number | null;
  current_value: number;
  unit: string | null;
}

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export interface OrchIssue {
  id: number;
  title: string;
  description: string | null;
  goal_id: number | null;
  parent_id: number | null;
  project_id: number | null;
  assigned_to: string | null;
  created_by: string;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string | null;
  checkout_by: string | null;
  checkout_at: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrchComment {
  id: number;
  issue_id: number;
  author_agent: string;
  content: string;
  created_at: string;
}

export interface OrchInboxItem {
  id: number;
  source_agent: string;
  title: string;
  body: string | null;
  urgency: 'high' | 'normal' | 'low';
  status: 'pending' | 'acknowledged' | 'resolved';
  related_issue_id: number | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface OrchActivityEntry {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

export interface OrchCompany {
  name: string;
  description: string | null;
  updated_at: string;
}

export interface OrchAgentIdentity {
  key: string;
  name: string;
  description: string;
  soul: string;
}

export interface OrchDashboardData {
  company: OrchCompany;
  projects: OrchProject[];
  activeAgents: string[];
  org: OrchOrgNode[];
  goals: { total: number; active: number; completed: number; items: OrchGoal[] };
  issues: { total: number; counts: Record<string, number>; recent: OrchIssue[] };
  inbox: { pending: number };
  activity: OrchActivityEntry[];
}

export const KANBAN_COLUMNS: { id: IssueStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'var(--fg-muted)' },
  { id: 'todo', label: 'Todo', color: 'var(--accent-cyan)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--accent-amber)' },
  { id: 'in_review', label: 'In Review', color: 'var(--accent-violet)' },
  { id: 'blocked', label: 'Blocked', color: '#ef4444' },
  { id: 'done', label: 'Done', color: 'var(--accent-emerald)' },
  { id: 'cancelled', label: 'Cancelled', color: 'var(--fg-muted)' },
];

export const PRIORITY_COLORS: Record<IssuePriority, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#22d3ee',
  low: 'var(--fg-muted)',
};

export interface OrchHeartbeatRun {
  id: number;
  agent_name: string;
  type: 'orchestration' | 'worker';
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  finished_at: string | null;
  prompt_summary: string | null;
  result_summary: string | null;
  tool_calls_json: string | null;
  error: string | null;
}

export interface OrchSettings {
  orchestration_enabled: boolean;
  heartbeat_interval: string;
  active_hours: { start: string; end: string } | null;
}
