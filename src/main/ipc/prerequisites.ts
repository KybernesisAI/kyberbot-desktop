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

/**
 * Build a comprehensive PATH by scanning known binary locations.
 * NO login shell, NO execSync — purely filesystem checks. Never blocks.
 */
function getFullPath(): string {
  const home = process.env.HOME || '';
  const existing = process.env.PATH || '';
  const extras = [
    join(home, '.kyberbot/bin'),          // Our own wrapper location
    join(home, 'Library/pnpm'),           // pnpm global bin (macOS)
    join(home, '.pnpm-global/bin'),       // pnpm global bin (alt)
    join(home, '.local/bin'),             // pip, pipx, user binaries
    '/usr/local/bin',                     // Node.js .pkg, Homebrew (Intel)
    '/opt/homebrew/bin',                  // Homebrew (Apple Silicon)
    join(home, '.npm-global/bin'),        // npm global (custom prefix)
    '/Applications/Docker.app/Contents/Resources/bin', // Docker Desktop
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];
  const nvmPaths: string[] = [];
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      nvmPaths.push(join(nvmDir, v, 'bin'));
    }
  } catch { /* no nvm */ }

  return [...new Set([...nvmPaths, ...extras, ...existing.split(':')])].filter(Boolean).join(':');
}

const execOpts = () => ({ encoding: 'utf-8' as const, timeout: 10000, env: { ...process.env, PATH: getFullPath() }, stdio: 'pipe' as const });

export function registerPrerequisiteHandlers(store: AppStore): void {
  ipcMain.handle(IPC.PREREQ_CHECK, async (): Promise<PrerequisiteStatus> => {
    // Run all checks in parallel — all async, never blocks main thread
    const [node, docker, claude, kyberbot] = await Promise.all([
      checkNode(),
      checkDocker(),
      checkClaude(),
      checkKyberbot(),
    ]);
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
      // PATH is rebuilt fresh each call — no cache to reset

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
        // PATH is rebuilt fresh each call — no cache to reset // Reset PATH cache after install
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
      // Try global install first, fall back to corepack (Node 16+) if permissions fail
      let pnpmInstalled = false;
      const installPnpm = await run('npm install -g pnpm', sourceDir);
      log += installPnpm.output;
      pnpmInstalled = installPnpm.ok;

      if (!pnpmInstalled) {
        log += 'Global install failed, trying corepack...\n';
        const corepack = await run('corepack enable && corepack prepare pnpm@latest --activate', sourceDir);
        log += corepack.output;
        pnpmInstalled = corepack.ok;
      }

      if (!pnpmInstalled) {
        // Last resort: install pnpm locally via npx
        log += 'Corepack failed, trying npx...\n';
        const npxPnpm = await run('npx pnpm --version', sourceDir);
        log += npxPnpm.output;
        if (!npxPnpm.ok) return { ok: false, stdout: log, stderr: 'Failed to install pnpm — try running "npm install -g pnpm" manually in terminal' };
      }
    }

    // Install dependencies
    const install = await run('pnpm install', sourceDir);
    log += install.output;
    if (!install.ok) return { ok: false, stdout: log, stderr: 'pnpm install failed' };

    // Build
    const build = await run('pnpm run build', sourceDir);
    log += build.output;
    if (!build.ok) return { ok: false, stdout: log, stderr: 'pnpm run build failed' };

    // Create local bin wrapper (bash script that finds node reliably)
    const binDir = join(home, '.kyberbot', 'bin');
    const binPath = join(binDir, 'kyberbot');
    const cliEntry = join(sourceDir, 'packages', 'cli', 'dist', 'index.js');
    const { mkdirSync: mkBin, writeFileSync: writeBin, chmodSync } = require('fs');
    mkBin(binDir, { recursive: true });

    // Bash wrapper that finds node from nvm, /usr/local/bin, or PATH
    const wrapper = [
      '#!/bin/bash',
      '# KyberBot CLI wrapper — installed by KyberBot Desktop',
      'NODE=""',
      '# Check nvm first',
      `if [ -d "$HOME/.nvm/versions/node" ]; then`,
      `  NODE=$(ls -d "$HOME/.nvm/versions/node"/v*/bin/node 2>/dev/null | sort -V | tail -1)`,
      'fi',
      '# Fall back to standard locations',
      '[ -z "$NODE" ] && [ -x /usr/local/bin/node ] && NODE=/usr/local/bin/node',
      '[ -z "$NODE" ] && [ -x /opt/homebrew/bin/node ] && NODE=/opt/homebrew/bin/node',
      '[ -z "$NODE" ] && NODE=$(which node 2>/dev/null)',
      '[ -z "$NODE" ] && echo "Error: Node.js not found" && exit 1',
      `exec "$NODE" "${cliEntry}" "$@"`,
    ].join('\n');

    writeBin(binPath, wrapper + '\n', 'utf-8');
    chmodSync(binPath, '755');
    log += `Created ${binPath}\n`;

    // Verify the wrapper actually works
    const verify = await run(`"${binPath}" --version`, undefined);
    if (!verify.ok) {
      log += `WARNING: Wrapper created but verification failed: ${verify.output}\n`;
      return { ok: false, stdout: log, stderr: 'KyberBot CLI installed but failed to run — check Node.js installation' };
    }
    log += `Verified: ${verify.output.trim()}\n`;

    // Add ~/.kyberbot/bin to shell profiles if not already there
    const profilePaths = [join(home, '.zshrc'), join(home, '.bashrc'), join(home, '.bash_profile')];
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

    // PATH is rebuilt fresh each call — no cache to reset

    return { ok: true, stdout: log, stderr: '' };
  } catch (err) {
    return { ok: false, stdout: '', stderr: String(err) };
  }
}

