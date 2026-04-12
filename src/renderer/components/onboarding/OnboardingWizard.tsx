/**
 * 10-step onboarding wizard for creating a new KyberBot agent.
 */

import { useState, useCallback } from 'react';
import PrerequisiteCheck from './PrerequisiteCheck';

interface OnboardingData {
  agentRoot: string;
  agentName: string;
  agentDescription: string;
  userName: string;
  timezone: string;
  location: string;
  about: string;
  claudeMode: 'subscription' | 'sdk';
  apiKey: string;
  openaiKey: string;
  kybernesisKey: string;
  ngrokToken: string;
  telegramToken: string;
  whatsappEnabled: boolean;
  backupUrl: string;
  backupBranch: string;
}

const INITIAL: OnboardingData = {
  agentRoot: '',
  agentName: '',
  agentDescription: '',
  userName: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  location: '',
  about: '',
  claudeMode: 'subscription',
  apiKey: '',
  openaiKey: '',
  kybernesisKey: '',
  ngrokToken: '',
  telegramToken: '',
  whatsappEnabled: false,
  backupUrl: '',
  backupBranch: 'main',
};

const STEPS = ['Prerequisites', 'Agent Identity', 'About You', 'Claude Code', 'Memory Key', 'Brain Init', 'Cloud Sync', 'Remote Access', 'Channels', 'Backup', 'Summary'];

