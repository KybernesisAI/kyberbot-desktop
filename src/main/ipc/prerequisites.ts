/**
 * Prerequisite detection: Docker + Claude Code.
 * Both are required before the user can proceed.
 * Uses expanded PATH to find binaries in packaged app.
 */

import { ipcMain, shell } from 'electron';
import { execSync, spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { IPC, PrerequisiteStatus } from '../../types/ipc.js';
import { AppStore } from '../store.js';

function getFullPath(): string {
  const home = process.env.HOME || '';
  const existing = process.env.PATH || '';
  const extras = [join(home, '.local/bin'), '/usr/local/bin', '/opt/homebrew/bin', join(home, '.npm-global/bin'), '/usr/bin', '/bin'];
  const nvmPaths: string[] = [];
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir)) {
      nvmPaths.push(join(nvmDir, v, 'bin'));
    }
  } catch {}
  return [...new Set([...nvmPaths, ...extras, ...existing.split(':')])].join(':');
}

const fullPath = getFullPath();
const execOpts = { encoding: 'utf-8' as const, timeout: 10000, env: { ...process.env, PATH: fullPath }, stdio: 'pipe' as const };

export function registerPrerequisiteHandlers(store: AppStore): void {
  ipcMain.handle(IPC.PREREQ_CHECK, async (): Promise<PrerequisiteStatus> => {
    const node = checkNode();
    const docker = checkDocker();
    const claude = checkClaude();
    const kyberbot = checkKyberbot();
    const agentRoot = checkAgentRoot(store);
    return { node, docker, claude, kyberbot, agentRoot };
  });

  // Open external URLs (for download links)
  ipcMain.handle('prerequisites:openUrl', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Install a package via npm
  ipcMain.handle('prerequisites:npmInstall', async (_event, pkg: string) => {
    // KyberBot CLI: monorepo — needs clone + build + link
    if (pkg === 'kyberbot-cli') {
      return installKyberbotCli();
    }

    return new Promise((resolve) => {
      const proc = spawn('npm', ['install', '-g', pkg], {
        env: { ...process.env, PATH: fullPath },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        resolve({ ok: code === 0, stdout, stderr });
      });

      proc.on('error', (err) => {
        resolve({ ok: false, stdout: '', stderr: err.message });
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        proc.kill();
        resolve({ ok: false, stdout, stderr: stderr + '\nInstallation timed out' });
      }, 120_000);
    });
  });
}

/**
 * Install KyberBot CLI from the GitHub monorepo.
 * Clones to ~/.kyberbot/source, installs deps, builds, and npm links.
 */
async function installKyberbotCli(): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const home = process.env.HOME || '';
  const sourceDir = join(home, '.kyberbot', 'source');
  const repoUrl = 'https://github.com/KybernesisAI/kyberbot.git';
  const shellEnv = { ...process.env, PATH: fullPath };

  const run = (cmd: string, cwd?: string): Promise<{ ok: boolean; output: string }> => {
    return new Promise((resolve) => {
      const proc = spawn('sh', ['-c', cmd], {
        cwd,
        env: shellEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      proc.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { output += d.toString(); });
      proc.on('close', (code) => resolve({ ok: code === 0, output }));
      proc.on('error', (err) => resolve({ ok: false, output: err.message }));
    });
  };

  try {
    let log = '';

    // Clone or pull
    if (existsSync(join(sourceDir, '.git'))) {
      const pull = await run('git pull origin main', sourceDir);
      log += pull.output;
      if (!pull.ok) return { ok: false, stdout: log, stderr: 'git pull failed' };
    } else {
      // Ensure parent dir exists
      const { mkdirSync } = require('fs');
      mkdirSync(join(home, '.kyberbot'), { recursive: true });
      const clone = await run(`git clone ${repoUrl} "${sourceDir}"`);
      log += clone.output;
      if (!clone.ok) return { ok: false, stdout: log, stderr: 'git clone failed' };
    }

    // Install dependencies
    const install = await run('npm install', sourceDir);
    log += install.output;
    if (!install.ok) return { ok: false, stdout: log, stderr: 'npm install failed' };

    // Build
    const build = await run('npm run build', sourceDir);
    log += build.output;
    if (!build.ok) return { ok: false, stdout: log, stderr: 'npm run build failed' };

    // npm link from packages/cli
    const link = await run('npm link', join(sourceDir, 'packages', 'cli'));
    log += link.output;
    if (!link.ok) return { ok: false, stdout: log, stderr: 'npm link failed' };

    return { ok: true, stdout: log, stderr: '' };
  } catch (err) {
    return { ok: false, stdout: '', stderr: String(err) };
  }
}

function checkNode(): { installed: boolean; version: string | null } {
  try {
    const version = execSync('node --version', execOpts).trim();
    return { installed: true, version };
  } catch {
    return { installed: false, version: null };
  }
}

function checkDocker(): PrerequisiteStatus['docker'] {
  try {
    const version = execSync('docker --version', execOpts).trim();
    try {
      execSync('docker info', execOpts);
      return { installed: true, running: true, version };
    } catch {
      return { installed: true, running: false, version };
    }
  } catch {
    return { installed: false, running: false, version: null };
  }
}

function checkClaude(): PrerequisiteStatus['claude'] {
  try {
    const version = execSync('claude --version', execOpts).trim();
    return { installed: true, version };
  } catch {
    return { installed: false, version: null };
  }
}

function checkKyberbot(): { installed: boolean; version: string | null } {
  try {
    const version = execSync('kyberbot --version', execOpts).trim();
    return { installed: true, version };
  } catch {
    return { installed: false, version: null };
  }
}

function checkAgentRoot(store: AppStore): PrerequisiteStatus['agentRoot'] {
  const path = store.getAgentRoot();
  if (!path) return { configured: false, path: null, hasIdentity: false };
  const hasIdentity = existsSync(join(path, 'identity.yaml'));
  return { configured: true, path, hasIdentity };
}
