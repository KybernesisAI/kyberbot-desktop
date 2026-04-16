/**
 * Orchestration Dashboard — overview with stat cards, agent strip, and recent lists.
 */

import { useState } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchHeartbeatRun } from './types';
import { formatAction } from './utils';
import OrchRunDetail from './OrchRunDetail';
import ActionButton from '../shared/ActionButton';

interface Props {
  orch: UseOrchResult;
  onOpenIssue: (id: number) => void;
  onSwitchTab: (tab: string) => void;
}

const STAT_CARD = {
  padding: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
  display: 'flex', flexDirection: 'column' as const, gap: '4px',
};

const RUN_STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  failed: '#ef4444',
  running: '#22d3ee',
};

const RUN_TYPE_COLORS: Record<string, string> = {
  orchestration: 'var(--accent-teal)',
  worker: 'var(--accent-cyan)',
};

export default function OrchDashboard({ orch, onOpenIssue, onSwitchTab }: Props) {
  const { dashboard, loading, error, runs, settings, orgChart, triggerHeartbeat, updateSettings } = orch;
  const [selectedRun, setSelectedRun] = useState<OrchHeartbeatRun | null>(null);

  if (loading) return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;
  if (error) return <div style={{ padding: 16, color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Error: {error}</div>;
  if (!dashboard) return null;

  const { goals, issues, inbox, activity, org, activeAgents = [] } = dashboard;

  const ceoNode = orgChart.find(n => n.is_ceo);
  const lastRun = runs.length > 0 ? runs[0] : null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', padding: 16 }}>
      {/* Controls + Stats — 4 column grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {/* Orchestration control card */}
        <div style={{ ...STAT_CARD, justifyContent: 'space-between', padding: '20px 16px', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Orchestrator</span>
              {settings && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Auto</span>
                  <button
                    onClick={() => { if (settings) updateSettings({ orchestration_enabled: !settings.orchestration_enabled }); }}
                    role="switch"
                    aria-checked={settings.orchestration_enabled}
                    aria-label="Toggle auto-orchestration"
                    style={{
                      width: '36px', height: '18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                      background: settings.orchestration_enabled ? 'var(--accent-teal)' : 'var(--border-color)',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: '14px', height: '14px', borderRadius: '50%', background: '#ffffff',
                      position: 'absolute', top: '2px',
                      left: settings.orchestration_enabled ? '20px' : '2px',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              )}
            </div>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {lastRun ? (
                <>
                  <span style={{
                    fontSize: '9px', fontFamily: 'var(--font-mono)',
                    padding: '1px 6px', lineHeight: '14px', background: RUN_STATUS_COLORS[lastRun.status] || 'var(--fg-muted)',
                    color: '#ffffff', textTransform: 'uppercase',
                  }}>
                    {lastRun.status}
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                    {new Date(lastRun.started_at + 'Z').toLocaleTimeString()}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>No runs yet</span>
              )}
            </div>
          </div>
          <ActionButton
            onClick={async () => { if (ceoNode) await triggerHeartbeat(ceoNode.agent_name); }}
            label="Run Orchestrator"
            loadingLabel="Running"
            disabled={!ceoNode}
            style={{ fontSize: '11px', padding: '8px 16px', width: '100%', justifyContent: 'center' }}
          />
        </div>

        {/* Active Goals */}
        <div style={{ ...STAT_CARD, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: '32px', fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)', fontWeight: 500, lineHeight: 1 }}>{goals.active}</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '6px' }}>Active Goals</span>
        </div>

        {/* Open Issues */}
        <div style={{ ...STAT_CARD, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: '32px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 500, lineHeight: 1 }}>{issues.total - (issues.counts.done || 0) - (issues.counts.cancelled || 0)}</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '6px' }}>Open Issues</span>
        </div>

        {/* Pending Inbox */}
        <div style={{ ...STAT_CARD, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: '32px', fontFamily: 'var(--font-mono)', color: inbox.pending > 0 ? '#ef4444' : 'var(--accent-emerald)', fontWeight: 500, lineHeight: 1 }}>{inbox.pending}</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '6px' }}>Pending Inbox</span>
        </div>
      </div>

      {/* Agent strip */}
      {org.length > 0 && (
        <div className="mb-4">
          <span className="section-title" style={{ color: 'var(--accent-teal)' }}>{'// AGENTS'}</span>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {org.map(node => {
              const agentIssues = orch.issues.filter(i => i.assigned_to?.toLowerCase() === node.agent_name.toLowerCase() && i.status !== 'done' && i.status !== 'cancelled');
              const inProg = agentIssues.filter(i => i.status === 'in_progress').length;
              const todo = agentIssues.filter(i => i.status === 'todo').length;
              const blocked = agentIssues.filter(i => i.status === 'blocked').length;
              const isActive = activeAgents.includes(node.agent_name);
              const agentLastRun = runs.find(r => r.agent_name.toLowerCase() === node.agent_name.toLowerCase());
              return (
                <div key={node.agent_name} style={{
                  padding: '12px 14px', border: `1px solid ${isActive ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                  background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  {/* Header: name + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                        background: isActive ? 'var(--accent-teal)' : 'var(--fg-muted)',
                        animation: isActive ? 'pulse 1.5s ease-in-out infinite' : 'none',
                      }} />
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {node.title || node.agent_name}
                      </span>
                      {node.is_ceo && (
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)', border: '1px solid var(--accent-teal)', padding: '1px 4px', lineHeight: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          orchestrator
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <span style={{ fontSize: '9px', padding: '1px 6px', lineHeight: '14px', background: 'var(--accent-teal)', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                        executing
                      </span>
                    )}
                  </div>

                  {/* Role */}
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', lineHeight: '1.4' }}>{node.role}</span>

                  {/* Issue counts */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {inProg > 0 && <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>{inProg} in progress</span>}
                    {todo > 0 && <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{todo} todo</span>}
                    {blocked > 0 && <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#ef4444' }}>{blocked} blocked</span>}
                    {agentIssues.length === 0 && <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>no open issues</span>}
                  </div>

                  {/* Bottom: Run button + last run */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                    <ActionButton
                      onClick={() => triggerHeartbeat(node.agent_name)}
                      label="Run"
                      disabled={isActive}
                      variant="outline"
                      style={{ fontSize: '9px', padding: '3px 10px', letterSpacing: '1px' }}
                    />
                    {agentLastRun && (
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                        Last run: {new Date(agentLastRun.started_at + 'Z').toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {runs.length > 0 && (
        <div className="mb-4">
          <span className="section-title" style={{ color: 'var(--accent-teal)' }}>{'// RECENT RUNS'}</span>
          <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {runs.slice(0, 5).map(run => (
              <div
                key={run.id}
                onClick={() => setSelectedRun(run)}
                style={{
                  padding: '8px 10px', border: '1px solid var(--border-color)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)',
                }}
              >
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', flexShrink: 0, width: '130px' }}>
                  {new Date(run.started_at + 'Z').toLocaleString()}
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', flexShrink: 0 }}>
                  {run.agent_name}
                </span>
                <span style={{
                  fontSize: '9px', fontFamily: 'var(--font-mono)',
                  padding: '1px 6px', lineHeight: '14px', background: RUN_TYPE_COLORS[run.type] || 'var(--fg-muted)',
                  color: '#ffffff', fontWeight: 500, textTransform: 'uppercase', flexShrink: 0,
                }}>
                  {run.type}
                </span>
                <span style={{
                  fontSize: '9px', fontFamily: 'var(--font-mono)',
                  padding: '1px 6px', lineHeight: '14px', background: RUN_STATUS_COLORS[run.status] || 'var(--fg-muted)',
                  color: '#ffffff', fontWeight: 500, textTransform: 'uppercase', flexShrink: 0,
                }}>
                  {run.status}
                </span>
                {run.result_summary && (
                  <span style={{
                    fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {run.result_summary}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column: Recent Issues + Recent Activity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="section-title" style={{ color: 'var(--accent-teal)', cursor: 'pointer' }} onClick={() => onSwitchTab('board')}>{'// RECENT ISSUES'}</span>
          <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {issues.recent.slice(0, 6).map(issue => (
              <div
                key={issue.id}
                onClick={() => onOpenIssue(issue.id)}
                style={{
                  padding: '8px 10px', border: '1px solid var(--border-color)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: issue.status === 'done' ? '#10b981' : issue.status === 'blocked' ? '#ef4444' : issue.status === 'in_progress' ? '#22d3ee' : 'var(--fg-muted)' }} />
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  KYB-{issue.id} {issue.title}
                </span>
                {issue.assigned_to && (
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{issue.assigned_to}</span>
                )}
              </div>
            ))}
            {issues.recent.length === 0 && (
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>No issues yet</span>
            )}
          </div>
        </div>

        <div>
          <span className="section-title" style={{ color: 'var(--accent-teal)', cursor: 'pointer' }} onClick={() => onSwitchTab('activity')}>{'// RECENT ACTIVITY'}</span>
          <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {activity.slice(0, 6).map(entry => (
              <div key={entry.id} style={{ padding: '6px 10px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
                <span style={{ color: 'var(--accent-cyan)' }}>{entry.actor}</span>
                {' '}{formatAction(entry)}
                <span style={{ color: 'var(--fg-muted)', marginLeft: '8px', fontSize: '10px' }}>
                  {new Date(entry.created_at + 'Z').toLocaleTimeString()}
                </span>
              </div>
            ))}
            {activity.length === 0 && (
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>No activity yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Run detail modal */}
      {selectedRun && (
        <OrchRunDetail run={selectedRun} onClose={() => setSelectedRun(null)} />
      )}
    </div>
  );
}
