/**
 * Service lifecycle IPC handlers.
 * Proxies to the LifecycleManager for start/stop/status.
 * Pushes per-agent status and log events to the renderer.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../types/ipc.js';
import { LifecycleManager } from '../lifecycle.js';

export function registerServiceHandlers(
  lifecycle: LifecycleManager,
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(IPC.SERVICES_START, async () => {
    await lifecycle.startCli();
    return { ok: true, status: lifecycle.status };
  });

  ipcMain.handle(IPC.SERVICES_STOP, async () => {
    await lifecycle.stopCli();
    return { ok: true, status: lifecycle.status };
  });

  ipcMain.handle(IPC.SERVICES_STATUS, () => {
    const root = lifecycle.getAgentRoot();
    return {
      status: root ? lifecycle.getAgentStatus(root) : 'stopped',
      health: root ? lifecycle.getAgentHealth(root) : null,
      runningAgentRoot: lifecycle.getRunningAgentRoot(),
      runningRoots: lifecycle.getRunningAgentRoots(),
      isThisAgentRunning: root ? lifecycle.isAgentRunning(root) : false,
    };
  });

  // Per-agent state query — the renderer polls this for the viewed agent
  ipcMain.handle('services:getAgentState', (_event, root: string) => {
    return {
      status: lifecycle.getAgentStatus(root),
      health: lifecycle.getAgentHealth(root),
      isRunning: lifecycle.isAgentRunning(root),
    };
  });

  // Push per-agent status changes
  lifecycle.on('status-change', (status: string, root: string | null) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('services:status-change', status, root);
    }
  });

  lifecycle.on('agent-status-change', (root: string, status: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('services:agent-status-change', root, status);
    }
  });

  // Push per-agent health updates
  lifecycle.on('health-update', (root: string, health: any) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.SERVICES_HEALTH_UPDATE, health, root);
    }
  });

  // Push per-agent log lines
  lifecycle.on('log-line', (root: string, line: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('services:log-line', root, line);
    }
  });
}
