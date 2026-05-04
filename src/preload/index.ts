/**
 * Preload — contextBridge exposing window.kyberbot
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../types/ipc.js';
import type { PrerequisiteStatus, HealthData, IdentityConfig, EnvConfig } from '../types/ipc.js';

const api = {
  window: {
    minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  },

  prerequisites: {
    check: (): Promise<PrerequisiteStatus> => ipcRenderer.invoke(IPC.PREREQ_CHECK),
    openUrl: (url: string): Promise<void> => ipcRenderer.invoke('prerequisites:openUrl', url),
    installNode: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('prerequisites:installNode'),
    npmInstall: (pkg: string): Promise<{ ok: boolean; stdout: string; stderr: string }> =>
      ipcRenderer.invoke('prerequisites:npmInstall', pkg),
    onInstallProgress: (callback: (msg: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, msg: string) => callback(msg);
      ipcRenderer.on('prerequisites:installProgress', handler);
      return () => ipcRenderer.removeListener('prerequisites:installProgress', handler);
    },
  },

  services: {
    start: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.SERVICES_START),
    stop: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.SERVICES_STOP),
    getStatus: (): Promise<any> => ipcRenderer.invoke(IPC.SERVICES_STATUS),
    getAgentState: (root: string): Promise<{ status: string; health: any; isRunning: boolean }> =>
      ipcRenderer.invoke('services:getAgentState', root),
    onHealthUpdate: (callback: (health: HealthData, root?: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, health: HealthData, root?: string) => callback(health, root);
      ipcRenderer.on(IPC.SERVICES_HEALTH_UPDATE, handler);
      return () => ipcRenderer.removeListener(IPC.SERVICES_HEALTH_UPDATE, handler);
    },
    onStatusChange: (callback: (status: string, root?: string | null) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: string, root?: string | null) => callback(status, root);
      ipcRenderer.on('services:status-change', handler);
      return () => ipcRenderer.removeListener('services:status-change', handler);
    },
    onAgentStatusChange: (callback: (root: string, status: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, root: string, status: string) => callback(root, status);
      ipcRenderer.on('services:agent-status-change', handler);
      return () => ipcRenderer.removeListener('services:agent-status-change', handler);
    },
  },

  config: {
    getAgentRoot: (): Promise<string | null> => ipcRenderer.invoke(IPC.CONFIG_GET_AGENT_ROOT),
    setAgentRoot: (path: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC.CONFIG_SET_AGENT_ROOT, path),
    selectAgentRoot: (): Promise<{ path: string; hasIdentity: boolean } | null> =>
      ipcRenderer.invoke('config:selectAgentRoot'),
    getApiToken: (): Promise<string | null> => ipcRenderer.invoke(IPC.CONFIG_GET_API_TOKEN),
    getServerUrl: (): Promise<string> => ipcRenderer.invoke(IPC.CONFIG_GET_SERVER_URL),
    readIdentity: (): Promise<IdentityConfig | null> => ipcRenderer.invoke(IPC.CONFIG_READ_IDENTITY),
    writeIdentity: (changes: Partial<IdentityConfig>): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC.CONFIG_WRITE_IDENTITY, changes),
    readEnv: (): Promise<EnvConfig> => ipcRenderer.invoke(IPC.CONFIG_READ_ENV),
    writeEnv: (env: EnvConfig): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC.CONFIG_WRITE_ENV, env),
    saveUpload: (fileName: string, base64Data: string): Promise<{ ok: boolean; path: string }> =>
      ipcRenderer.invoke(IPC.CONFIG_SAVE_UPLOAD, fileName, base64Data),
    selectWatchedFolder: (): Promise<string | null> =>
      ipcRenderer.invoke('config:selectWatchedFolder'),
  },

  logs: {
    onLine: (callback: (line: string, root?: string) => void): (() => void) => {
      // Listen to both old-style (IPC.LOGS_LINE) and new per-agent log events
      const handler1 = (_event: Electron.IpcRendererEvent, line: string) => callback(line);
      const handler2 = (_event: Electron.IpcRendererEvent, root: string, line: string) => callback(line, root);
      ipcRenderer.on(IPC.LOGS_LINE, handler1);
      ipcRenderer.on('services:log-line', handler2);
      return () => {
        ipcRenderer.removeListener(IPC.LOGS_LINE, handler1);
        ipcRenderer.removeListener('services:log-line', handler2);
      };
    },
  },

  brain: {
    popout: (): Promise<void> => ipcRenderer.invoke('brain:popout'),
  },

  updater: {
    getState: (): Promise<{ appUpdateAvailable: boolean; appVersion: string | null; cliUpdateAvailable: boolean; cliUpdateSummary: string | null }> =>
      ipcRenderer.invoke('updater:getState'),
    installAppUpdate: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('updater:installAppUpdate'),
    updateCli: (): Promise<{ ok: boolean; output?: string; error?: string }> =>
      ipcRenderer.invoke('updater:updateCli'),
    onStateChange: (callback: (state: any) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: any) => callback(state);
      ipcRenderer.on('updater:state', handler);
      return () => ipcRenderer.removeListener('updater:state', handler);
    },
    onDownloaded: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('updater:downloaded', handler);
      return () => ipcRenderer.removeListener('updater:downloaded', handler);
    },
    quitAndInstall: (): Promise<void> => ipcRenderer.invoke('updater:quitAndInstall'),
  },

  onboarding: {
    create: (data: {
      agentRoot: string;
      agentName: string;
      agentDescription: string;
      userName: string;
      timezone: string;
      claudeMode: 'subscription' | 'sdk';
      apiKey?: string;
    }): Promise<{ ok: boolean; path: string }> => ipcRenderer.invoke(IPC.ONBOARD_CREATE, data),
  },

  fleet: {
    list: (): Promise<Array<{ name: string; root: string; port: number; description: string; registered: string; running: boolean; type: 'local' | 'remote'; remoteUrl?: string; remoteToken?: string }>> =>
      ipcRenderer.invoke('fleet:list'),
    register: (rootPath: string): Promise<{ ok: boolean; name: string }> =>
      ipcRenderer.invoke('fleet:register', rootPath),
    unregister: (name: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('fleet:unregister', name),
    registerRemote: (name: string, url: string, token: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('fleet:register-remote', name, url, token),
    unregisterRemote: (name: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('fleet:unregister-remote', name),
    start: (agents: string[]): Promise<{ ok: boolean; status: string }> =>
      ipcRenderer.invoke('fleet:start', agents),
    stop: (): Promise<{ ok: boolean; status: string }> =>
      ipcRenderer.invoke('fleet:stop'),
    getStatus: (): Promise<{ status: string; fleetMode: boolean; fleet: any; health: any }> =>
      ipcRenderer.invoke('fleet:get-status'),
    addAgent: (name: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('fleet:add-agent', name),
    removeAgent: (name: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('fleet:remove-agent', name),
    onStatusUpdate: (callback: (fleet: any) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, fleet: any) => callback(fleet);
      ipcRenderer.on('fleet:status-update', handler);
      return () => ipcRenderer.removeListener('fleet:status-update', handler);
    },
    // Symphony-style snapshot API. Renderers should prefer these over
    // list/getStatus for live observability views.
    v1: {
      state: (): Promise<{ ok: boolean; data?: any; error?: string }> =>
        ipcRenderer.invoke('fleet:v1:state'),
      agent: (name: string): Promise<{ ok: boolean; data?: any; error?: string }> =>
        ipcRenderer.invoke('fleet:v1:agent', name),
      refresh: (): Promise<{ ok: boolean; queued?: boolean; coalesced?: boolean; error?: string }> =>
        ipcRenderer.invoke('fleet:v1:refresh'),
    },
  },
};

contextBridge.exposeInMainWorld('kyberbot', api);

// Type declaration for renderer
export type KyberbotAPI = typeof api;
