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
    autoUpdater.quitAndInstall();
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

function checkCliUpdate(): void {
  try {
    const output = execSync('kyberbot update --check', {
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env, PATH: getFullPath() },
    });

    log.info('CLI update check output:', output.trim().slice(0, 300));

    // If output contains indicators of available updates
    const hasUpdate = output.includes('would change') ||
                      output.includes('available') ||
                      output.includes('behind') ||
                      output.includes('new version');

    if (hasUpdate && !output.includes('up to date')) {
      state.cliUpdateAvailable = true;
      state.cliUpdateSummary = output.trim().slice(0, 200);
      log.info('CLI update available');
    } else {
      state.cliUpdateAvailable = false;
      state.cliUpdateSummary = null;
    }
    pushState();
  } catch (err) {
    log.warn('CLI update check failed:', String(err));
  }
}

function getFullPath(): string {
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
  return paths.join(':') + ':' + (process.env.PATH || '');
}
