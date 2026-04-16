/**
 * Shared "not running" placeholder shown in views that need an agent or fleet.
 * Provides a launch button so users never need the CLI.
 */

import { Bot } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface Props {
  /** 'agent' for views that work with a single agent, 'fleet' for views that need fleet mode */
  requires: 'agent' | 'fleet';
}

export default function AgentNotRunning({ requires }: Props) {
  const { activeAgent, agents, fleetMode } = useApp();
  const [starting, setStarting] = useState(false);
  const kb = (window as any).kyberbot;

  const handleStartAgent = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await kb?.services.start();
    } catch { /* ignore */ }
    finally { setStarting(false); }
  };

  const handleStartFleet = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const agentNames = agents.map(a => a.name);
      if (agentNames.length > 0) {
        await kb?.fleet.start(agentNames);
      }
    } catch { /* ignore */ }
    finally { setStarting(false); }
  };

  const isFleetRequired = requires === 'fleet';
  const hasMultipleAgents = agents.length >= 2;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px', gap: '16px',
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '4px',
      }}>
        <Bot size={18} style={{ color: 'var(--fg-muted)' }} />
      </div>

      <p style={{
        fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)',
        textAlign: 'center', maxWidth: '24rem', lineHeight: '1.6',
      }}>
        {isFleetRequired
          ? 'This feature requires multiple agents running together in fleet mode.'
          : `No agent is currently running. Start ${activeAgent || 'an agent'} to use this view.`
        }
      </p>

      {isFleetRequired ? (
        hasMultipleAgents ? (
          <button
            onClick={handleStartFleet}
            disabled={starting}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '2px',
              padding: '10px 24px', cursor: starting ? 'wait' : 'pointer',
              background: 'var(--accent-cyan)', color: '#ffffff', border: 'none',
            }}
          >
            {starting ? 'Starting...' : 'Start Fleet'}
          </button>
        ) : (
          <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', textAlign: 'center' }}>
            Register at least two agents from the Dashboard to use fleet mode.
          </p>
        )
      ) : (
        <button
          onClick={handleStartAgent}
          disabled={starting}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '2px',
            padding: '10px 24px', cursor: starting ? 'wait' : 'pointer',
            background: 'var(--accent-emerald)', color: '#ffffff', border: 'none',
          }}
        >
          {starting ? 'Starting...' : `Start ${activeAgent || 'Agent'}`}
        </button>
      )}
    </div>
  );
}
