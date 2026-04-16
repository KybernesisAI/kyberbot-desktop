/**
 * Orchestration Setup — first-run wizard shown when no org chart exists.
 * Sets company name/description, designates a CEO, and builds the org chart.
 */

import { useState } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';

interface Props {
  orch: UseOrchResult;
}

export default function OrchSetup({ orch }: Props) {
  const { fleetAgentNames, agentIdentities, initOrchestration } = orch;
  const [companyName, setCompanyName] = useState('');
  const [companyDesc, setCompanyDesc] = useState('');
  const [selectedCeo, setSelectedCeo] = useState(fleetAgentNames[0] || '');
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAgent = (key: string) => agentIdentities.find(a => a.key === key);

  const handleInit = async () => {
    if (!selectedCeo || initializing) return;
    setInitializing(true);
    setError(null);
    try {
      await initOrchestration(
        selectedCeo,
        fleetAgentNames,
        companyName.trim() || undefined,
        companyDesc.trim() || undefined,
      );
    } catch (err) {
      setError((err as Error).message || 'Failed to initialize orchestration');
      setInitializing(false);
    }
  };

  const inputStyle = {
    width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)',
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
    color: 'var(--fg-primary)', padding: '10px 12px', outline: 'none',
  };

  const labelStyle = {
    display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)',
    color: 'var(--fg-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '1.5px', marginBottom: '8px',
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px' }}>
      <span className="section-title" style={{ color: 'var(--accent-teal)', marginBottom: '16px' }}>{'// SET UP ORCHESTRATION'}</span>
      <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'center', maxWidth: '28rem', marginBottom: '32px', lineHeight: '1.6' }}>
        Orchestration organizes your agents into a company with goals, tasks, and a CEO who drives execution.
      </p>

      {/* Company info */}
      <div style={{ width: '100%', maxWidth: '380px', marginBottom: '20px' }}>
        <label style={labelStyle}>Company Name</label>
        <input
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder="e.g. Kybernesis"
          style={inputStyle}
        />
      </div>

      <div style={{ width: '100%', maxWidth: '380px', marginBottom: '24px' }}>
        <label style={labelStyle}>Company Description</label>
        <textarea
          value={companyDesc}
          onChange={e => setCompanyDesc(e.target.value)}
          placeholder="What does this company do? This helps the CEO agent understand the mission."
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </div>

      {/* CEO selector */}
      <div style={{ width: '100%', maxWidth: '380px', marginBottom: '24px' }}>
        <label style={labelStyle}>Orchestrator Agent (CEO)</label>
        <select
          value={selectedCeo}
          onChange={e => setSelectedCeo(e.target.value)}
          style={inputStyle}
        >
          {fleetAgentNames.map(name => {
            const agent = getAgent(name);
            return (
              <option key={name} value={name}>
                {agent?.name || name}{agent?.description ? ` — ${agent.description}` : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Team list */}
      <div style={{ width: '100%', maxWidth: '380px', marginBottom: '24px' }}>
        <label style={labelStyle}>Team</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {fleetAgentNames.map(name => {
            const agent = getAgent(name);
            const isCeo = name === selectedCeo;
            return (
              <div key={name} style={{
                padding: '8px 12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>
                    {agent?.name || name}
                  </span>
                  {agent?.description && (
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                      {agent.description}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: isCeo ? 'var(--accent-teal)' : 'var(--fg-muted)', flexShrink: 0, marginLeft: '12px' }}>
                  {isCeo ? 'Orchestrator' : `reports to ${getAgent(selectedCeo)?.name || selectedCeo}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#ef4444', marginBottom: '12px', textAlign: 'center', maxWidth: '380px' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleInit}
        disabled={initializing || !selectedCeo}
        style={{
          fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '2px',
          padding: '12px 32px', cursor: initializing ? 'wait' : 'pointer',
          background: initializing ? 'var(--bg-secondary)' : 'var(--accent-teal)',
          color: '#ffffff', border: 'none',
          opacity: initializing ? 0.7 : 1,
          transition: 'opacity 0.15s, background 0.15s',
        }}
      >
        {initializing ? 'Setting up...' : 'Initialize Orchestration'}
      </button>
    </div>
  );
}
