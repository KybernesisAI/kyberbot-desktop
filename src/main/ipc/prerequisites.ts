/**
 * Prerequisite detection and one-click installation.
 * Node.js, Docker Desktop, Claude Code CLI, KyberBot CLI — all required.
 *
 * Design principles:
 * - NEVER use execSync for binary detection (blocks main thread)
 * - NEVER use login shells (zsh -ilc hangs with oh-my-zsh etc)
 * - Check known filesystem paths directly — no PATH guessing
 * - Lock the Node binary at install time to prevent MODULE_VERSION mismatches
 * - All checks run in parallel via Promise.all
 */

import { ipcMain, shell, BrowserWindow } from 'electron';
import { execSync, spawn } from 'child_process';
import { existsSync, readdirSync, createWriteStream, readFileSync, writeFileSync, mkdirSync, chmodSync, appendFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, arch, homedir } from 'os';
import { IPC, PrerequisiteStatus } from '../../types/ipc.js';
import { AppStore } from '../store.js';

const HOME = homedir();

// ═══════════════════════════════════════════════════════════════════════════════
// PATH CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build PATH from known binary locations. Pure filesystem — no shell, no exec.
 */
function buildPath(): string {
  const extras = [
    join(HOME, '.kyberbot/bin'),
    join(HOME, 'Library/pnpm'),
    join(HOME, '.pnpm-global/bin'),
    join(HOME, '.local/bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/Applications/Docker.app/Contents/Resources/bin',
    join(HOME, '.npm-global/bin'),
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];
  const nvmPaths: string[] = [];
  try {
    const nvmDir = join(HOME, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      nvmPaths.push(join(nvmDir, v, 'bin'));
    }
  } catch { /* no nvm */ }

  return [...new Set([...nvmPaths, ...extras, ...(process.env.PATH || '').split(':')])].filter(Boolean).join(':');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNC COMMAND RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run a command async. Never blocks. Returns stdout on success, null on failure.
 */
function runCmd(cmd: string, opts: { cwd?: string; timeoutMs?: number; env?: Record<string, string> } = {}): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', cmd], {
      cwd: opts.cwd,
      env: { ...process.env, PATH: buildPath(), HOME, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    proc.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { output += d.toString(); });
    proc.on('close', (code) => resolve({ ok: code === 0, output: output.trim() }));
    proc.on('error', (err) => resolve({ ok: false, output: err.message }));
    const timeout = opts.timeoutMs || 30_000;
    setTimeout(() => { try { proc.kill(); } catch {} resolve({ ok: false, output: output + '\nCommand timed out' }); }, timeout);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NODE BINARY RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find the best Node.js binary. Returns absolute path or null.
 * Prefers Node 20-24 (our supported range). Checks nvm, /usr/local, homebrew.
 */
function findNodeBinary(): string | null {
  const candidates: string[] = [];

  // nvm versions — prefer 22, then 20, then newest
  try {
    const nvmDir = join(HOME, '.nvm/versions/node');
    const versions = readdirSync(nvmDir).sort().reverse();
    // Prefer v22 LTS
    const v22 = versions.find(v => v.startsWith('v22'));
    if (v22) candidates.push(join(nvmDir, v22, 'bin/node'));
    const v20 = versions.find(v => v.startsWith('v20'));
    if (v20) candidates.push(join(nvmDir, v20, 'bin/node'));
    // Then all others
    for (const v of versions) {
      candidates.push(join(nvmDir, v, 'bin/node'));
    }
  } catch { /* no nvm */ }

  // Standard locations
  candidates.push('/usr/local/bin/node', '/opt/homebrew/bin/node');

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Get the Node binary that was used to build the CLI (locked at install time).
 * Falls back to findNodeBinary() if no lock file exists.
 */
function getLockedNodeBinary(): string | null {
  const lockFile = join(HOME, '.kyberbot', 'node_path');
  try {
    const locked = readFileSync(lockFile, 'utf-8').trim();
    if (existsSync(locked)) return locked;
  } catch { /* no lock file */ }
  return findNodeBinary();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BINARY DETECTION (fully async, never blocks)
// ═══════════════════════════════════════════════════════════════════════════════

async function checkBinary(knownPaths: string[], name: string, versionFlag: string): Promise<string | null> {
  // Check known paths first (instant filesystem check + async exec)
  for (const p of knownPaths) {
    if (existsSync(p)) {
      const result = await runCmd(`"${p}" ${versionFlag}`, { timeoutMs: 8000 });
      if (result.ok && result.output) {
        return result.output.split('\n').pop()?.trim() || result.output;
      }
    }
  }
  // Fall back to PATH
  const result = await runCmd(`${name} ${versionFlag}`, { timeoutMs: 8000 });
  if (result.ok && result.output) {
    return result.output.split('\n').pop()?.trim() || result.output;
  }
  return null;
}

async function checkNode(): Promise<{ installed: boolean; version: string | null }> {
  const knownPaths = ['/usr/local/bin/node', '/opt/homebrew/bin/node'];
  try {
    const nvmDir = join(HOME, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      knownPaths.push(join(nvmDir, v, 'bin/node'));
    }
  } catch {}
  const version = await checkBinary(knownPaths, 'node', '--version');
  return { installed: !!version, version };
}

async function checkDocker(): Promise<PrerequisiteStatus['docker']> {
  const knownPaths = [
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
  ];
  const version = await checkBinary(knownPaths, 'docker', '--version');
  if (!version) return { installed: false, running: false, version: null };

  // Check if daemon is running — docker ps is fast when daemon is up
  const ps = await runCmd('docker ps -q', { timeoutMs: 8000 });
  if (ps.ok) return { installed: true, running: true, version };

  // Fallback: check if Docker Desktop process is running (daemon might be starting)
  const pgrep = await runCmd('pgrep -x Docker', { timeoutMs: 3000 });
  return { installed: true, running: pgrep.ok, version };
}

async function checkClaude(): Promise<PrerequisiteStatus['claude']> {
  const knownPaths = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    join(HOME, '.local/bin/claude'),
    join(HOME, '.npm-global/bin/claude'),
  ];
  try {
    const nvmDir = join(HOME, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      knownPaths.push(join(nvmDir, v, 'bin/claude'));
    }
  } catch {}
  const version = await checkBinary(knownPaths, 'claude', '--version');
  return { installed: !!version, version };
}

async function checkKyberbot(): Promise<{ installed: boolean; version: string | null }> {
  const knownPaths = [
    join(HOME, '.kyberbot/bin/kyberbot'),
    '/usr/local/bin/kyberbot',
    '/opt/homebrew/bin/kyberbot',
    join(HOME, '.local/bin/kyberbot'),
    join(HOME, 'Library/pnpm/kyberbot'),
    join(HOME, '.npm-global/bin/kyberbot'),
  ];
  try {
    const nvmDir = join(HOME, '.nvm/versions/node');
    for (const v of readdirSync(nvmDir).sort().reverse()) {
      knownPaths.push(join(nvmDir, v, 'bin/kyberbot'));
    }
  } catch {}
  const version = await checkBinary(knownPaths, 'kyberbot', '--version');
  return { installed: !!version, version };
}

function checkAgentRoot(store: AppStore): PrerequisiteStatus['agentRoot'] {
  const path = store.getAgentRoot();
  if (!path) return { configured: false, path: null, hasIdentity: false };
  const hasIdentity = existsSync(join(path, 'identity.yaml'));
  return { configured: true, path, hasIdentity };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function registerPrerequisiteHandlers(store: AppStore): void {
  // ── Prerequisite check (runs every 3s from renderer) ──
  ipcMain.handle(IPC.PREREQ_CHECK, async (): Promise<PrerequisiteStatus> => {
    const [node, docker, claude, kyberbot] = await Promise.all([
      checkNode(), checkDocker(), checkClaude(), checkKyberbot(),
    ]);
    const agentRoot = checkAgentRoot(store);
    return { node, docker, claude, kyberbot, agentRoot };
  });

  // ── Open external URL ──
  ipcMain.handle('prerequisites:openUrl', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // ── Install Node.js (downloads .pkg, opens macOS installer) ──
  ipcMain.handle('prerequisites:installNode', async () => {
    try {
      const nodeArch = arch() === 'arm64' ? 'arm64' : 'x64';
      const res = await fetch('https://nodejs.org/dist/index.json', { signal: AbortSignal.timeout(10000) });
      const versions = await res.json() as Array<{ version: string; lts: string | false }>;
      const lts22 = versions.find(v => v.version.startsWith('v22') && v.lts);
      if (!lts22) return { ok: false, error: 'Could not find Node 22 LTS version' };

      const ver = lts22.version;
      const pkgUrl = `https://nodejs.org/dist/${ver}/node-${ver}.pkg`;
      const pkgPath = join(tmpdir(), `node-${ver}.pkg`);

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

      execSync(`open "${pkgPath}"`, { stdio: 'pipe' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── Install npm package (Claude Code) ──
  ipcMain.handle('prerequisites:npmInstall', async (_event, pkg: string) => {
    if (pkg === 'kyberbot-cli') return installKyberbotCli();

    // Try global install, fall back to user-local if permissions fail
    let result = await runCmd(`npm install -g ${pkg}`, { timeoutMs: 120_000 });
    if (!result.ok && (result.output.includes('EACCES') || result.output.includes('permission'))) {
      // Permission denied — try user-local prefix
      result = await runCmd(`npm install -g --prefix "$HOME/.local" ${pkg}`, { timeoutMs: 120_000 });
    }
    return { ok: result.ok, stdout: result.output, stderr: result.ok ? '' : result.output };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// KYBERBOT CLI INSTALLER
// ═══════════════════════════════════════════════════════════════════════════════

function emitProgress(msg: string): void {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('prerequisites:installProgress', msg);
    }
  } catch { /* non-fatal */ }
}

async function installKyberbotCli(): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const sourceDir = join(HOME, '.kyberbot', 'source');
  const repoUrl = 'https://github.com/KybernesisAI/kyberbot.git';
  let log = '';

  const step = async (label: string, cmd: string, cwd?: string, timeoutMs?: number): Promise<boolean> => {
    log += `\n→ ${label}...\n`;
    emitProgress(label + '...');
    const result = await runCmd(cmd, { cwd, timeoutMs: timeoutMs || 180_000 });
    log += result.output + '\n';
    if (!result.ok) log += `✗ ${label} failed\n`;
    return result.ok;
  };

  try {
    // ── Step 1: Find Node ──
    const nodeBin = findNodeBinary();
    if (!nodeBin) {
      return { ok: false, stdout: log, stderr: 'Node.js not found. Install Node.js first.' };
    }
    log += `Using Node: ${nodeBin}\n`;

    // Verify Node version is in our supported range (20-24)
    const nodeVersionResult = await runCmd(`"${nodeBin}" --version`, { timeoutMs: 5000 });
    if (nodeVersionResult.ok) {
      const match = nodeVersionResult.output.match(/v(\d+)/);
      const major = match ? parseInt(match[1]) : 0;
      if (major < 20 || major >= 25) {
        return { ok: false, stdout: log, stderr: `Node ${nodeVersionResult.output.trim()} is not supported. Install Node 20 or 22 LTS.` };
      }
      log += `Node version: ${nodeVersionResult.output.trim()} ✓\n`;
    }

    // ── Step 2: Clone or pull ──
    mkdirSync(join(HOME, '.kyberbot'), { recursive: true });
    if (existsSync(join(sourceDir, '.git'))) {
      if (!await step('Pulling latest code', 'git pull origin main', sourceDir)) {
        return { ok: false, stdout: log, stderr: 'git pull failed' };
      }
    } else {
      if (!await step('Cloning KyberBot repository', `git clone ${repoUrl} "${sourceDir}"`)) {
        return { ok: false, stdout: log, stderr: 'git clone failed' };
      }
    }

    // ── Step 3: Ensure pnpm ──
    const hasPnpm = await runCmd('pnpm --version', { timeoutMs: 5000 });
    if (!hasPnpm.ok) {
      // Try npm install -g pnpm
      if (!await step('Installing pnpm via npm', 'npm install -g pnpm')) {
        // Try corepack
        if (!await step('Installing pnpm via corepack', 'corepack enable && corepack prepare pnpm@latest --activate')) {
          return { ok: false, stdout: log, stderr: 'Failed to install pnpm. Try running "npm install -g pnpm" in terminal.' };
        }
      }
    } else {
      log += `pnpm: ${hasPnpm.output.trim()} ✓\n`;
    }

    // ── Step 4: Install dependencies ──
    if (!await step('Installing dependencies', 'pnpm install', sourceDir, 300_000)) {
      return { ok: false, stdout: log, stderr: 'pnpm install failed' };
    }

    // ── Step 5: Build ──
    if (!await step('Building KyberBot CLI', 'pnpm run build', sourceDir, 120_000)) {
      return { ok: false, stdout: log, stderr: 'Build failed' };
    }

    // ── Step 6: Lock the Node binary ──
    // Save the exact Node path used during this build.
    // The wrapper will use THIS binary, preventing MODULE_VERSION mismatches.
    const lockFile = join(HOME, '.kyberbot', 'node_path');
    writeFileSync(lockFile, nodeBin, 'utf-8');
    log += `Locked Node binary: ${nodeBin}\n`;

    // ── Step 7: Create bash wrapper ──
    const binDir = join(HOME, '.kyberbot', 'bin');
    const binPath = join(binDir, 'kyberbot');
    const cliEntry = join(sourceDir, 'packages', 'cli', 'dist', 'index.js');
    mkdirSync(binDir, { recursive: true });

    // The wrapper uses the LOCKED Node binary — the same one that compiled better-sqlite3.
    // If the locked binary is missing, it falls back to discovery.
    // If there's a MODULE_VERSION mismatch, it auto-rebuilds better-sqlite3.
    const wrapper = `#!/bin/bash
# KyberBot CLI — installed by KyberBot Desktop
# Node binary is locked to the version used during build to prevent
# MODULE_VERSION mismatches with better-sqlite3.

LOCK_FILE="$HOME/.kyberbot/node_path"
CLI_ENTRY="${cliEntry}"
SOURCE_DIR="${sourceDir}"

# Read locked Node binary
if [ -f "$LOCK_FILE" ]; then
  NODE=$(cat "$LOCK_FILE")
fi

# Verify locked binary exists
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  # Lock file missing or binary gone — find Node
  if [ -d "$HOME/.nvm/versions/node" ]; then
    NODE=$(ls -d "$HOME/.nvm/versions/node"/v*/bin/node 2>/dev/null | sort -V | tail -1)
  fi
  [ -z "$NODE" ] && [ -x /usr/local/bin/node ] && NODE=/usr/local/bin/node
  [ -z "$NODE" ] && [ -x /opt/homebrew/bin/node ] && NODE=/opt/homebrew/bin/node
  [ -z "$NODE" ] && NODE=$(which node 2>/dev/null)
  [ -z "$NODE" ] && echo "Error: Node.js not found" && exit 1
fi

# Run KyberBot — auto-rebuild better-sqlite3 on MODULE_VERSION mismatch
OUTPUT=$("$NODE" "$CLI_ENTRY" "$@" 2>&1)
EXIT_CODE=$?

if echo "$OUTPUT" | grep -q "NODE_MODULE_VERSION"; then
  echo "Rebuilding better-sqlite3 for current Node version..."
  cd "$SOURCE_DIR" && pnpm rebuild better-sqlite3 2>/dev/null
  # Update lock file to current Node
  echo "$NODE" > "$LOCK_FILE"
  # Retry
  exec "$NODE" "$CLI_ENTRY" "$@"
fi

echo "$OUTPUT"
exit $EXIT_CODE
`;

    writeFileSync(binPath, wrapper, 'utf-8');
    chmodSync(binPath, '755');
    log += `Created wrapper: ${binPath}\n`;

    // ── Step 8: Add to shell profiles ──
    const profilePaths = [join(HOME, '.zshrc'), join(HOME, '.bashrc'), join(HOME, '.bash_profile')];
    const pathLine = `export PATH="$HOME/.kyberbot/bin:$PATH"`;
    for (const profilePath of profilePaths) {
      try {
        if (existsSync(profilePath)) {
          const content = readFileSync(profilePath, 'utf-8');
          if (!content.includes('.kyberbot/bin')) {
            appendFileSync(profilePath, `\n# KyberBot CLI\n${pathLine}\n`);
            log += `Added to PATH: ${profilePath}\n`;
          }
        }
      } catch { /* non-fatal */ }
    }

    // ── Step 9: Verify ──
    const verify = await runCmd(`"${binPath}" --version`, { timeoutMs: 15000 });
    if (!verify.ok) {
      log += `Verification failed: ${verify.output}\n`;
      return { ok: false, stdout: log, stderr: 'KyberBot CLI installed but failed to run. Check the log for details.' };
    }
    log += `\n✓ KyberBot CLI ${verify.output.trim()} installed successfully\n`;

    return { ok: true, stdout: log, stderr: '' };
  } catch (err) {
    return { ok: false, stdout: log, stderr: String(err) };
  }
}
