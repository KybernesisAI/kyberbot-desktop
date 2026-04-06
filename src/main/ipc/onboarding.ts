/**
 * Onboarding IPC handlers.
 * Creates the agent directory structure, initial files, and scaffolds
 * the CLAUDE.md via `kyberbot skill rebuild`.
 */

import { ipcMain } from 'electron';
import { mkdirSync, writeFileSync, existsSync, readFileSync, copyFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import * as yaml from 'js-yaml';
import { IPC } from '../../types/ipc.js';
import { AppStore } from '../store.js';

interface OnboardingData {
  agentRoot: string;
  agentName: string;
  agentDescription: string;
  userName: string;
  userLocation: string;
  userAbout: string;
  timezone: string;
  claudeMode: 'subscription' | 'sdk';
  apiKey?: string;
  kybernesisKey?: string;
  ngrokToken?: string;
  telegramToken?: string;
  whatsappEnabled?: boolean;
  backupUrl?: string;
  backupBranch?: string;
}

export function registerOnboardingHandlers(store: AppStore): void {
  ipcMain.handle(IPC.ONBOARD_CREATE, async (_event, data: OnboardingData) => {
    const { agentRoot, agentName, agentDescription, userName, userLocation, userAbout,
            timezone, claudeMode, apiKey, kybernesisKey, ngrokToken,
            telegramToken, whatsappEnabled, backupUrl, backupBranch } = data;

    // Create directories
    const dirs = [
      '', 'data', 'brain', 'skills', 'logs', 'scripts',
      '.claude', '.claude/agents', '.claude/skills', '.claude/skills/templates',
    ];
    for (const dir of dirs) {
      const fullPath = join(agentRoot, dir);
      if (!existsSync(fullPath)) mkdirSync(fullPath, { recursive: true });
    }

    // Build identity config
    const identity: Record<string, unknown> = {
      agent_name: agentName,
      agent_description: agentDescription,
      timezone,
      heartbeat_interval: '30m',
      server: { port: 3456 },
      claude: { mode: claudeMode, model: 'opus' },
    };

    // Optional: channels
    if (telegramToken || whatsappEnabled) {
      const channels: Record<string, unknown> = {};
      if (telegramToken) channels.telegram = { bot_token: telegramToken };
      if (whatsappEnabled) channels.whatsapp = { enabled: true };
      identity.channels = channels;
    }

    // Optional: tunnel
    if (ngrokToken) {
      identity.tunnel = { enabled: true, provider: 'ngrok' };
    }

    // Optional: kybernesis
    if (kybernesisKey) {
      identity.kybernesis = { api_key: kybernesisKey };
    }

    // Optional: backup
    if (backupUrl) {
      identity.backup = {
        enabled: true,
        remote_url: backupUrl,
        schedule: '24h',
        branch: backupBranch || 'main',
      };
    }

    writeFileSync(join(agentRoot, 'identity.yaml'), yaml.dump(identity, { lineWidth: 120 }), 'utf-8');

    // Write SOUL.md
    writeFileSync(join(agentRoot, 'SOUL.md'),
      `# ${agentName}\n\n## Role\n${agentDescription}\n\n## Values\n- Be thorough and precise\n- Communicate clearly\n- Always verify before acting\n`, 'utf-8');

    // Write USER.md
    const userLines = [`# About the User\n`];
    if (userName) userLines.push(`Name: ${userName}`);
    userLines.push(`Timezone: ${timezone}`);
    if (userLocation) userLines.push(`Location: ${userLocation}`);
    if (userAbout) userLines.push(`\n## About\n${userAbout}`);
    writeFileSync(join(agentRoot, 'USER.md'), userLines.join('\n') + '\n', 'utf-8');

    // Write HEARTBEAT.md
    writeFileSync(join(agentRoot, 'HEARTBEAT.md'),
      `# HEARTBEAT.md\n\n*My standing instructions. Every 30 minutes I check this file\nand act on whatever is most overdue.*\n\n---\n\n## Tasks\n\n<!-- Add tasks here -->\n`, 'utf-8');

    // Write .env
    const envLines = [];
    if (apiKey) envLines.push(`ANTHROPIC_API_KEY=${apiKey}`);
    if (kybernesisKey) envLines.push(`KYBERNESIS_API_KEY=${kybernesisKey}`);
    if (ngrokToken) envLines.push(`NGROK_AUTHTOKEN=${ngrokToken}`);
    const token = `kb_${randomHex(32)}`;
    envLines.push(`KYBERBOT_API_TOKEN=${token}`);
    writeFileSync(join(agentRoot, '.env'), envLines.join('\n') + '\n', 'utf-8');

    // Write .gitignore
    writeFileSync(join(agentRoot, '.gitignore'),
      `node_modules/\ndata/chromadb/\nlogs/\n*.log\n.env\n`, 'utf-8');

    // Copy template files from the globally installed @kyberbot/cli package
    // This includes default skills (recall, remember, brain-note, heartbeat-task, backup),
    // CLAUDE.md, settings, commands, skill/agent generators and templates
    try {
      const templateDir = findTemplateDir();
      if (templateDir) {
        // Create skill directories
        for (const skill of ['remember', 'recall', 'heartbeat-task', 'brain-note', 'backup']) {
          mkdirSync(join(agentRoot, 'skills', skill), { recursive: true });
        }
        mkdirSync(join(agentRoot, '.claude', 'commands'), { recursive: true });
        mkdirSync(join(agentRoot, '.claude', 'skills', 'templates'), { recursive: true });
        mkdirSync(join(agentRoot, '.claude', 'agents', 'templates'), { recursive: true });

        // Copy template files
        const filesToCopy = [
          ['.claude/CLAUDE.md', '.claude/CLAUDE.md'],
          ['.claude/settings.local.json', '.claude/settings.local.json'],
          ['.claude/commands/kyberbot.md', '.claude/commands/kyberbot.md'],
          ['.claude/skills/skill-generator.md', '.claude/skills/skill-generator.md'],
          ['.claude/skills/templates/skill-template.md', '.claude/skills/templates/skill-template.md'],
          ['.claude/agents/templates/agent-template.md', '.claude/agents/templates/agent-template.md'],
          ['.claude/skills/agent-generator.md', '.claude/skills/agent-generator.md'],
          ['skills/remember/SKILL.md', 'skills/remember/SKILL.md'],
          ['skills/recall/SKILL.md', 'skills/recall/SKILL.md'],
          ['skills/heartbeat-task/SKILL.md', 'skills/heartbeat-task/SKILL.md'],
          ['skills/brain-note/SKILL.md', 'skills/brain-note/SKILL.md'],
          ['skills/backup/SKILL.md', 'skills/backup/SKILL.md'],
        ];

        for (const [src, dest] of filesToCopy) {
          const srcPath = join(templateDir, src);
          const destPath = join(agentRoot, dest);
          if (existsSync(srcPath)) {
            copyFileSync(srcPath, destPath);
          }
        }
      }
    } catch {
      // Template copy failed — non-fatal, agent still works without default skills
    }

    // Try to scaffold CLAUDE.md via kyberbot skill rebuild
    try {
      const home = process.env.HOME || '';
      const nvmPaths: string[] = [];
      try {
        const nvmDir = join(home, '.nvm/versions/node');
        const versions = require('fs').readdirSync(nvmDir) as string[];
        versions.sort((a: string, b: string) => {
          const va = a.replace('v', '').split('.').map(Number);
          const vb = b.replace('v', '').split('.').map(Number);
          for (let i = 0; i < 3; i++) { if ((vb[i] || 0) !== (va[i] || 0)) return (vb[i] || 0) - (va[i] || 0); }
          return 0;
        });
        for (const v of versions) nvmPaths.push(join(nvmDir, v, 'bin'));
      } catch {}
      const fullPath = [...nvmPaths, join(home, '.local/bin'), '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin',
        ...(process.env.PATH || '').split(':')].join(':');

      execSync('kyberbot skill rebuild', {
        cwd: agentRoot,
        env: { ...process.env, KYBERBOT_ROOT: agentRoot, PATH: fullPath },
        timeout: 15_000,
        stdio: 'pipe',
      });
    } catch {
      // skill rebuild failed — write a minimal CLAUDE.md
      writeFileSync(join(agentRoot, '.claude', 'CLAUDE.md'),
        `# ${agentName} — Operational Manual\n\nAgent: ${agentName}\nRole: ${agentDescription}\n`, 'utf-8');
    }

    // Store the agent root and return the token so the app can use it immediately
    store.setAgentRoot(agentRoot);

    return { ok: true, path: agentRoot, token };
  });
}

/**
 * Find the KyberBot CLI template directory from the global install.
 * The template/ dir sits at the root of the @kyberbot/cli package.
 */
function findTemplateDir(): string | null {
  const home = process.env.HOME || '';

  // Check nvm installs (most common)
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    const versions = readdirSync(nvmDir).sort().reverse(); // newest first
    for (const v of versions) {
      const templateDir = join(nvmDir, v, 'lib/node_modules/@kyberbot/cli/template');
      if (existsSync(join(templateDir, 'skills'))) return templateDir;
    }
  } catch {}

  // Check global npm install
  const globalPaths = [
    '/usr/local/lib/node_modules/@kyberbot/cli/template',
    '/opt/homebrew/lib/node_modules/@kyberbot/cli/template',
    join(home, '.npm-global/lib/node_modules/@kyberbot/cli/template'),
  ];
  for (const p of globalPaths) {
    if (existsSync(join(p, 'skills'))) return p;
  }

  // Try npm root -g
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8', timeout: 5000 }).trim();
    const p = join(npmRoot, '@kyberbot/cli/template');
    if (existsSync(join(p, 'skills'))) return p;
  } catch {}

  return null;
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(length / 2);
  require('crypto').randomFillSync(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
