/**
 * Configuration IPC handlers.
 * Reads/writes identity.yaml and .env from the agent root.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as yaml from 'js-yaml';
import { config as dotenvParse } from 'dotenv';
import { IPC, IdentityConfig, EnvConfig } from '../../types/ipc.js';
import { AppStore } from '../store.js';

/**
 * Auto-register an agent directory in ~/.kyberbot/registry.yaml if not already present.
 * Ensures pre-registry agents show up in the fleet dropdown when opened.
 */
function ensureRegistered(agentRoot: string): void {
  try {
    const identityPath = join(agentRoot, 'identity.yaml');
    if (!existsSync(identityPath)) return;

    const identity = yaml.load(readFileSync(identityPath, 'utf-8')) as Record<string, any> | null;
    if (!identity?.agent_name) return;

    const name = (identity.agent_name as string).toLowerCase();
    const registryDir = join(homedir(), '.kyberbot');
    const registryPath = join(registryDir, 'registry.yaml');

    interface RegistryData { agents: Record<string, { root: string; registered: string }>; }
    let registry: RegistryData = { agents: {} };
    try {
      const raw = readFileSync(registryPath, 'utf-8');
      const parsed = yaml.load(raw) as RegistryData | null;
      if (parsed?.agents) registry = parsed;
    } catch { /* no registry yet */ }

    // Already registered (by name or by root) — skip
    if (registry.agents[name]) return;
    const alreadyByRoot = Object.values(registry.agents).some(a => a.root === agentRoot);
    if (alreadyByRoot) return;

    if (!existsSync(registryDir)) mkdirSync(registryDir, { recursive: true });
    registry.agents[name] = { root: agentRoot, registered: new Date().toISOString() };
    writeFileSync(registryPath, yaml.dump(registry, { lineWidth: 120 }), 'utf-8');
  } catch { /* non-fatal */ }
}

export function registerConfigHandlers(store: AppStore): void {
  // Directory picker for selecting agent root
  ipcMain.handle('config:selectAgentRoot', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Agent Directory',
      message: 'Choose the directory containing your KyberBot agent (must have identity.yaml)',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const dir = result.filePaths[0];
    const hasIdentity = existsSync(join(dir, 'identity.yaml'));

    if (hasIdentity) {
      store.setAgentRoot(dir);
      ensureRegistered(dir);
    }

    return { path: dir, hasIdentity };
  });
  ipcMain.handle(IPC.CONFIG_GET_AGENT_ROOT, () => {
    return store.getAgentRoot();
  });

  ipcMain.handle(IPC.CONFIG_SET_AGENT_ROOT, (_event, path: string) => {
    store.setAgentRoot(path);
    ensureRegistered(path);
    return { ok: true };
  });

  ipcMain.handle(IPC.CONFIG_GET_API_TOKEN, () => {
    const root = store.getAgentRoot();
    if (!root) return null;
    const envPath = join(root, '.env');
    if (!existsSync(envPath)) return null;
    // Parse .env file directly instead of relying on dotenv.config()
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('KYBERBOT_API_TOKEN=')) {
        let value = trimmed.slice('KYBERBOT_API_TOKEN='.length).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return value;
      }
    }
    return process.env.KYBERBOT_API_TOKEN ?? null;
  });

  ipcMain.handle(IPC.CONFIG_GET_SERVER_URL, () => {
    const root = store.getAgentRoot();
    let port = 3456;
    if (root) {
      try {
        const identityPath = join(root, 'identity.yaml');
        const identity = yaml.load(readFileSync(identityPath, 'utf-8')) as Record<string, any>;
        port = identity?.server?.port ?? 3456;
      } catch { /* use default */ }
    }
    return `http://localhost:${port}`;
  });

  ipcMain.handle(IPC.CONFIG_READ_IDENTITY, () => {
    const root = store.getAgentRoot();
    if (!root) return null;
    try {
      const identityPath = join(root, 'identity.yaml');
      return yaml.load(readFileSync(identityPath, 'utf-8')) as IdentityConfig;
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC.CONFIG_WRITE_IDENTITY, (_event, changes: Partial<IdentityConfig>) => {
    const root = store.getAgentRoot();
    if (!root) throw new Error('Agent root not configured');
    const identityPath = join(root, 'identity.yaml');
    const current = yaml.load(readFileSync(identityPath, 'utf-8')) as Record<string, unknown>;
    Object.assign(current, changes);
    writeFileSync(identityPath, yaml.dump(current, { lineWidth: 120 }), 'utf-8');
    return { ok: true };
  });

  ipcMain.handle(IPC.CONFIG_READ_ENV, () => {
    const root = store.getAgentRoot();
    if (!root) return {};
    const envPath = join(root, '.env');
    if (!existsSync(envPath)) return {};
    const content = readFileSync(envPath, 'utf-8');
    const result: EnvConfig = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        result[key] = value;
      }
    }
    return result;
  });

  ipcMain.handle(IPC.CONFIG_WRITE_ENV, (_event, env: EnvConfig) => {
    const root = store.getAgentRoot();
    if (!root) throw new Error('Agent root not configured');
    const envPath = join(root, '.env');
    const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
    writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
    return { ok: true };
  });

  // Save uploaded file to agent's uploads directory, return the file path
  ipcMain.handle(IPC.CONFIG_SAVE_UPLOAD, (_event, fileName: string, base64Data: string) => {
    const root = store.getAgentRoot();
    if (!root) throw new Error('Agent root not configured');
    const uploadsDir = join(root, 'uploads');
    if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
    // Add timestamp to avoid collisions
    const ts = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = join(uploadsDir, `${ts}-${safeName}`);
    const buffer = Buffer.from(base64Data, 'base64');
    writeFileSync(filePath, buffer);
    return { ok: true, path: filePath };
  });
}