interface OnboardingWizardProps { onComplete: () => void; }

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const update = (partial: Partial<OnboardingData>) => setData(prev => ({ ...prev, ...partial }));
  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 1));
  const kb = (window as any).kyberbot;

  const selectDirectory = async () => {
    const result = await kb.config.selectAgentRoot();
    if (result) {
      update({ agentRoot: result.path });
      if (result.hasIdentity) { onComplete(); return; }
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      await kb.onboarding.create({
        agentRoot: data.agentRoot,
        agentName: data.agentName,
        agentDescription: data.agentDescription,
        userName: data.userName,
        userLocation: data.location,
        userAbout: data.about,
        timezone: data.timezone,
        claudeMode: data.claudeMode,
        apiKey: data.apiKey || undefined,
        openaiKey: data.openaiKey || undefined,
        kybernesisKey: data.kybernesisKey || undefined,
        ngrokToken: data.ngrokToken || undefined,
        telegramToken: data.telegramToken || undefined,
        whatsappEnabled: data.whatsappEnabled || undefined,
        backupUrl: data.backupUrl || undefined,
        backupBranch: data.backupBranch || undefined,
      });
      onComplete();
    } catch (err) { setError((err as Error).message); }
    setCreating(false);
  };

  const prereqsPassed = useCallback(() => { setStep(1); }, []);

  const S: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-tertiary)', color: 'var(--fg-primary)', border: '1px solid var(--border-color)', outline: 'none', width: '100%', padding: '8px 12px' };
  const L: React.CSSProperties = { color: 'var(--fg-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' };
  const hint: React.CSSProperties = { fontSize: '11px', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontWeight: 300, marginTop: '4px' };
  const link: React.CSSProperties = { color: 'var(--accent-cyan)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '11px', textDecoration: 'underline', padding: 0 };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Progress */}
      <div style={{ padding: '16px 24px 8px' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: '2px', background: i <= step ? 'var(--accent-emerald)' : 'var(--border-color)', transition: 'background 0.3s' }} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <span className="section-title" style={{ color: 'var(--accent-emerald)' }}>{`// STEP ${step + 1} OF ${STEPS.length}: ${STEPS[step].toUpperCase()}`}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>

          {step === 0 && <PrerequisiteCheck onPassed={prereqsPassed} />}

          {/* Step 1: Agent Identity */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={L}>Agent Directory</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={data.agentRoot} readOnly style={S} placeholder="Select a directory..." />
                  <button onClick={selectDirectory} style={{ padding: '8px 12px', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', background: 'var(--accent-cyan)', color: '#ffffff', border: '1px solid var(--accent-cyan)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Browse</button>
                </div>
                <p style={hint}>Create a new folder with your agent's name (e.g., "nova", "atlas") and select it. Each agent lives in its own directory.</p>
              </div>
              <div>
                <label style={L}>Agent Name</label>
                <input value={data.agentName} onChange={e => update({ agentName: e.target.value })} style={S} placeholder="e.g., Atlas, Nova, Echo, Orion" />
              </div>
              <div>
                <label style={L}>Role / Description</label>
                <input value={data.agentDescription} onChange={e => update({ agentDescription: e.target.value })} style={S} placeholder="e.g., Lead Engineer, Director of Marketing, CEO, Research Analyst" />
                <p style={hint}>What role does this agent play? This shapes its personality and decision-making.</p>
              </div>
            </div>
          )}

          {/* Step 2: About You */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={L}>Your Name</label>
                <input value={data.userName} onChange={e => update({ userName: e.target.value })} style={S} placeholder="Your name" />
              </div>
              <div>
                <label style={L}>Timezone</label>
                <div style={{ ...S, background: 'var(--bg-secondary)', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{data.timezone}</span>
                  <span style={{ fontSize: '10px', color: 'var(--fg-muted)' }}>AUTO-DETECTED</span>
                </div>
                <p style={hint}>Detected from your system. The agent uses this for scheduling heartbeat tasks and time-aware responses.</p>
              </div>
              <div>
                <label style={L}>Location (optional)</label>
                <input value={data.location} onChange={e => update({ location: e.target.value })} style={S} placeholder="e.g., New York, USA" />
              </div>
              <div>
                <label style={L}>About You (optional)</label>
                <textarea value={data.about} onChange={e => update({ about: e.target.value })} style={{ ...S, height: '80px', resize: 'none' }} placeholder="What do you do? What should your agent know about you?" />
              </div>
            </div>
          )}

          {/* Step 3: Claude Code */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={L}>Claude Code Mode</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(['subscription', 'sdk'] as const).map(mode => (
                  <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: `1px solid ${data.claudeMode === mode ? 'var(--accent-emerald)' : 'var(--border-color)'}`, background: data.claudeMode === mode ? 'rgba(16,185,129,0.05)' : 'var(--bg-secondary)', cursor: 'pointer' }}>
                    <input type="radio" checked={data.claudeMode === mode} onChange={() => update({ claudeMode: mode })} style={{ accentColor: 'var(--accent-emerald)' }} />
                    <div>
                      <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>{mode === 'subscription' ? 'Claude Code Subscription' : 'Anthropic API Key'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{mode === 'subscription' ? 'Uses your Claude Max/Pro subscription — recommended' : 'Pay-per-use with your own API key'}</div>
                    </div>
                  </label>
                ))}
              </div>
              {data.claudeMode === 'sdk' && (
                <div>
                  <label style={L}>Anthropic API Key</label>
                  <input type="password" value={data.apiKey} onChange={e => update({ apiKey: e.target.value })} style={S} placeholder="sk-ant-..." />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Memory Key (OpenAI for embeddings) */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🧠</span>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontWeight: 600 }}>Required for Memory</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300, lineHeight: '1.7' }}>
                  Your agent&apos;s brain uses <strong style={{ color: 'var(--fg-primary)' }}>OpenAI embeddings</strong> to understand and search memories semantically.
                  Without this key, your agent won&apos;t be able to remember conversations, recognize people, or search its knowledge base.
                </p>
                <p style={{ fontSize: '12px', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontWeight: 300, marginTop: '8px' }}>
                  Cost: ~$0.02 per million tokens (most agents use less than $0.10/month)
                </p>
              </div>

              <div>
                <label style={L}>OpenAI API Key</label>
                <input type="password" value={data.openaiKey} onChange={e => update({ openaiKey: e.target.value })} style={{ ...S, borderColor: data.openaiKey ? 'var(--accent-emerald)' : 'var(--status-error)' }} placeholder="sk-proj-..." />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '12px', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontWeight: 300 }}>
                  <strong style={{ color: 'var(--fg-secondary)' }}>How to get your key:</strong>
                </p>
                <div style={{ paddingLeft: '8px', fontSize: '12px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300, lineHeight: '1.8' }}>
                  1. Go to <button onClick={() => kb?.prerequisites.openUrl('https://platform.openai.com/api-keys')} style={link}>platform.openai.com/api-keys</button><br />
                  2. Click &quot;Create new secret key&quot;<br />
                  3. Copy and paste it above
                </div>
              </div>

              {!data.openaiKey && (
                <p style={{ fontSize: '11px', color: 'var(--status-error)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>This key is required to continue</p>
              )}
            </div>
          )}

          {/* Step 5: Brain Init */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300 }}>
                The following will be initialized when your agent is created:
              </p>
              {['Entity graph (SQLite) — tracks people, companies, projects', 'Timeline index — temporal event tracking', 'ChromaDB vector store (Docker) — semantic memory search', 'Brain notes directory — long-form knowledge storage', 'Heartbeat scheduler — recurring task automation', 'Sleep agent — background memory maintenance'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '8px' }}>
                  <span style={{ color: 'var(--accent-emerald)', flexShrink: 0 }}>{'\u2713'}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Step 6: Cloud Sync */}
          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '12px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300, lineHeight: '1.6' }}>
                  <strong style={{ color: 'var(--fg-primary)' }}>Kybernesis Local</strong> is already included — your agent's memory runs entirely on your machine.
                  <br /><br />
                  <strong style={{ color: 'var(--fg-primary)' }}>Kybernesis Cloud</strong> (optional) enables cross-device sync so your agent's memory is accessible from anywhere.
                </div>
              </div>
              <button onClick={() => kb?.prerequisites.openUrl('https://kybernesis.ai')} style={link}>
                Visit kybernesis.ai to create an account and get your API key →
              </button>
              <div>
                <label style={L}>Kybernesis API Key (optional)</label>
                <input type="password" value={data.kybernesisKey} onChange={e => update({ kybernesisKey: e.target.value })} style={S} placeholder="Leave blank to skip — you can add this later in Settings" />
                <p style={hint}>Find your API key at kybernesis.ai → Settings → API Keys</p>
              </div>
            </div>
          )}

          {/* Step 7: Remote Access */}
          {step === 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.03)' }}>
                <div style={{ fontSize: '12px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300, lineHeight: '1.6' }}>
                  <strong style={{ color: 'var(--accent-emerald)' }}>Highly recommended.</strong> ngrok creates a secure tunnel so your agent can receive messages from Telegram, WhatsApp, and external services even when you're behind a firewall.
                  <br /><br />
                  ngrok is free for personal use. Without it, messaging channels won't work outside your local network.
                </div>
              </div>
              <button onClick={() => kb?.prerequisites.openUrl('https://ngrok.com')} style={link}>
                Sign up at ngrok.com (free) and copy your auth token →
              </button>
              <div>
                <label style={L}>ngrok Auth Token</label>
                <input value={data.ngrokToken} onChange={e => update({ ngrokToken: e.target.value })} style={S} placeholder="Paste from ngrok.com → Your Authtoken" />
                <p style={hint}>Find it at dashboard.ngrok.com → Your Authtoken. You can also add this later in Settings.</p>
              </div>
            </div>
          )}

          {/* Step 8: Channels */}
          {step === 8 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>Optional: connect messaging channels so your agent can communicate outside the desktop app.</p>
              <div>
                <label style={L}>Telegram Bot Token (optional)</label>
                <input value={data.telegramToken} onChange={e => update({ telegramToken: e.target.value })} style={S} placeholder="Paste token from @BotFather on Telegram" />
                <p style={hint}>Message @BotFather on Telegram, send /newbot, follow the prompts, and paste the token here.</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={data.whatsappEnabled} onChange={e => update({ whatsappEnabled: e.target.checked })} style={{ accentColor: 'var(--accent-emerald)' }} />
                <div>
                  <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>Enable WhatsApp</div>
                  <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>You'll scan a QR code after setup to connect your WhatsApp account</div>
                </div>
              </label>
            </div>
          )}

          {/* Step 9: Backup */}
          {step === 9 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '12px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300, lineHeight: '1.6' }}>
                  Back up your agent's state to a private GitHub repository. This includes identity files, skills, brain notes, and database snapshots.
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300, lineHeight: '1.8' }}>
                <strong style={{ color: 'var(--fg-primary)' }}>How to set up:</strong>
                <br />1. Go to <button onClick={() => kb?.prerequisites.openUrl('https://github.com/new')} style={link}>github.com/new</button>
                <br />2. Create a <strong>private</strong> repository (e.g., "my-agent-backup")
                <br />3. Copy the HTTPS or SSH URL and paste it below
              </div>
              <div>
                <label style={L}>GitHub Repo URL (optional)</label>
                <input value={data.backupUrl} onChange={e => update({ backupUrl: e.target.value })} style={S} placeholder="https://github.com/username/my-agent.git" />
              </div>
              {data.backupUrl && (
                <div>
                  <label style={L}>Branch</label>
                  <input value={data.backupBranch} onChange={e => update({ backupBranch: e.target.value })} style={S} />
                </div>
              )}
            </div>
          )}

          {/* Step 10: Summary */}
          {step === 10 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--fg-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 300, marginBottom: '8px' }}>
                Review your configuration and launch your agent.
              </p>
              {[
                ['Agent', data.agentName],
                ['Role', data.agentDescription],
                ['Directory', data.agentRoot],
                ['User', data.userName],
                ['Timezone', data.timezone],
                ['Claude Mode', data.claudeMode],
                ['Memory (OpenAI)', data.openaiKey ? 'Configured' : 'Missing'],
                ['Kybernesis Cloud', data.kybernesisKey ? 'Connected' : 'Local only'],
                ['ngrok Tunnel', data.ngrokToken ? 'Configured' : 'Skipped'],
                ['Telegram', data.telegramToken ? 'Configured' : 'Skipped'],
                ['WhatsApp', data.whatsappEnabled ? 'Enabled' : 'Skipped'],
                ['Backup', data.backupUrl || 'Skipped'],
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{row[0]}</span>
                  <span style={{ fontSize: '12px', color: 'var(--fg-primary)', fontFamily: 'var(--font-mono)' }}>{row[1] || '—'}</span>
                </div>
              ))}
              {error && <div style={{ padding: '8px', border: '1px solid var(--status-error)', color: 'var(--status-error)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{error}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      {step > 0 && (
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)' }}>
          <button onClick={prev} disabled={step <= 1} style={{ padding: '8px 16px', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-color)', color: 'var(--fg-secondary)', background: 'transparent', cursor: step <= 1 ? 'default' : 'pointer', opacity: step <= 1 ? 0.3 : 1 }}>Back</button>
          {step < 10 ? (
            <button onClick={next} disabled={(step === 1 && (!data.agentRoot || !data.agentName)) || (step === 4 && !data.openaiKey)} style={{ padding: '8px 16px', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', background: 'var(--accent-emerald)', color: '#ffffff', border: '1px solid var(--accent-emerald)', cursor: 'pointer', opacity: (step === 1 && (!data.agentRoot || !data.agentName)) || (step === 4 && !data.openaiKey) ? 0.3 : 1 }}>Next</button>
          ) : (
            <button onClick={handleCreate} disabled={creating} style={{ padding: '8px 24px', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', background: 'var(--accent-emerald)', color: '#ffffff', border: '1px solid var(--accent-emerald)', cursor: creating ? 'default' : 'pointer' }}>
              {creating ? 'Creating...' : 'Launch Agent'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
