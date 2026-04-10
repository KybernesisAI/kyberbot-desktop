/**
 * Prerequisite detection and one-click installation.
 * Node.js, Claude Code CLI, KyberBot CLI are required.
 * Docker Desktop is optional (enables semantic search via ChromaDB).
 */

import { ipcMain, shell } from 'electron';
import { execSync, spawn } from 'child_process';
import { existsSync, readdirSync, createWriteStream } from 'fs';
import { join } from 'path';
import { tmpdir, arch } from 'os';
import { IPC, PrerequisiteStatus } from '../../types/ipc.js';
import { AppStore } from '../store.js';

let _shellPath: string | null = null;

function getFullPath(): string {
  if (_shellPath) return _shellPath;

  // Try to get the user's real shell PATH (handles nvm, homebrew, etc)
  try {
    const userShell = process.env.SHELL || '/bin/zsh';
    const resolved = execSync(`${userShell} -ilc "echo $PATH"`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (resolved && resolved.length > 10) {
      // Always prepend our own bin dir + pnpm global (may not be in .zshrc yet)
      const home = process.env.HOME || '';
      const ensured = [join(home, '.kyberbot/bin'), join(home, 'Library/pnpm')];
      _shellPath = [...ensured, ...resolved.split(':')].filter(Boolean).join(':');
      return _shellPath;
    }
  } catch {}

  // Fallback: manually construct
  const home = process.env.HOME || '';
  const existing = process.env.PATH || '';
  const extras = [
    join(home, '.kyberbot/bin'),          // Our own wrapper location
    join(home, 'Library/pnpm'),           // pnpm global bin (macOS)
    join(home, '.local/bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    join(home, '.npm-global/bin'),
    '/usr/bin',
    '/bin',
  ];
  const nvmPaths: string[] = [];
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir)) {
      nvmPaths.push(join(nvmDir, v, 'bin'));
    }
  } catch {}
  _shellPath = [...new Set([...nvmPaths, ...extras, ...existing.split(':')])].join(':');
  return _shellPath;
}

const execOpts = () => ({ encoding: 'utf-8' as const, timeout: 10000, env: { ...process.env, PATH: getFullPath() }, stdio: 'pipe' as const });

