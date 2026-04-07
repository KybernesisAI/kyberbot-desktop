/**
 * Update checker — desktop app (via electron-updater) and CLI (via kyberbot update --check).
 * Pushes update availability to the renderer. No dialogs — the title bar shows badges.
 */

import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import { execSync } from 'child_process';

const log = {
  info: (...args: unknown[]) => console.log('[updater]', ...args),
  warn: (...args: unknown[]) => console.warn('[updater]', ...args),
  error: (...args: unknown[]) => console.error('[updater]', ...args),
};

interface UpdateState {
  appUpdateAvailable: boolean;
  appVersion: string | null;
  cliUpdateAvailable: boolean;
  cliUpdateSummary: string | null;
}

const state: UpdateState = {
  appUpdateAvailable: false,
  appVersion: null,
  cliUpdateAvailable: false,
  cliUpdateSummary: null,
};

let _getMainWindow: (() => BrowserWindow | null) | null = null;

function pushState(): void {
  const win = _getMainWindow?.();
  if (win && !win.isDestroyed()) {
    win.webContents.send('updater:state', state);
  }
}

export function setupAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  _getMainWindow = getMainWindow;

  // ── IPC handlers ──

  ipcMain.handle('updater:getState', () => state);

  ipcMain.handle('updater:installAppUpdate', async () => {
    if (!state.appUpdateAvailable) return { ok: false, error: 'No update available' };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall(false, true); // isSilent=false, isForceRunAfter=true
  });

  ipcMain.handle('updater:updateCli', async () => {
    if (!state.cliUpdateAvailable) return { ok: false, error: 'No update available' };
    try {
      const result = execSync('kyberbot update', {
        encoding: 'utf-8',
        timeout: 120_000,
        env: { ...process.env, PATH: getFullPath() },
      });
      state.cliUpdateAvailable = false;
      state.cliUpdateSummary = null;
      pushState();
      return { ok: true, output: result };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── Desktop app update check (electron-updater) ──

  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      log.info('App update available:', info.version);
      state.appUpdateAvailable = true;
      state.appVersion = info.version;
      pushState();
    });

    autoUpdater.on('update-not-available', () => {
      state.appUpdateAvailable = false;
      state.appVersion = null;
    });

    autoUpdater.on('update-downloaded', () => {
      const win = _getMainWindow?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send('updater:downloaded');
      }
    });

    autoUpdater.on('error', (err) => {
      log.warn('App update check failed:', err.message);
    });

    // Check after 10s, then every 6 hours
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 10_000);

    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 6 * 60 * 60 * 1000);
  }

  // ── CLI update check ──

  setTimeout(() => checkCliUpdate(), 15_000);
  setInterval(() => checkCliUpdate(), 6 * 60 * 60 * 1000);
}

async function checkCliUpdate(): Promise<void> {
  try {
    // Get installed CLI version — try multiple approaches
    let installed = '';
    const fullPath = getFullPath();

    // Approach 1: kyberbot --version
    try {
      installed = execSync('kyberbot --version', {
        encoding: 'utf-8',
        timeout: 10_000,
        env: { ...process.env, PATH: fullPath },
      }).trim().replace(/^v/, '');
    } catch {
      log.info('kyberbot --version failed, trying package.json lookup');
    }

    // Approach 2: read version from the CLI's package.json directly
    if (!installed) {
      try {
        const { homedir } = require('os');
        const { join, existsSync, realpathSync } = require('path');
        const { readFileSync } = require('fs');
        const home = homedir();

        // Find kyberbot binary and resolve to real path
        const whichResult = execSync('which kyberbot', {
          encoding: 'utf-8',
          timeout: 5_000,
          env: { ...process.env, PATH: fullPath },
        }).trim();

        if (whichResult) {
          // Binary is a symlink to dist/index.cjs — resolve and find package.json
          const realBin = realpathSync(whichResult);
          // <pkg>/dist/index.cjs → <pkg>/package.json
          const pkgPath = join(realBin, '..', '..', 'package.json');
          if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            installed = pkg.version || '';
            log.info('CLI version from package.json:', installed);
          }
        }
      } catch {
        log.warn('Could not find CLI version from package.json either');
      }
    }

    if (!installed) {
      log.warn('CLI not found — cannot check for updates');
      return;
    }

    log.info('CLI installed version:', installed);

    // Check GitHub releases API directly — no git/SSH required
    const res = await fetch('https://api.github.com/repos/KybernesisAI/kyberbot/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'kyberbot-desktop' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      log.warn('GitHub API returned', res.status);
      return;
    }

    const data = await res.json() as { tag_name?: string; html_url?: string };
    const latest = (data.tag_name || '').replace(/^v/, '');

    if (!latest) {
      log.warn('No version tag in latest release');
      return;
    }

    log.info('CLI latest release:', latest, '| installed:', installed, '| match:', latest === installed);

    if (latest !== installed) {
      state.cliUpdateAvailable = true;
      state.cliUpdateSummary = `${installed} → ${latest}`;
      log.info('CLI update available:', state.cliUpdateSummary);
    } else {
      state.cliUpdateAvailable = false;
      state.cliUpdateSummary = null;
      log.info('CLI is up to date');
    }
    pushState();
  } catch (err) {
    log.warn('CLI update check failed:', String(err));
  }
}

let _cachedShellPath: string | null = null;

function getFullPath(): string {
  if (_cachedShellPath) return _cachedShellPath;

  // Try to get the user's real shell PATH by running a login shell
  // This picks up nvm, homebrew, and any other PATH modifications from .zshrc/.bashrc
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const shellPath = execSync(`${shell} -ilc "echo $PATH"`, {
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (shellPath && shellPath.length > 10) {
      _cachedShellPath = shellPath;
      log.info('Resolved shell PATH (' + shellPath.split(':').length + ' entries)');
      return shellPath;
    }
  } catch (err) {
    log.warn('Could not resolve shell PATH:', String(err));
  }

  // Fallback: manually construct PATH with common locations
  const { homedir } = require('os');
  const { join, existsSync } = require('path');
  const home = homedir();
  const paths: string[] = [];
  try {
    const nvmDir = join(home, '.nvm', 'versions', 'node');
    const { readdirSync } = require('fs');
    if (existsSync(nvmDir)) {
      const versions = readdirSync(nvmDir).filter((v: string) => v.startsWith('v')).sort().reverse();
      for (const v of versions) paths.push(join(nvmDir, v, 'bin'));
    }
  } catch {}
  paths.push(join(home, '.local', 'bin'), '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin');
  _cachedShellPath = paths.join(':') + ':' + (process.env.PATH || '');
  return _cachedShellPath;
}
