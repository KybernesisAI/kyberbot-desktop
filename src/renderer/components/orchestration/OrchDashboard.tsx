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
      {/* Orchestration Controls */}
      <div style={{
        padding: '14px 16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
        marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <ActionButton
          onClick={async () => { if (ceoNode) await triggerHeartbeat(ceoNode.agent_name); }}
          label="Run Orchestration"
          loadingLabel="Running"
          disabled={!ceoNode}
          style={{ flexShrink: 0 }}
        />

        {/* Last run info */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastRun ? (
            <>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                Last run:
              </span>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
                {new Date(lastRun.started_at + 'Z').toLocaleString()}
              </span>
              <span style={{
                fontSize: '9px', fontFamily: 'var(--font-mono)',
                padding: '1px 6px', background: RUN_STATUS_COLORS[lastRun.status] || 'var(--fg-muted)',
                color: '#ffffff', fontWeight: 500, textTransform: 'uppercase',
              }}>
                {lastRun.status}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
              No runs yet
            </span>
          )}
        </div>

        {/* Enable/disable toggle */}
        {settings && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Auto
            </span>
            <button
              onClick={() => { if (settings) updateSettings({ orchestration_enabled: !settings.orchestration_enabled }); }}
              role="switch"
              aria-checked={settings.orchestration_enabled}
              aria-label="Toggle auto-orchestration"
              style={{
                width: '36px', height: '18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                background: settings.orchestration_enabled ? 'var(--accent-teal)' : 'var(--border-color)',
                position: 'relative', transition: 'background 0.2s',
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

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div style={STAT_CARD}>
          <span style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)', fontWeight: 500 }}>{goals.active}</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Active Goals</span>
        </div>
        <div style={STAT_CARD}>
          <span style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 500 }}>{issues.total - (issues.counts.done || 0) - (issues.counts.cancelled || 0)}</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Open Issues</span>
        </div>
        <div style={STAT_CARD}>
          <span style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', color: inbox.pending > 0 ? '#ef4444' : 'var(--accent-emerald)', fontWeight: 500 }}>{inbox.pending}</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Pending Inbox</span>
        </div>
      </div>

      {/* Agent strip */}
      {org.length > 0 && (
        <div className="mb-4">
          <span className="section-title" style={{ color: 'var(--accent-teal)' }}>{'// AGENTS'}</span>
          <div className="flex gap-2 mt-2 flex-wrap">
            {org.map(node => {
              const agentIssues = orch.issues.filter(i => i.assigned_to === node.agent_name && i.status !== 'done' && i.status !== 'cancelled');
              const isActive = activeAgents.includes(node.agent_name);
              return (
                <div key={node.agent_name} style={{
                  padding: '8px 12px', border: `1px solid ${isActive ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                  background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {/* Status dot */}
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: isActive ? 'var(--accent-teal)' : 'var(--fg-muted)',
                    animation: isActive ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }} />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>
                    {node.is_ceo && '★ '}{node.title || node.agent_name}
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{node.role}</span>
                  {isActive && (
                    <span style={{ fontSize: '9px', padding: '1px 6px', background: 'var(--accent-teal)', color: '#ffffff', borderRadius: '8px', fontFamily: 'var(--font-mono)' }}>
                      executing
                    </span>
                  )}
                  {agentIssues.length > 0 && (
                    <span style={{ fontSize: '9px', padding: '1px 6px', background: 'var(--accent-cyan)', color: '#ffffff', borderRadius: '8px', fontFamily: 'var(--font-mono)' }}>
                      {agentIssues.length}
                    </span>
                  )}
                  <ActionButton
                    onClick={() => triggerHeartbeat(node.agent_name)}
                    label="Run"
                    disabled={isActive}
                    variant="outline"
                    style={{ fontSize: '9px', padding: '2px 8px', letterSpacing: '1px' }}
                  />
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
                  padding: '1px 6px', background: RUN_TYPE_COLORS[run.type] || 'var(--fg-muted)',
                  color: '#ffffff', fontWeight: 500, textTransform: 'uppercase', flexShrink: 0,
                }}>
                  {run.type}
                </span>
                <span style={{
                  fontSize: '9px', fontFamily: 'var(--font-mono)',
                  padding: '1px 6px', background: RUN_STATUS_COLORS[run.status] || 'var(--fg-muted)',
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
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{issue.assigned_to}</span>
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
