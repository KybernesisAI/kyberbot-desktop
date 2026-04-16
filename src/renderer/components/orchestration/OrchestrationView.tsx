/**
 * Orchestration View — main container with sub-tab bar.
 * Follows BrainView's sub-tab pattern.
 */

import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOrch } from '../../hooks/useOrch';
import OrchDashboard from './OrchDashboard';
import OrchBoard from './OrchBoard';
import OrchGoalTree from './OrchGoalTree';
import OrchInbox from './OrchInbox';
import OrchActivity from './OrchActivity';
import OrchFiles from './OrchFiles';
import OrchOrgChart from './OrchOrgChart';
import OrchProjects from './OrchProjects';
import OrchSettings from './OrchSettings';
import OrchIssueDetail from './OrchIssueDetail';
import OrchSetup from './OrchSetup';
import AgentNotRunning from '../shared/AgentNotRunning';

type OrchSubTab = 'dashboard' | 'board' | 'goals' | 'projects' | 'inbox' | 'activity' | 'files' | 'org' | 'settings';

const TABS: Array<{ id: OrchSubTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'board', label: 'Board' },
  { id: 'projects', label: 'Projects' },
  { id: 'goals', label: 'Goals' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'activity', label: 'Activity' },
  { id: 'files', label: 'Files' },
  { id: 'org', label: 'Org Chart' },
  { id: 'settings', label: 'Settings' },
];

export default function OrchestrationView() {
  const { serverReady, fleetMode } = useApp();
  const [activeTab, setActiveTab] = useState<OrchSubTab>('dashboard');
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);
  const orch = useOrch();

  if (!serverReady || !fleetMode) {
    return <AgentNotRunning requires="fleet" />;
  }

  // If the orchestration API is completely unavailable (failed to load on backend),
  // show a diagnostic message instead of the misleading setup wizard.
  if (!orch.loading && orch.apiUnavailable) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <span className="section-title" style={{ color: '#ef4444', marginBottom: '16px' }}>{'// ORCHESTRATION UNAVAILABLE'}</span>
        <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'center', maxWidth: '28rem', marginBottom: '16px', lineHeight: '1.6' }}>
          The orchestration API failed to load on the backend. This usually means the CLI needs to be rebuilt.
        </p>
        <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', maxWidth: '28rem', width: '100%', marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', lineHeight: '1.6', margin: 0 }}>
            Run from any agent directory:
          </p>
          <code style={{ fontSize: '12px', color: 'var(--accent-teal)', fontFamily: 'var(--font-mono)' }}>
            kyberbot update
          </code>
          <p style={{ fontSize: '11px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', lineHeight: '1.6', margin: '8px 0 0' }}>
            Then restart the fleet.
          </p>
        </div>
        {orch.error && (
          <p style={{ fontSize: '10px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', maxWidth: '28rem' }}>
            {orch.error}
          </p>
        )}
      </div>
    );
  }

  // Show setup wizard if no org chart exists yet
  if (!orch.loading && orch.orgChart.length === 0) {
    return <OrchSetup orch={orch} />;
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Sub-tab bar */}
      <div className="flex items-center gap-0 px-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 py-2 relative"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase',
              color: activeTab === tab.id ? 'var(--accent-teal)' : 'var(--fg-muted)',
              background: 'transparent', border: 'none', cursor: 'pointer',
            }}
          >
            {tab.label}
            {tab.id === 'inbox' && orch.inboxCount > 0 && (
              <span style={{
                marginLeft: '4px', background: '#ef4444', color: '#fff',
                fontSize: '9px', padding: '1px 5px', borderRadius: '8px', fontWeight: 500,
              }}>
                {orch.inboxCount}
              </span>
            )}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ background: 'var(--accent-teal)' }} />}
          </button>
        ))}
        <div style={{ flex: 1 }} />
      </div>

      {/* Content area */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {activeTab === 'dashboard' && <OrchDashboard orch={orch} onOpenIssue={setOpenIssueId} onSwitchTab={(tab: string) => setActiveTab(tab as OrchSubTab)} />}
        {activeTab === 'board' && <OrchBoard orch={orch} onOpenIssue={setOpenIssueId} />}
        {activeTab === 'projects' && <OrchProjects orch={orch} />}
        {activeTab === 'goals' && <OrchGoalTree orch={orch} />}
        {activeTab === 'inbox' && <OrchInbox orch={orch} onOpenIssue={setOpenIssueId} />}
        {activeTab === 'activity' && <OrchActivity orch={orch} />}
        {activeTab === 'files' && <OrchFiles orch={orch} onOpenIssue={setOpenIssueId} />}
        {activeTab === 'org' && <OrchOrgChart orch={orch} />}
        {activeTab === 'settings' && <OrchSettings orch={orch} />}

        {/* Issue detail slide-over with click-outside-to-close backdrop */}
        {openIssueId !== null && (
          <>
            <div
              onClick={() => setOpenIssueId(null)}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }}
            />
            <OrchIssueDetail issueId={openIssueId} orch={orch} onClose={() => setOpenIssueId(null)} />
          </>
        )}
      </div>
    </div>
  );
}