export function registerPrerequisiteHandlers(store: AppStore): void {
  ipcMain.handle(IPC.PREREQ_CHECK, async (): Promise<PrerequisiteStatus> => {
    // Reset PATH cache each check — user may have installed something since last check
    _shellPath = null;

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

  // One-click Node.js install — downloads .pkg and opens macOS installer
  ipcMain.handle('prerequisites:installNode', async () => {
    try {
      const nodeArch = arch() === 'arm64' ? 'arm64' : 'x64';
      // Fetch the latest Node 22 LTS version from nodejs.org
      const res = await fetch('https://nodejs.org/dist/index.json', { signal: AbortSignal.timeout(10000) });
      const versions = await res.json() as Array<{ version: string; lts: string | false }>;
      const lts22 = versions.find(v => v.version.startsWith('v22') && v.lts);
      if (!lts22) return { ok: false, error: 'Could not find Node 22 LTS version' };

      const ver = lts22.version;
      const pkgUrl = `https://nodejs.org/dist/${ver}/node-${ver}.pkg`;
      const pkgPath = join(tmpdir(), `node-${ver}.pkg`);

      // Download the .pkg
      const dlRes = await fetch(pkgUrl, { signal: AbortSignal.timeout(120000) });
      if (!dlRes.ok) return { ok: false, error: `Download failed: HTTP ${dlRes.status}` };

      const fileStream = createWriteStream(pkgPath);
      const reader = dlRes.body?.getReader();
      if (!reader) return { ok: false, error: 'No response body' };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(Buffer.from(value));
      }
      fileStream.end();
      await new Promise<void>((resolve) => fileStream.on('finish', resolve));

      // Open the .pkg installer (launches macOS Installer.app)
      execSync(`open "${pkgPath}"`, { stdio: 'pipe' });

      // Reset cached PATH so next check picks up new Node
      _shellPath = null;

      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // Install a package via npm (uses login shell for PATH)
  ipcMain.handle('prerequisites:npmInstall', async (_event, pkg: string) => {
    // KyberBot CLI: monorepo — needs clone + build + link
    if (pkg === 'kyberbot-cli') {
      return installKyberbotCli();
    }

    return new Promise((resolve) => {
      const proc = spawn('sh', ['-c', `npm install -g ${pkg}`], {
        env: { ...process.env, PATH: getFullPath() },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        _shellPath = null; // Reset PATH cache after install
        resolve({ ok: code === 0, stdout, stderr });
      });

      proc.on('error', (err) => {
        resolve({ ok: false, stdout: '', stderr: err.message });
      });

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
  const run = (cmd: string, cwd?: string): Promise<{ ok: boolean; output: string }> => {
    return new Promise((resolve) => {
      const proc = spawn('sh', ['-c', cmd], {
        cwd: cwd || undefined,
        env: { ...process.env, PATH: getFullPath(), HOME: home },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      proc.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { output += d.toString(); });
      proc.on('close', (code) => resolve({ ok: code === 0, output }));
      proc.on('error', (err) => resolve({ ok: false, output: err.message }));
      // Timeout per command — 3 minutes max
      setTimeout(() => { try { proc.kill(); } catch {} resolve({ ok: false, output: output + '\nCommand timed out' }); }, 180_000);
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

    // Ensure pnpm is available (monorepo requires it)
    const hasPnpm = await run('pnpm --version', sourceDir);
    if (!hasPnpm.ok) {
      log += 'Installing pnpm...\n';
      const installPnpm = await run('npm install -g pnpm', sourceDir);
      log += installPnpm.output;
      if (!installPnpm.ok) return { ok: false, stdout: log, stderr: 'Failed to install pnpm' };
    }

    // Install dependencies
    const install = await run('pnpm install', sourceDir);
    log += install.output;
    if (!install.ok) return { ok: false, stdout: log, stderr: 'pnpm install failed' };

    // Build
    const build = await run('pnpm run build', sourceDir);
    log += build.output;
    if (!build.ok) return { ok: false, stdout: log, stderr: 'pnpm run build failed' };

    // Create local bin wrapper instead of global link (avoids sudo/permission issues)
    const binDir = join(home, '.kyberbot', 'bin');
    const binPath = join(binDir, 'kyberbot');
    const cliEntry = join(sourceDir, 'packages', 'cli', 'dist', 'index.js');
    const { mkdirSync: mkBin, writeFileSync: writeBin, chmodSync } = require('fs');
    mkBin(binDir, { recursive: true });
    writeBin(binPath, `#!/usr/bin/env node\nimport("${cliEntry}");\n`, 'utf-8');
    chmodSync(binPath, '755');
    log += `Created ${binPath}\n`;

    // Add ~/.kyberbot/bin to shell profile if not already there
    const profilePaths = [join(home, '.zshrc'), join(home, '.bashrc')];
    const pathLine = `export PATH="$HOME/.kyberbot/bin:$PATH"`;
    for (const profilePath of profilePaths) {
      if (existsSync(profilePath)) {
        const { readFileSync: readProfile, appendFileSync } = require('fs');
        const content = readProfile(profilePath, 'utf-8');
        if (!content.includes('.kyberbot/bin')) {
          appendFileSync(profilePath, `\n# KyberBot CLI\n${pathLine}\n`);
          log += `Added PATH to ${profilePath}\n`;
        }
      }
    }

    // Reset cached PATH so the check picks it up immediately
    _shellPath = null;

    return { ok: true, stdout: log, stderr: '' };
  } catch (err) {
    return { ok: false, stdout: '', stderr: String(err) };
  }
}

/**
 * Try running a command at specific known paths, then fall back to PATH.
 * Returns the version string on success, null on failure.
 */
function tryBinary(name: string, versionFlag: string, knownPaths: string[]): string | null {
  const opts = { encoding: 'utf-8' as const, timeout: 10000, stdio: 'pipe' as const };

  // Try each known path directly (no PATH dependency)
  for (const binPath of knownPaths) {
    try {
      if (existsSync(binPath)) {
        return execSync(`"${binPath}" ${versionFlag}`, opts).trim();
      }
    } catch { /* try next */ }
  }

  // Fall back to login shell (picks up whatever PATH the user has)
  try {
    const userShell = process.env.SHELL || '/bin/zsh';
    return execSync(`${userShell} -ilc "${name} ${versionFlag}"`, {
      ...opts,
      timeout: 8000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim().split('\n').pop()?.trim() || null;
  } catch { /* not found */ }

  // Fall back to constructed PATH
  try {
    return execSync(`${name} ${versionFlag}`, execOpts()).trim();
  } catch {
    return null;
  }
}

function checkNode(): { installed: boolean; version: string | null } {
  const home = process.env.HOME || '';
  const knownPaths = [
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
  ];
  // Add all nvm versions
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      knownPaths.push(join(nvmDir, v, 'bin/node'));
    }
  } catch { /* no nvm */ }

  const version = tryBinary('node', '--version', knownPaths);
  return { installed: !!version, version };
}

function checkDocker(): PrerequisiteStatus['docker'] {
  const knownPaths = [
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
  ];
  const version = tryBinary('docker', '--version', knownPaths);
  if (!version) return { installed: false, running: false, version: null };

  // Check if running — use 'docker ps' (fast) instead of 'docker info' (slow on fresh installs)
  try {
    execSync('docker ps -q', { encoding: 'utf-8', timeout: 15000, stdio: 'pipe', env: { ...process.env, PATH: getFullPath() } });
    return { installed: true, running: true, version };
  } catch {
    return { installed: true, running: false, version };
  }
}

function checkClaude(): PrerequisiteStatus['claude'] {
  const home = process.env.HOME || '';
  const knownPaths = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    join(home, '.local/bin/claude'),
    join(home, '.npm-global/bin/claude'),
  ];
  // Add nvm versions
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      knownPaths.push(join(nvmDir, v, 'bin/claude'));
    }
  } catch { /* no nvm */ }

  const version = tryBinary('claude', '--version', knownPaths);
  return { installed: !!version, version };
}

function checkKyberbot(): { installed: boolean; version: string | null } {
  const home = process.env.HOME || '';
  const knownPaths = [
    join(home, '.kyberbot/bin/kyberbot'),
    '/usr/local/bin/kyberbot',
    '/opt/homebrew/bin/kyberbot',
    join(home, '.local/bin/kyberbot'),
    join(home, 'Library/pnpm/kyberbot'),
    join(home, '.npm-global/bin/kyberbot'),
  ];
  // Add nvm versions
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      knownPaths.push(join(nvmDir, v, 'bin/kyberbot'));
    }
  } catch { /* no nvm */ }

  const version = tryBinary('kyberbot', '--version', knownPaths);
  return { installed: !!version, version };
}

function checkAgentRoot(store: AppStore): PrerequisiteStatus['agentRoot'] {
  const path = store.getAgentRoot();
  if (!path) return { configured: false, path: null, hasIdentity: false };
  const hasIdentity = existsSync(join(path, 'identity.yaml'));
  return { configured: true, path, hasIdentity };
}
