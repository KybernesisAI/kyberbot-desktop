/**
 * Org Chart — agent hierarchy with a single Edit mode.
 * View mode: clean org tree. Edit mode: full form to change company info,
 * agent roles, and orchestrator — similar to the setup wizard.
 */

import { useState, useEffect } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchOrgNode, OrchSettings } from './types';

interface Props {
  orch: UseOrchResult;
}

interface EditableAgent {
  key: string;
  name: string;
  role: string;
  is_ceo: boolean;
}

export default function OrchOrgChart({ orch }: Props) {
  const { orgChart, company, updateCompany, agentIdentities, setOrgNode, loading, settings, updateSettings } = orch;
  const [editing, setEditing] = useState(false);
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [agents, setAgents] = useState<EditableAgent[]>([]);
  const [saving, setSaving] = useState(false);

  // Settings edit state
  const [heartbeatInterval, setHeartbeatInterval] = useState('30m');
  const [orchEnabled, setOrchEnabled] = useState(false);
  const [activeHoursEnabled, setActiveHoursEnabled] = useState(false);
  const [activeHoursStart, setActiveHoursStart] = useState('09:00');
  const [activeHoursEnd, setActiveHoursEnd] = useState('17:00');

  // Sync edit state when entering edit mode
  useEffect(() => {
    if (editing) {
      setCompName(company?.name || '');
      setCompDesc(company?.description || '');
      setAgents(orgChart.map(n => ({
        key: n.agent_name,
        name: n.title || n.agent_name,
        role: n.role,
        is_ceo: n.is_ceo,
      })));
      // Sync settings
      if (settings) {
        setHeartbeatInterval(settings.heartbeat_interval);
        setOrchEnabled(settings.orchestration_enabled);
        setActiveHoursEnabled(settings.active_hours !== null);
        setActiveHoursStart(settings.active_hours?.start || '09:00');
        setActiveHoursEnd(settings.active_hours?.end || '17:00');
      }
    }
  }, [editing, company, settings]);

  if (loading) return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;

  if (orgChart.length === 0) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
          No org chart configured. Go to the Dashboard tab to set up orchestration.
        </span>
      </div>
    );
  }

  const ceo = orgChart.find(n => n.is_ceo);
  const workers = orgChart.filter(n => !n.is_ceo);

  const handleSetCeo = (key: string) => {
    setAgents(prev => prev.map(a => ({ ...a, is_ceo: a.key === key })));
  };

  const handleUpdateRole = (key: string, role: string) => {
    setAgents(prev => prev.map(a => a.key === key ? { ...a, role } : a));
  };

  const handleUpdateName = (key: string, name: string) => {
    setAgents(prev => prev.map(a => a.key === key ? { ...a, name } : a));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCompany({ name: compName.trim() || 'My Company', description: compDesc.trim() || undefined });

      const newCeo = agents.find(a => a.is_ceo);
      const ceoKey = newCeo?.key || agents[0]?.key;

      // Save CEO first
      if (newCeo) {
        await setOrgNode(newCeo.key, {
          role: newCeo.role,
          title: newCeo.name,
          reports_to: null,
          is_ceo: true,
        });
      }
      // Then workers
      for (const agent of agents) {
        if (agent.key === ceoKey) continue;
        await setOrgNode(agent.key, {
          role: agent.role,
          title: agent.name,
          reports_to: ceoKey,
          is_ceo: false,
        });
      }

      // Save orchestration settings
      await updateSettings({
        orchestration_enabled: orchEnabled,
        heartbeat_interval: heartbeatInterval.trim() || '30m',
        active_hours: activeHoursEnabled ? { start: activeHoursStart, end: activeHoursEnd } : null,
      });

      setEditing(false);
    } finally { setSaving(false); }
  };

  const inputStyle = {
    fontSize: '11px', fontFamily: 'var(--font-mono)',
    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    color: 'var(--fg-primary)', padding: '6px 8px', width: '100%', outline: 'none',
  };

  const labelStyle = {
    display: 'block' as const, fontSize: '9px', fontFamily: 'var(--font-mono)',
    color: 'var(--fg-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '1px', marginBottom: '4px',
  };

  // ── Edit mode ──────────────────────────────────────────────────
  if (editing) {
    const editCeo = agents.find(a => a.is_ceo);
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px' }}>
        <span className="section-title" style={{ color: 'var(--accent-teal)', marginBottom: '24px' }}>{'// EDIT ORCHESTRATION'}</span>

        {/* Company */}
        <div style={{ width: '100%', maxWidth: '420px', marginBottom: '16px' }}>
          <label style={labelStyle}>Company Name</label>
          <input value={compName} onChange={e => setCompName(e.target.value)} placeholder="Company name" style={inputStyle} />
        </div>
        <div style={{ width: '100%', maxWidth: '420px', marginBottom: '24px' }}>
          <label style={labelStyle}>Company Description</label>
          <textarea value={compDesc} onChange={e => setCompDesc(e.target.value)} placeholder="What does this company do?" rows={2} style={{ ...inputStyle, resize: 'none' }} />
        </div>

        {/* Orchestrator */}
        <div style={{ width: '100%', maxWidth: '420px', marginBottom: '24px' }}>
          <label style={labelStyle}>Orchestrator (CEO)</label>
          <select
            value={editCeo?.key || ''}
            onChange={e => handleSetCeo(e.target.value)}
            style={{ ...inputStyle, padding: '8px' }}
          >
            {agents.map(a => (
              <option key={a.key} value={a.key}>{a.name} — {a.role}</option>
            ))}
          </select>
        </div>

        {/* Agent list */}
        <div style={{ width: '100%', maxWidth: '420px', marginBottom: '24px' }}>
          <label style={labelStyle}>Team</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {agents.map(agent => (
              <div key={agent.key} style={{
                padding: '10px 12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                display: 'flex', gap: '8px', alignItems: 'center',
              }}>
                <div style={{ flex: 1 }}>
                  <input
                    value={agent.name}
                    onChange={e => handleUpdateName(agent.key, e.target.value)}
                    style={{ ...inputStyle, marginBottom: '4px', background: 'var(--bg-secondary)' }}
                    placeholder="Display name"
                  />
                  <input
                    value={agent.role}
                    onChange={e => handleUpdateRole(agent.key, e.target.value)}
                    style={{ ...inputStyle, fontSize: '10px', background: 'var(--bg-secondary)' }}
                    placeholder="Role / description"
                  />
                </div>
                <span style={{
                  fontSize: '9px', fontFamily: 'var(--font-mono)', flexShrink: 0,
                  color: agent.is_ceo ? 'var(--accent-teal)' : 'var(--fg-muted)',
                  textTransform: 'uppercase', letterSpacing: '1px',
                }}>
                  {agent.is_ceo ? 'CEO' : 'member'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Orchestration Settings */}
        <div style={{ width: '100%', maxWidth: '420px', marginBottom: '24px' }}>
          <label style={labelStyle}>Orchestration Settings</label>
          <div style={{
            padding: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {/* Enabled toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>
                Orchestration Enabled
              </span>
              <button
                onClick={() => setOrchEnabled(!orchEnabled)}
                role="switch"
                aria-checked={orchEnabled}
                aria-label="Toggle orchestration"
                style={{
                  width: '36px', height: '18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                  background: orchEnabled ? 'var(--accent-teal)' : 'var(--border-color)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%', background: '#ffffff',
                  position: 'absolute', top: '2px',
                  left: orchEnabled ? '20px' : '2px',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Heartbeat interval */}
            <div>
              <label style={{ ...labelStyle, marginBottom: '4px' }}>Heartbeat Interval</label>
              <input
                value={heartbeatInterval}
                onChange={e => setHeartbeatInterval(e.target.value)}
                placeholder="e.g. 30m, 1h"
                style={{ ...inputStyle, background: 'var(--bg-primary)' }}
              />
            </div>

            {/* Active hours */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>
                  Active Hours
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {activeHoursEnabled ? 'Scheduled' : 'Always'}
                  </span>
                  <button
                    onClick={() => setActiveHoursEnabled(!activeHoursEnabled)}
                    role="switch"
                    aria-checked={activeHoursEnabled}
                    aria-label="Toggle active hours"
                    style={{
                      width: '36px', height: '18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                      background: activeHoursEnabled ? 'var(--accent-teal)' : 'var(--border-color)',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: '14px', height: '14px', borderRadius: '50%', background: '#ffffff',
                      position: 'absolute', top: '2px',
                      left: activeHoursEnabled ? '20px' : '2px',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              </div>
              {activeHoursEnabled && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="time"
                    value={activeHoursStart}
                    onChange={e => setActiveHoursStart(e.target.value)}
                    style={{ ...inputStyle, background: 'var(--bg-primary)', flex: 1 }}
                  />
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>to</span>
                  <input
                    type="time"
                    value={activeHoursEnd}
                    onChange={e => setActiveHoursEnd(e.target.value)}
                    style={{ ...inputStyle, background: 'var(--bg-primary)', flex: 1 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '2px',
              padding: '10px 28px', background: saving ? 'var(--bg-secondary)' : 'var(--accent-teal)',
              color: '#ffffff', border: 'none', cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{
              fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '2px',
              padding: '10px 28px', background: 'transparent',
              color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── View mode ──────────────────────────────────────────────────
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border-color)', minHeight: '52px' }}>
        <div className="flex items-center gap-3">
          <span className="section-title" style={{ color: 'var(--accent-teal)' }}>{'// ORG CHART'}</span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>
            {company?.name || 'My Company'}
          </span>
          {company?.description && (
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
              {company.description}
            </span>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
            padding: '8px 16px', background: 'transparent',
            color: 'var(--fg-muted)', border: '1px solid var(--border-color)', cursor: 'pointer',
          }}
        >
          Edit
        </button>
      </div>

      {/* Org tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '48px 32px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* CEO card */}
          {ceo && (
            <div style={{
              padding: '16px 24px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
              textAlign: 'center', minWidth: '180px', borderTop: '3px solid var(--accent-teal)',
            }}>
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', fontWeight: 500 }}>
                <span style={{ color: 'var(--accent-teal)', marginRight: '6px' }}>&#9733;</span>
                {ceo.title || ceo.agent_name}
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginTop: '4px' }}>
                {ceo.role}
              </div>
            </div>
          )}

          {/* Connector: vertical line from CEO down to horizontal bar */}
          {workers.length > 0 && (
            <>
              <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

              {/* Horizontal bar + vertical drops to each worker */}
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                {workers.map((node, i) => (
                  <div key={node.agent_name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '160px' }}>
                    {/* Top connector: horizontal line segment + vertical drop */}
                    <div style={{ width: '100%', display: 'flex', alignItems: 'flex-start' }}>
                      {/* Left half of horizontal line (hidden for first item) */}
                      <div style={{ flex: 1, height: '1px', background: i === 0 ? 'transparent' : 'var(--border-color)', marginTop: '0px' }} />
                      {/* Center vertical drop point */}
                      <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0 }} />
                      {/* Right half of horizontal line (hidden for last item) */}
                      <div style={{ flex: 1, height: '1px', background: i === workers.length - 1 ? 'transparent' : 'var(--border-color)', marginTop: '0px' }} />
                    </div>
                    {/* Worker card */}
                    <div style={{
                      padding: '14px 16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                      textAlign: 'center', width: '148px',
                    }}>
                      <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', fontWeight: 500 }}>
                        {node.title || node.agent_name}
                      </div>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginTop: '4px' }}>
                        {node.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
