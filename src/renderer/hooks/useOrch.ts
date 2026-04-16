/**
 * Orchestration data hook.
 * Fetches all orchestration data from the fleet server and provides
 * mutation functions for the UI.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import type {
  OrchDashboardData, OrchIssue, OrchGoal, OrchComment, OrchCompany,
  OrchInboxItem, OrchActivityEntry, OrchOrgNode, OrchAgentIdentity, IssueStatus,
  OrchHeartbeatRun, OrchSettings, OrchProject, OrchArtifact,
} from '../components/orchestration/types';

const POLL_INTERVAL = 5000;

function buildHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function orchFetch<T>(serverUrl: string, token: string | null, path: string, options: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const headers = buildHeaders(token);
  const res = await fetch(`${serverUrl}/fleet/orch${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> || {}) }, signal: signal || options.signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((body as any).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface UseOrchResult {
  // Data
  dashboard: OrchDashboardData | null;
  issues: OrchIssue[];
  goals: OrchGoal[];
  projects: OrchProject[];
  orgChart: OrchOrgNode[];
  inboxItems: OrchInboxItem[];
  archivedInboxItems: OrchInboxItem[];
  inboxCount: number;
  activity: OrchActivityEntry[];
  artifacts: OrchArtifact[];
  runs: OrchHeartbeatRun[];
  settings: OrchSettings | null;
  loading: boolean;
  error: string | null;

  // Issue detail
  issueComments: OrchComment[];
  loadIssueComments: (issueId: number) => Promise<void>;

  // Artifacts
  loadArtifactContent: (id: number) => Promise<string>;

  // Mutations — Issues
  createIssue: (data: Partial<OrchIssue>) => Promise<void>;
  updateIssue: (id: number, data: Partial<OrchIssue>) => Promise<void>;
  moveIssue: (id: number, newStatus: IssueStatus) => Promise<void>;
  addComment: (issueId: number, content: string) => Promise<void>;

  // Mutations — Goals
  createGoal: (data: Partial<OrchGoal>) => Promise<void>;
  updateGoal: (id: number, data: Partial<OrchGoal>) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;

  // Mutations — Projects
  createProject: (data: { name: string; description?: string }) => Promise<void>;
  updateProject: (id: number, data: { name?: string; description?: string; status?: string }) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;

  // Mutations — Inbox
  resolveInboxItem: (id: number) => Promise<void>;
  dismissInboxItem: (id: number) => Promise<void>;
  dismissAllInbox: () => Promise<void>;

  // Mutations — Org chart
  setOrgNode: (agentName: string, data: { role: string; title?: string; reports_to?: string | null; is_ceo?: boolean; department?: string }) => Promise<void>;
  removeOrgNode: (agentName: string) => Promise<void>;
  initOrchestration: (ceoName: string, agents: string[], companyName?: string, companyDesc?: string) => Promise<void>;

  // Mutations — Company
  company: OrchCompany | null;
  updateCompany: (data: { name?: string; description?: string }) => Promise<void>;

  // Mutations — Orchestration controls
  triggerHeartbeat: (agentName: string) => Promise<void>;
  updateSettings: (data: Partial<OrchSettings>) => Promise<void>;

  // Fleet info (for setup UIs)
  fleetAgentNames: string[];
  agentIdentities: OrchAgentIdentity[];

  refetch: () => Promise<void>;
}

export function useOrch(): UseOrchResult {
  const { baseServerUrl, apiToken, serverReady, fleetMode, agents: fleetAgents } = useApp();
  // Orchestration API is fleet-level (/fleet/orch), not per-agent, so use baseServerUrl
  const serverUrl = baseServerUrl;
  const [dashboard, setDashboard] = useState<OrchDashboardData | null>(null);
  const [issues, setIssues] = useState<OrchIssue[]>([]);
  const [goals, setGoals] = useState<OrchGoal[]>([]);
  const [orgChart, setOrgChart] = useState<OrchOrgNode[]>([]);
  const [inboxItems, setInboxItems] = useState<OrchInboxItem[]>([]);
  const [archivedInboxItems, setArchivedInboxItems] = useState<OrchInboxItem[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [activity, setActivity] = useState<OrchActivityEntry[]>([]);
  const [issueComments, setIssueComments] = useState<OrchComment[]>([]);
  const [agentIdentities, setAgentIdentities] = useState<OrchAgentIdentity[]>([]);
  const [projects, setProjects] = useState<OrchProject[]>([]);
  const [company, setCompany] = useState<OrchCompany | null>(null);
  const [artifacts, setArtifacts] = useState<OrchArtifact[]>([]);
  const [runs, setRuns] = useState<OrchHeartbeatRun[]>([]);
  const [settings, setSettings] = useState<OrchSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const abortRef = useRef<AbortController>();

  const fetchAll = useCallback(async () => {
    if (!serverReady || !fleetMode) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      const [dashRes, issuesRes, goalsRes, orgRes, inboxRes, allInboxRes, activityRes, agentsRes, runsRes, settingsRes, projectsRes, artifactsRes] = await Promise.all([
        orchFetch<OrchDashboardData>(serverUrl, apiToken, '/dashboard', {}, signal),
        orchFetch<{ issues: OrchIssue[] }>(serverUrl, apiToken, '/issues', {}, signal),
        orchFetch<{ goals: OrchGoal[] }>(serverUrl, apiToken, '/goals', {}, signal),
        orchFetch<{ nodes: OrchOrgNode[] }>(serverUrl, apiToken, '/org', {}, signal),
        orchFetch<{ items: OrchInboxItem[] }>(serverUrl, apiToken, '/inbox?status=pending', {}, signal),
        orchFetch<{ items: OrchInboxItem[] }>(serverUrl, apiToken, '/inbox', {}, signal).catch(() => ({ items: [] as OrchInboxItem[] })),
        orchFetch<{ entries: OrchActivityEntry[] }>(serverUrl, apiToken, '/activity?limit=50', {}, signal),
        orchFetch<{ agents: OrchAgentIdentity[] }>(serverUrl, apiToken, '/agents', {}, signal),
        orchFetch<{ runs: OrchHeartbeatRun[] }>(serverUrl, apiToken, '/runs?limit=20', {}, signal).catch(() => ({ runs: [] as OrchHeartbeatRun[] })),
        orchFetch<{ settings: OrchSettings }>(serverUrl, apiToken, '/settings', {}, signal).catch(() => null),
        orchFetch<{ projects: OrchProject[] }>(serverUrl, apiToken, '/projects', {}, signal).catch(() => ({ projects: [] as OrchProject[] })),
        orchFetch<{ artifacts: OrchArtifact[] }>(serverUrl, apiToken, '/artifacts?limit=100', {}, signal).catch(() => ({ artifacts: [] as OrchArtifact[] })),
      ]);
      setDashboard(dashRes);
      setIssues(issuesRes.issues);
      setGoals(goalsRes.goals);
      setOrgChart(orgRes.nodes);
      setInboxItems(inboxRes.items);
      setInboxCount(inboxRes.items.length);
      setArchivedInboxItems(allInboxRes.items.filter((i: OrchInboxItem) => i.status !== 'pending'));
      setActivity(activityRes.entries);
      setAgentIdentities(agentsRes.agents);
      setRuns(runsRes.runs);
      setProjects(projectsRes.projects);
      setArtifacts(artifactsRes.artifacts);
      if (settingsRes) setSettings(settingsRes.settings);
      if (dashRes.company) setCompany(dashRes.company);
      setError(null);
    } catch (err) {
      // Ignore abort errors — they are expected when a new fetch supersedes the old one
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [serverUrl, apiToken, serverReady, fleetMode]);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
    };
  }, [fetchAll]);

  const loadIssueComments = useCallback(async (issueId: number) => {
    if (!serverReady) return;
    try {
      const data = await orchFetch<{ comments: OrchComment[] }>(serverUrl, apiToken, `/issues/${issueId}/comments`);
      setIssueComments(data.comments);
    } catch { /* ignore */ }
  }, [serverUrl, apiToken, serverReady]);

  const loadArtifactContent = useCallback(async (id: number): Promise<string> => {
    if (!serverReady) return '';
    const data = await orchFetch<{ content: string }>(serverUrl, apiToken, `/artifacts/${id}/content`);
    return data.content;
  }, [serverUrl, apiToken, serverReady]);

  const createIssue = useCallback(async (data: Partial<OrchIssue>) => {
    await orchFetch(serverUrl, apiToken, '/issues', { method: 'POST', body: JSON.stringify({ ...data, created_by: 'human' }) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const updateIssue = useCallback(async (id: number, data: Partial<OrchIssue>) => {
    await orchFetch(serverUrl, apiToken, `/issues/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const moveIssue = useCallback(async (id: number, newStatus: IssueStatus) => {
    await orchFetch(serverUrl, apiToken, `/issues/${id}/transition`, { method: 'POST', body: JSON.stringify({ status: newStatus, actor: 'human' }) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const createGoal = useCallback(async (data: Partial<OrchGoal>) => {
    await orchFetch(serverUrl, apiToken, '/goals', { method: 'POST', body: JSON.stringify(data) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const updateGoal = useCallback(async (id: number, data: Partial<OrchGoal>) => {
    await orchFetch(serverUrl, apiToken, `/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const deleteGoal = useCallback(async (id: number) => {
    await orchFetch(serverUrl, apiToken, `/goals/${id}`, { method: 'DELETE' });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const createProject = useCallback(async (data: { name: string; description?: string }) => {
    await orchFetch(serverUrl, apiToken, '/projects', { method: 'POST', body: JSON.stringify(data) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const updateProject = useCallback(async (id: number, data: { name?: string; description?: string; status?: string }) => {
    await orchFetch(serverUrl, apiToken, `/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const deleteProject = useCallback(async (id: number) => {
    await orchFetch(serverUrl, apiToken, `/projects/${id}`, { method: 'DELETE' });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const addComment = useCallback(async (issueId: number, content: string) => {
    await orchFetch(serverUrl, apiToken, `/issues/${issueId}/comments`, { method: 'POST', body: JSON.stringify({ author: 'human', content }) });
    await loadIssueComments(issueId);
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll, loadIssueComments]);

  const resolveInboxItem = useCallback(async (id: number) => {
    await orchFetch(serverUrl, apiToken, `/inbox/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolved_by: 'human' }) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const dismissInboxItem = useCallback(async (id: number) => {
    await orchFetch(serverUrl, apiToken, `/inbox/${id}/acknowledge`, { method: 'POST' });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const dismissAllInbox = useCallback(async () => {
    for (const item of inboxItems) {
      await orchFetch(serverUrl, apiToken, `/inbox/${item.id}/acknowledge`, { method: 'POST' });
    }
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll, inboxItems]);

  const setOrgNode = useCallback(async (agentName: string, data: { role: string; title?: string; reports_to?: string | null; is_ceo?: boolean; department?: string }) => {
    await orchFetch(serverUrl, apiToken, `/org/${agentName}`, { method: 'PUT', body: JSON.stringify(data) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const removeOrgNode = useCallback(async (agentName: string) => {
    await orchFetch(serverUrl, apiToken, `/org/${agentName}`, { method: 'DELETE' });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const initOrchestration = useCallback(async (ceoName: string, agents: string[], companyName?: string, companyDesc?: string) => {
    // Set company name/description if provided
    if (companyName) {
      await orchFetch(serverUrl, apiToken, '/company', {
        method: 'PUT',
        body: JSON.stringify({ name: companyName, description: companyDesc || null }),
      });
    }

    // Always fetch identities fresh — cached state may be empty if fetchAll failed
    let identities: OrchAgentIdentity[] = [];
    try {
      const res = await orchFetch<{ agents: OrchAgentIdentity[] }>(serverUrl, apiToken, '/agents');
      identities = res.agents;
    } catch { /* use empty */ }
    const getIdentity = (key: string) => identities.find(a => a.key === key);

    // Insert CEO first (foreign key: workers reference CEO via reports_to)
    const ceoId = getIdentity(ceoName);
    await orchFetch(serverUrl, apiToken, `/org/${ceoName}`, {
      method: 'PUT',
      body: JSON.stringify({
        role: ceoId?.description || 'CEO',
        title: ceoId?.name || ceoName,
        reports_to: null,
        is_ceo: true,
      }),
    });
    // Then insert workers with their real roles
    for (const name of agents) {
      if (name === ceoName) continue;
      const id = getIdentity(name);
      await orchFetch(serverUrl, apiToken, `/org/${name}`, {
        method: 'PUT',
        body: JSON.stringify({
          role: id?.description || name,
          title: id?.name || name,
          reports_to: ceoName,
          is_ceo: false,
        }),
      });
    }
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll, agentIdentities]);

  const updateCompanyFn = useCallback(async (data: { name?: string; description?: string }) => {
    await orchFetch(serverUrl, apiToken, '/company', { method: 'PUT', body: JSON.stringify(data) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const triggerHeartbeat = useCallback(async (agentName: string) => {
    await orchFetch(serverUrl, apiToken, `/heartbeat/${agentName}`, { method: 'POST' });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  const updateSettingsFn = useCallback(async (data: Partial<OrchSettings>) => {
    await orchFetch(serverUrl, apiToken, '/settings', { method: 'PUT', body: JSON.stringify(data) });
    await fetchAll();
  }, [serverUrl, apiToken, fetchAll]);

  return {
    dashboard, issues, goals, projects, orgChart, inboxItems, inboxCount, activity,
    artifacts, runs, settings,
    loading, error, issueComments, loadIssueComments, loadArtifactContent,
    createIssue, updateIssue, moveIssue, createGoal, updateGoal, deleteGoal, addComment, resolveInboxItem, dismissInboxItem, dismissAllInbox, archivedInboxItems,
    createProject, updateProject, deleteProject,
    setOrgNode, removeOrgNode, initOrchestration,
    company, updateCompany: updateCompanyFn,
    triggerHeartbeat, updateSettings: updateSettingsFn,
    fleetAgentNames: fleetAgents.map(a => a.name),
    agentIdentities,
    refetch: fetchAll,
  };
}