/**
 * Run a command asynchronously with a timeout. Never blocks the main thread.
 */
function runAsync(cmd: string, timeoutMs: number = 8000): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', cmd], {
      env: { ...process.env, PATH: getFullPath() },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.on('close', (code) => resolve(code === 0 ? stdout.trim() : null));
    proc.on('error', () => resolve(null));
    setTimeout(() => { try { proc.kill(); } catch {} resolve(null); }, timeoutMs);
  });
}

/**
 * Try running a version check at known paths, then fall back to PATH.
 * Fully async — never blocks the main thread.
 */
async function tryBinary(name: string, versionFlag: string, knownPaths: string[]): Promise<string | null> {
  // Try each known path directly (no PATH dependency, no shell)
  for (const binPath of knownPaths) {
    if (existsSync(binPath)) {
      const result = await runAsync(`"${binPath}" ${versionFlag}`, 5000);
      if (result) return result.split('\n').pop()?.trim() || result;
    }
  }

  // Fall back to PATH-based check
  const result = await runAsync(`${name} ${versionFlag}`, 5000);
  if (result) return result.split('\n').pop()?.trim() || result;

  return null;
}

async function checkNode(): Promise<{ installed: boolean; version: string | null }> {
  const home = process.env.HOME || '';
  const knownPaths = [
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
  ];
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      knownPaths.push(join(nvmDir, v, 'bin/node'));
    }
  } catch { /* no nvm */ }

  const version = await tryBinary('node', '--version', knownPaths);
  return { installed: !!version, version };
}

async function checkDocker(): Promise<PrerequisiteStatus['docker']> {
  const knownPaths = [
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
  ];
  const version = await tryBinary('docker', '--version', knownPaths);
  if (!version) return { installed: false, running: false, version: null };

  // Check if running — try docker ps first, then check if Docker.app process exists
  const running = await runAsync('docker ps -q', 8000);
  if (running !== null) return { installed: true, running: true, version };
  // Fallback: check if Docker process is running (docker ps may fail while Docker is still starting)
  const proc = await runAsync('pgrep -x Docker', 3000);
  return { installed: true, running: proc !== null, version };
}

async function checkClaude(): Promise<PrerequisiteStatus['claude']> {
  const home = process.env.HOME || '';
  const knownPaths = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    join(home, '.local/bin/claude'),
    join(home, '.npm-global/bin/claude'),
  ];
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      knownPaths.push(join(nvmDir, v, 'bin/claude'));
    }
  } catch { /* no nvm */ }

  const version = await tryBinary('claude', '--version', knownPaths);
  return { installed: !!version, version };
}

async function checkKyberbot(): Promise<{ installed: boolean; version: string | null }> {
  const home = process.env.HOME || '';
  const knownPaths = [
    join(home, '.kyberbot/bin/kyberbot'),
    '/usr/local/bin/kyberbot',
    '/opt/homebrew/bin/kyberbot',
    join(home, '.local/bin/kyberbot'),
    join(home, 'Library/pnpm/kyberbot'),
    join(home, '.npm-global/bin/kyberbot'),
  ];
  try {
    const nvmDir = join(home, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      knownPaths.push(join(nvmDir, v, 'bin/kyberbot'));
    }
  } catch { /* no nvm */ }

  const version = await tryBinary('kyberbot', '--version', knownPaths);
  return { installed: !!version, version };
}

function checkAgentRoot(store: AppStore): PrerequisiteStatus['agentRoot'] {
  const path = store.getAgentRoot();
  if (!path) return { configured: false, path: null, hasIdentity: false };
  const hasIdentity = existsSync(join(path, 'identity.yaml'));
  return { configured: true, path, hasIdentity };
}
