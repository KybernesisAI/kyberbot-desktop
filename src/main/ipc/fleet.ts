/**
 * Fleet IPC handlers — desktop reads ~/.kyberbot/registry.yaml directly.
 * Avoids ESM/CJS issues by not importing from the CLI package.
 *
 * Phase 4B adds fleet lifecycle handlers (start/stop/status/add/remove)
 * that proxy to the LifecycleManager.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as yaml from 'js-yaml';
import { LifecycleManager, FleetStatus } from '../lifecycle.js';

// ── Types ──

interface RegistryAgent {
  root: string;
  registered: string;
  type?: 'local' | 'remote';
  remoteUrl?: string;
  remoteToken?: string;
}

interface RegistryData {
  agents: Record<string, RegistryAgent>;
  defaults?: { auto_start?: string[] };
}

interface AgentInfo {
  name: string;
  root: string;
  port: number;
  description: string;
  registered: string;
  running: boolean;
  type: 'local' | 'remote';
  remoteUrl?: string;
  remoteToken?: string;
  missing?: boolean;
}

// ── Helpers ──

const REGISTRY_DIR = join(homedir(), '.kyberbot');
const REGISTRY_PATH = join(REGISTRY_DIR, 'registry.yaml');

function readRegistry(): RegistryData {
  try {
    const raw = readFileSync(REGISTRY_PATH, 'utf-8');
    const data = yaml.load(raw) as RegistryData | null;
    return data && data.agents ? data : { agents: {} };
  } catch {
    return { agents: {} };
  }
}

function writeRegistry(data: RegistryData): void {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
  writeFileSync(REGISTRY_PATH, yaml.dump(data, { lineWidth: 120 }), 'utf-8');
}

function readIdentityFromRoot(rootPath: string): { agent_name: string; port: number; agent_description: string } {
  const defaults = { agent_name: 'unknown', port: 3456, agent_description: '' };
  try {
    const raw = readFileSync(join(rootPath, 'identity.yaml'), 'utf-8');
    const id = yaml.load(raw) as Record<string, unknown> | null;
    if (!id) return defaults;
    return {
      agent_name: (id.agent_name as string) || defaults.agent_name,
      port: (id.server as any)?.port ?? defaults.port,
      agent_description: (id.agent_description as string) || defaults.agent_description,
    };
  } catch {
    return defaults;
  }
}

async function probeHealth(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://localhost:${port}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

function getFleetServerPort(): number {
  // Fleet server always runs on port 3456 (the shared process port)
  return 3456;
}

// ── IPC Handlers ──

export function registerFleetHandlers(
  lifecycle?: LifecycleManager,
  getMainWindow?: () => BrowserWindow | null,
): void {
  ipcMain.handle('fleet:list', async (): Promise<AgentInfo[]> => {
    const registry = readRegistry();
    const results: AgentInfo[] = [];

    // Get current lifecycle state to determine what's actually running
    const isFleetMode = lifecycle?.fleetMode ?? false;
    const lifecycleRunning = lifecycle?.isRunning() ?? false;
    const currentAgentRoot = lifecycle?.getAgentRoot?.() ?? null;

    const entries = Object.entries(registry.agents);
    for (const [name, entry] of entries) {
      const isRemote = entry.type === 'remote';

      if (isRemote) {
        // Remote agent — probe its remote URL for health
        let running = false;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };
          if (entry.remoteToken) headers['Authorization'] = `Bearer ${entry.remoteToken}`;
          const res = await fetch(`${entry.remoteUrl}/health`, { signal: controller.signal, headers });
          clearTimeout(timeout);
          running = res.ok;
        } catch {
          running = false;
        }

        results.push({
          name: name,
          root: '',
          port: 0,
          description: `Remote agent at ${entry.remoteUrl}`,
          registered: entry.registered,
          running,
          type: 'remote',
          remoteUrl: entry.remoteUrl,
          remoteToken: entry.remoteToken,
        });
        continue;
      }

      // Local agent — check if the directory still exists
      const rootExists = existsSync(entry.root) && existsSync(join(entry.root, 'identity.yaml'));
      const identity = rootExists ? readIdentityFromRoot(entry.root) : { agent_name: name, port: 3456, agent_description: '' };

      let running = false;
      if (rootExists) {
        if (isFleetMode && lifecycleRunning) {
          // Fleet mode: all agents managed by fleet are running — probe to confirm
          running = await probeHealth(identity.port);
        } else if (lifecycleRunning && currentAgentRoot === entry.root) {
          // Single-agent mode: only the current agent root is running
          running = true;
        }
      }

      results.push({
        name,  // Always use registry key — not identity.agent_name which becomes "unknown" for missing dirs
        root: entry.root,
        port: identity.port,
        description: rootExists ? identity.agent_description : '',
        registered: entry.registered,
        running,
        type: 'local',
        missing: !rootExists,
      } as AgentInfo);
    }

    return results;
  });

  ipcMain.handle('fleet:register', async (_event, rootPath: string): Promise<{ ok: boolean; name: string }> => {
    const identity = readIdentityFromRoot(rootPath);
    const registry = readRegistry();

    registry.agents[identity.agent_name.toLowerCase()] = {
      root: rootPath,
      registered: new Date().toISOString(),
    };

    writeRegistry(registry);
    return { ok: true, name: identity.agent_name };
  });

  ipcMain.handle('fleet:unregister', async (_event, name: string): Promise<{ ok: boolean }> => {
    const registry = readRegistry();
    const key = name.toLowerCase();

    if (registry.agents[key]) {
      delete registry.agents[key];
      if (registry.defaults?.auto_start) {
        registry.defaults.auto_start = registry.defaults.auto_start.filter((n) => n !== key);
      }
      writeRegistry(registry);
    }

    return { ok: true };
  });

  // ── Remote agent handlers ──

  ipcMain.handle('fleet:register-remote', async (_event, name: string, url: string, token: string): Promise<{ ok: boolean; error?: string }> => {
    // Validate by pinging the remote health endpoint
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${url}/health`, { signal: controller.signal, headers });
      clearTimeout(timeout);
      if (!res.ok) {
        return { ok: false, error: `Health check failed: HTTP ${res.status}` };
      }
    } catch (err: any) {
      return { ok: false, error: `Cannot reach ${url}/health: ${err.message}` };
    }

    const registry = readRegistry();
    const key = name.toLowerCase();

    registry.agents[key] = {
      root: '',
      registered: new Date().toISOString(),
      type: 'remote',
      remoteUrl: url,
      remoteToken: token,
    };

    writeRegistry(registry);
    return { ok: true };
  });

  ipcMain.handle('fleet:unregister-remote', async (_event, name: string): Promise<{ ok: boolean }> => {
    const registry = readRegistry();
    const key = name.toLowerCase();

    if (registry.agents[key]) {
      delete registry.agents[key];
      if (registry.defaults?.auto_start) {
        registry.defaults.auto_start = registry.defaults.auto_start.filter((n) => n !== key);
      }
      writeRegistry(registry);
    }

    return { ok: true };
  });

  // ── Fleet lifecycle handlers (Phase 4B) ──

  if (lifecycle) {
    ipcMain.handle('fleet:start', async (_event, agents: string[]) => {
      await lifecycle.startFleet(agents);
      return { ok: true, status: lifecycle.status };
    });

    ipcMain.handle('fleet:stop', async () => {
      await lifecycle.stopFleet();
      return { ok: true, status: lifecycle.status };
    });

    ipcMain.handle('fleet:get-status', async () => {
      return {
        status: lifecycle.status,
        fleetMode: lifecycle.fleetMode,
        fleet: lifecycle.getFleetStatus(),
        health: lifecycle.getHealth(),
      };
    });

    ipcMain.handle('fleet:add-agent', async (_event, name: string) => {
      try {
        const port = getFleetServerPort();
        const res = await fetch(`http://localhost:${port}/fleet/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        return { ok: res.ok, ...data };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    });

    ipcMain.handle('fleet:remove-agent', async (_event, name: string) => {
      try {
        const port = getFleetServerPort();
        const res = await fetch(`http://localhost:${port}/fleet/agents/${encodeURIComponent(name)}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        return { ok: res.ok, ...data };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    });

    // Push fleet status changes to the renderer
    lifecycle.on('fleet-status-update', (fleetStatus: FleetStatus) => {
      const win = getMainWindow?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send('fleet:status-update', fleetStatus);
      }
    });
  }
}
