/**
 * Prerequisite check — detects and helps install all dependencies.
 * Node.js, Docker Desktop, Claude Code CLI, KyberBot CLI — all required.
 * Auto-refreshes every 3 seconds. Blocks until all are ready.
 */

import { useState, useEffect } from 'react';
import type { PrerequisiteStatus } from '../../../types/ipc';

interface PrerequisiteCheckProps {
  onPassed: () => void;
}

export default function PrerequisiteCheck({ onPassed }: PrerequisiteCheckProps) {
  const [status, setStatus] = useState<PrerequisiteStatus | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installLog, setInstallLog] = useState('');

  const kb = (window as any).kyberbot;

  useEffect(() => {
    if (!kb) return;
    const check = async () => {
      const s = await kb.prerequisites.check();
      setStatus(s);
      if (s.node.installed && s.docker.installed && s.docker.running && s.claude.installed && s.kyberbot.installed) {
        onPassed();
      }
    };
    check();
    const timer = setInterval(check, 3000);
    return () => clearInterval(timer);
  }, [onPassed]);

  const openUrl = (url: string) => kb?.prerequisites.openUrl(url);

  const installNode = async () => {
    setInstalling('Node.js');
    setInstallLog('Downloading Node.js 22 LTS installer...');
    const result = await kb.prerequisites.installNode();
    if (result.ok) {
      setInstallLog('Node.js installer opened — follow the prompts to install');
    } else {
      setInstallLog(`Failed: ${result.error || 'Unknown error'}`);
    }
    setTimeout(() => { setInstalling(null); }, 5000);
  };

  const npmInstall = async (label: string, pkg: string) => {
    setInstalling(label);
    setInstallLog(`Installing ${label}...`);
    const result = await kb.prerequisites.npmInstall(pkg);
    if (result.ok) {
      setInstallLog(`${label} installed successfully`);
    } else {
      setInstallLog(`Failed: ${result.stderr || 'Unknown error'}`);
    }
    setTimeout(() => { setInstalling(null); setInstallLog(''); }, 3000);
  };

  const allOk = status?.node.installed && status?.docker.installed && status?.docker.running && status?.claude.installed && status?.kyberbot.installed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <span className="section-title" style={{ color: 'var(--accent-emerald)', marginBottom: '24px' }}>{'// PREREQUISITES'}</span>
      <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: '28rem', marginBottom: '32px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300 }}>
        KyberBot Desktop needs a few things installed to run. We&apos;ll help you set everything up.
      </p>

      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Node.js */}
        <PrereqCard
          label="Node.js"
          ok={status?.node?.installed}
          version={status?.node?.version}
          description="JavaScript runtime — required for KyberBot and Claude Code"
          notInstalledAction={
            <button
              onClick={installNode}
              disabled={installing !== null}
              style={installBtnStyle}
            >
              {installing === 'Node.js' ? 'DOWNLOADING...' : 'INSTALL'}
            </button>
          }
        />

        {/* Docker */}
        <PrereqCard
          label="Docker Desktop"
          ok={status?.docker?.installed && status?.docker?.running}
          version={status?.docker?.version}
          description="Container runtime — runs the ChromaDB memory database"
          detail={status?.docker?.installed && !status?.docker?.running ? 'Installed but not running — open Docker Desktop' : undefined}
          notInstalledAction={
            <button onClick={() => openUrl('https://www.docker.com/products/docker-desktop/')} style={installBtnStyle}>
              DOWNLOAD
            </button>
          }
        />

        {/* Claude Code */}
        <PrereqCard
          label="Claude Code CLI"
          ok={status?.claude?.installed}
          version={status?.claude?.version}
          description="AI coding assistant — the engine that powers KyberBot agents"
          notInstalledAction={
            status?.node?.installed ? (
              <button
                onClick={() => npmInstall('Claude Code', '@anthropic-ai/claude-code')}
                disabled={installing !== null}
                style={installBtnStyle}
              >
                {installing === 'Claude Code' ? 'INSTALLING...' : 'INSTALL'}
              </button>
            ) : (
              <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>Install Node.js first</span>
            )
          }
        />

        {/* KyberBot CLI */}
        <PrereqCard
          label="KyberBot CLI"
          ok={status?.kyberbot?.installed}
          version={status?.kyberbot?.version}
          description="Agent framework — manages services, memory, skills, and heartbeat"
          notInstalledAction={
            status?.node?.installed ? (
              <button
                onClick={() => npmInstall('KyberBot', 'kyberbot-cli')}
                disabled={installing !== null}
                style={installBtnStyle}
              >
                {installing === 'KyberBot' ? 'INSTALLING...' : 'INSTALL'}
              </button>
            ) : (
              <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>Install Node.js first</span>
            )
          }
        />
      </div>

      {/* Install log */}
      {installLog && (
        <div style={{ marginTop: '16px', padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: installing ? 'var(--accent-amber)' : 'var(--accent-emerald)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', maxWidth: '480px', width: '100%' }}>
          {installLog}
        </div>
      )}

      {/* Status */}
      <div style={{ marginTop: '20px', fontSize: '9px', letterSpacing: '1px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
        {!status ? 'CHECKING...' : allOk ? 'ALL PREREQUISITES MET' : 'AUTO-REFRESHING EVERY 3 SECONDS...'}
      </div>
    </div>
  );
}

// ── Sub-components ──

function PrereqCard({ label, ok, version, description, detail, notInstalledAction }: {
  label: string;
  ok?: boolean;
  version?: string | null;
  description: string;
  detail?: string;
  notInstalledAction?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '16px',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`,
      background: ok ? 'rgba(16,185,129,0.03)' : 'var(--bg-secondary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '16px', color: ok ? 'var(--status-success)' : 'var(--status-error)', flexShrink: 0 }}>
          {ok ? '\u2713' : '\u2717'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: ok ? 'var(--status-success)' : 'var(--fg-primary)' }}>{label}</span>
            {version && <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{version}</span>}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', fontWeight: 300, marginTop: '2px' }}>
            {description}
          </div>
          {detail && <div style={{ fontSize: '10px', color: 'var(--status-warning)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>{detail}</div>}
        </div>
        {!ok && notInstalledAction && (
          <div style={{ flexShrink: 0 }}>
            {notInstalledAction}
          </div>
        )}
      </div>
    </div>
  );
}

const installBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '9px',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-mono)',
  border: '1px solid var(--accent-emerald)',
  color: 'var(--accent-emerald)',
  background: 'transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
