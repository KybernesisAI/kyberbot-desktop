/**
 * Orchestration Settings tab — heartbeat timing, system prompt, and configuration.
 */

import { useState, useEffect } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import ActionButton from '../shared/ActionButton';

interface Props {
  orch: UseOrchResult;
}

export default function OrchSettings({ orch }: Props) {
  const { settings, updateSettings, company, updateCompany, loading } = orch;

  const [interval, setInterval_] = useState('30m');
  const [activeHoursEnabled, setActiveHoursEnabled] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('22:00');
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [saved, setSaved] = useState(false);

  // Sync from settings
  useEffect(() => {
    if (settings) {
      setInterval_(settings.heartbeat_interval);
      setActiveHoursEnabled(!!settings.active_hours);
      if (settings.active_hours) {
        setStartTime(settings.active_hours.start);
        setEndTime(settings.active_hours.end);
      }
    }
  }, [settings]);

  useEffect(() => {
    if (company) {
      setCompName(company.name);
      setCompDesc(company.description || '');
    }
  }, [company]);

  const handleSave = async () => {
    await updateSettings({
      heartbeat_interval: interval,
      active_hours: activeHoursEnabled ? { start: startTime, end: endTime } : null,
    });
    if (compName !== company?.name || compDesc !== (company?.description || '')) {
      await updateCompany({ name: compName.trim() || 'My Company', description: compDesc.trim() || undefined });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;

  const inputStyle = {
    width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)',
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
    color: 'var(--fg-primary)', padding: '8px 10px', outline: 'none',
  };
  const labelStyle = {
    display: 'block' as const, fontSize: '9px', fontFamily: 'var(--font-mono)',
    color: 'var(--fg-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '1px', marginBottom: '6px',
  };
  const helpStyle = {
    fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)',
    marginTop: '4px', lineHeight: '1.5',
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', padding: '24px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <span className="section-title" style={{ color: 'var(--accent-teal)', marginBottom: '24px', display: 'block' }}>{'// SETTINGS'}</span>

        {/* Company */}
        <div style={{ marginBottom: '28px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '12px' }}>
            Company
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={compName} onChange={e => setCompName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={compDesc} onChange={e => setCompDesc(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'none' }} placeholder="What does this company do? Helps the CEO understand the mission." />
            </div>
          </div>
        </div>

        {/* Heartbeat */}
        <div style={{ marginBottom: '28px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '12px' }}>
            Orchestration Heartbeat
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Auto-Orchestration</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSettings({ orchestration_enabled: !settings?.orchestration_enabled })}
                  style={{
                    width: '36px', height: '18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                    background: settings?.orchestration_enabled ? 'var(--accent-teal)' : 'var(--border-color)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: '#ffffff',
                    position: 'absolute', top: '2px',
                    left: settings?.orchestration_enabled ? '20px' : '2px',
                    transition: 'left 0.2s',
                  }} />
                </button>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
                  {settings?.orchestration_enabled ? 'Enabled — CEO runs automatically on schedule' : 'Disabled — manual trigger only'}
                </span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Heartbeat Interval</label>
              <input value={interval} onChange={e => setInterval_(e.target.value)} style={{ ...inputStyle, width: '120px' }} placeholder="30m" />
              <p style={helpStyle}>How often the CEO agent reviews company state and takes action. Examples: 15m, 30m, 1h, 2h</p>
            </div>
            <div>
              <label style={labelStyle}>Active Hours</label>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setActiveHoursEnabled(!activeHoursEnabled)}
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
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
                  {activeHoursEnabled ? 'Scheduled — only runs during set hours' : 'Always active — runs 24/7'}
                </span>
              </div>
              {activeHoursEnabled && (
                <div className="flex items-center gap-2">
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, width: '120px' }} />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>to</span>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: '120px' }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CEO System Prompt info */}
        <div style={{ marginBottom: '28px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '12px' }}>
            CEO System Prompt
          </span>
          <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', lineHeight: '1.6' }}>
            <p>The CEO orchestrator prompt is built dynamically from:</p>
            <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
              <li>Company name and description</li>
              <li>Org chart with each agent's SOUL.md</li>
              <li>Active projects and goals with KPIs</li>
              <li>Full issue board state</li>
              <li>Human inbox status</li>
              <li>Recent agent run history</li>
              <li>Activity log</li>
            </ul>
            <p>The prompt includes work management rules (backlog-first, trickle work, @-mention agents, don't repeat comments on blocked issues).</p>
            <p style={{ marginTop: '8px' }}>To customize agent behavior, edit their <span style={{ color: 'var(--accent-cyan)' }}>SOUL.md</span> file in their agent directory.</p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <ActionButton onClick={handleSave} label="Save Settings" loadingLabel="Saving" />
          {saved && <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>Saved</span>}
        </div>
      </div>
    </div>
  );
}
