/**
 * KyberBot Desktop — Root App Component
 * Sidebar-based layout.
 */

import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import TitleBar from './components/layout/TitleBar';
import Sidebar, { type NavId } from './components/layout/Sidebar';
import DashboardView from './components/dashboard/DashboardView';
import ChatView from './components/chat/ChatView';
import SkillsView from './components/skills/SkillsView';
import ChannelsView from './components/channels/ChannelsView';
import HeartbeatView from './components/heartbeat/HeartbeatView';
import SettingsView from './components/settings/SettingsView';
import BrainView from './components/brain/BrainView';
import BusView from './components/bus/BusView';
import OrchestrationView from './components/orchestration/OrchestrationView';
import OnboardingWizard from './components/onboarding/OnboardingWizard';

function AppContent() {
  const [activeNav, setActiveNav] = useState<NavId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isReady, agentRoot } = useApp();

  if (!isReady) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <span style={{ fontSize: '11px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>Loading...</span>
      </div>
    );
  }

  if (!agentRoot) {
    if (showOnboarding) {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
          <TitleBar />
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <OnboardingWizard onComplete={() => window.location.reload()} />
          </div>
        </div>
      );
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
        <TitleBar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
          <span className="section-title" style={{ color: 'var(--accent-emerald)', marginBottom: '16px' }}>{'// WELCOME TO KYBERBOT'}</span>
          <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: '28rem', marginBottom: '32px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300 }}>
            Create a new agent from scratch, or open an existing agent directory.
          </p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => setShowOnboarding(true)} style={{ padding: '12px 24px', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', border: '1px solid var(--accent-emerald)', color: '#ffffff', background: 'var(--accent-emerald)', cursor: 'pointer' }}>Create New Agent</button>
            <button onClick={async () => { const kb = (window as any).kyberbot; const result = await kb.config.selectAgentRoot(); if (result?.hasIdentity) window.location.reload(); else if (result) alert('No identity.yaml found.'); }} style={{ padding: '12px 24px', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', background: 'transparent', cursor: 'pointer' }}>Open Existing Agent</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <TitleBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <Sidebar activeNav={activeNav} onNavChange={setActiveNav} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Chat stays mounted always so streaming isn't interrupted by tab switches */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: activeNav === 'chat' ? 'block' : 'none' }}>
          <ChatView />
        </div>
        {/* Other views mount/unmount normally */}
        {activeNav === 'dashboard' && <DashboardView />}
        {activeNav === 'skills' && <SkillsView />}
        {activeNav === 'channels' && <ChannelsView />}
        {activeNav === 'heartbeat' && <HeartbeatView />}
        {activeNav === 'brain' && <BrainView />}
        {activeNav === 'bus' && <BusView />}
        {activeNav === 'orchestration' && <OrchestrationView />}
        {activeNav === 'settings' && <SettingsView />}
      </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
