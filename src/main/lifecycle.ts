/**
 * CLI child process lifecycle manager.
 *
 * Spawns `kyberbot run` as a child process, monitors health via HTTP,
 * and manages graceful shutdown. The desktop never imports CLI internals —
 * this is the boundary.
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { join } from 'path';
import { existsSync, createWriteStream, mkdirSync, WriteStream } from 'fs';
import { EventEmitter } from 'events';
import { AppStore } from './store.js';
import type { HealthData } from '../types/ipc.js';

type CliStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

export interface FleetAgentStatus {
  name: string;
  status: string;
  uptime?: string;
  services?: Array<{ name: string; status: string }>;
  channels?: Array<{ name: string; connected: boolean }>;
  pid?: number;
}

export interface FleetStatus {
  mode: 'fleet';
  agents: FleetAgentStatus[];
  sleep?: { current_agent: string | null; last_run: string | null };
  uptime: string;
  pid: number;
}

export class LifecycleManager extends EventEmitter {
  private store: AppStore;
  private process: ChildProcess | null = null;
  private _status: CliStatus = 'stopped';
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private lastHealth: HealthData | null = null;
  private lastFleetStatus: FleetStatus | null = null;
  private logStream: WriteStream | null = null;
  private stdoutBuffer: string[] = [];
  private readonly MAX_BUFFER_LINES = 1000;
  private restartCount = 0;
  private readonly MAX_RESTARTS = 10;
  private attached = false; // true if we attached to an external server (don't kill on quit)
  private _fleetMode = false;
  private _fleetAgents: string[] = [];

  constructor(store: AppStore) {
    super();
    this.store = store;
  }

  get status(): CliStatus {
    return this._status;
  }

  get fleetMode(): boolean {
    return this._fleetMode;
  }

  set fleetMode(value: boolean) {
    this._fleetMode = value;
  }

  getHealth(): HealthData | null {
    return this.lastHealth;
  }

  getFleetStatus(): FleetStatus | null {
    return this.lastFleetStatus;
  }

  isRunning(): boolean {
    return this._status === 'running' || this._status === 'starting';
  }

  getAgentRoot(): string | null {
    return this.store.getAgentRoot();
  }

  getRecentLogs(): string[] {
    return [...this.stdoutBuffer];
  }

  // ── Fleet mode methods ──

  async startFleet(agents: string[]): Promise<void> {
    if (this.process) return;

    this._fleetMode = true;
    this._fleetAgents = agents;

    // Check if a fleet server is already running on the expected port
    try {
      const port = this.getServerPort();
      const res = await fetch(`http://localhost:${port}/fleet`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        console.log('[lifecycle] Fleet server already running on port', port, '— attaching');
        this._status = 'running';
        this.attached = true;
        this.lastFleetStatus = await res.json() as FleetStatus;
        this.emit('status-change', this._status);
        this.startHealthPolling();
        return;
      }
    } catch {
      // No fleet server running, proceed to spawn
    }

    this.restartCount = 0;
    this.spawnFleetProcess(agents);
  }

  async stopFleet(): Promise<void> {
    this.stopHealthPolling();

    if (!this.process) {
      if (this.attached) {
        console.log('[lifecycle] Detaching from external fleet server (not killing)');
        this._status = 'stopped';
        this.attached = false;
        this._fleetMode = false;
        this.lastFleetStatus = null;
        this.emit('status-change', this._status);
      }
      return;
    }

    this._status = 'stopping';
    this.emit('status-change', this._status);
    console.log('[lifecycle] Sending SIGTERM to fleet process...');

    this.process.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) this.process.kill('SIGKILL');
        resolve();
      }, 10_000);

      this.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.process = null;
    this.logStream?.end();
    this.logStream = null;
    this._status = 'stopped';
    this._fleetMode = false;
    this.lastFleetStatus = null;
    this.emit('status-change', this._status);
  }

  private spawnFleetProcess(agents: string[]): void {
    this._status = 'starting';
    this.emit('status-change', this._status);

    const cliPath = this.resolveCliPath();
    const fullPath = this.getFullPath();

    // Use the first agent's root for log directory
    const agentRoot = this.store.getAgentRoot();
    if (agentRoot) {
      const logDir = join(agentRoot, 'logs');
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
      const logPath = join(logDir, 'desktop-fleet.log');
      this.logStream = createWriteStream(logPath, { flags: 'a' });
    }

    // Spawn: kyberbot fleet start --only name1,name2
    const args = ['fleet', 'start', '--only', agents.join(',')];

    this.process = spawn(cliPath, args, {
      cwd: agentRoot || undefined,
      env: {
        ...process.env,
        KYBERBOT_CHILD: '1',
        NODE_ENV: 'production',
        PATH: fullPath,
        FORCE_COLOR: '3',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.pushLogLine(line);
        this.logStream?.write(line + '\n');
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.pushLogLine(`[stderr] ${line}`);
        this.logStream?.write(`[stderr] ${line}\n`);
      }
    });

    this.process.on('error', (error: Error) => {
      this._status = 'crashed';
      this.emit('status-change', this._status);
      this.emit('error', error.message);
    });

    this.process.on('exit', (code) => {
      this.process = null;
      this.logStream?.end();
      this.logStream = null;

      if (this._status === 'stopping') {
        this._status = 'stopped';
        this.emit('status-change', this._status);
        return;
      }

      this._status = 'crashed';
      this.emit('status-change', this._status);
      this.emit('error', `Fleet process exited with code ${code}`);

      if (code !== 0 && this.restartCount < this.MAX_RESTARTS) {
        this.restartCount++;
        const delay = this.restartCount > 3 ? 10_000 : 2_000;
        setTimeout(() => this.spawnFleetProcess(agents), delay);
      }
    });

    // Start health polling after startup delay
    setTimeout(() => this.startHealthPolling(), 3000);
  }

  async startCli(): Promise<void> {
    // In fleet mode, delegate to startFleet
    if (this._fleetMode && this._fleetAgents.length > 0) {
      return this.startFleet(this._fleetAgents);
    }

    if (this.process) return;

    // Check if a server is already running on the expected port
    try {
      const port = this.getServerPort();
      const res = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        // Server already running (started externally or from a previous session)
        console.log('[lifecycle] Server already running on port', port, '— attaching');
        this._status = 'running';
        this.attached = true;
        this.emit('status-change', this._status);
        this.startHealthPolling();
        return;
      }
    } catch {
      // No server running, proceed to spawn
    }

    this.restartCount = 0;
    this.spawnProcess();
  }

  async stopCli(): Promise<void> {
    // In fleet mode, delegate to stopFleet
    if (this._fleetMode) {
      return this.stopFleet();
    }

    this.stopHealthPolling();

    if (!this.process) {
      // We were attached to an external server — don't kill it
      if (this.attached) {
        console.log('[lifecycle] Detaching from external server (not killing)');
        this._status = 'stopped';
        this.attached = false;
        this.emit('status-change', this._status);
      }
      return;
    }
    this._status = 'stopping';
    this.emit('status-change', this._status);
    console.log('[lifecycle] Sending SIGTERM to CLI process...');

    this.process.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) this.process.kill('SIGKILL');
        resolve();
      }, 10_000);

      this.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.process = null;
    this.logStream?.end();
    this.logStream = null;
    this._status = 'stopped';
    this.emit('status-change', this._status);
  }

  private spawnProcess(): void {
    const agentRoot = this.store.getAgentRoot();
    if (!agentRoot) throw new Error('Agent root not configured');

    this._status = 'starting';
    this.emit('status-change', this._status);

    const cliPath = this.resolveCliPath();

    // Ensure logs directory
    const logDir = join(agentRoot, 'logs');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

    const logPath = join(logDir, 'desktop-cli.log');
    this.logStream = createWriteStream(logPath, { flags: 'a' });

    // Load the agent's .env so both the spawn and IPC handlers use the same token
    const agentEnv: Record<string, string> = {};
    try {
      const envContent = require('fs').readFileSync(join(agentRoot, '.env'), 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) agentEnv[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
      }
    } catch {}

    // Spawn kyberbot directly (it has its own shebang with node + max-old-space-size)
    const fullPath = this.getFullPath();
    this.process = spawn(cliPath, ['run'], {
      cwd: agentRoot,
      env: {
        ...process.env,
        ...agentEnv, // Agent's .env vars (including KYBERBOT_API_TOKEN)
        KYBERBOT_ROOT: agentRoot,
        KYBERBOT_CHILD: '1', // Disables CLI's built-in watchdog (run.ts:64)
        NODE_ENV: 'production',
        PATH: fullPath, // Full PATH including nvm/homebrew for packaged app
        FORCE_COLOR: '3', // Force chalk to output full 24-bit ANSI color codes even when piped
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.pushLogLine(line);
        this.logStream?.write(line + '\n');
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.pushLogLine(`[stderr] ${line}`);
        this.logStream?.write(`[stderr] ${line}\n`);
      }
    });

    this.process.on('error', (error: Error) => {
      this._status = 'crashed';
      this.emit('status-change', this._status);
      this.emit('error', error.message);
    });

    this.process.on('exit', (code) => {
      this.process = null;
      this.logStream?.end();
      this.logStream = null;

      if (this._status === 'stopping') {
        this._status = 'stopped';
        this.emit('status-change', this._status);
        return;
      }

      this._status = 'crashed';
      this.emit('status-change', this._status);
      this.emit('error', `CLI exited with code ${code}`);

      if (code !== 0 && this.restartCount < this.MAX_RESTARTS) {
        this.restartCount++;
        const delay = this.restartCount > 3 ? 10_000 : 2_000;
        setTimeout(() => this.spawnProcess(), delay);
      }
    });

    // Start health polling after startup delay
    setTimeout(() => this.startHealthPolling(), 3000);
  }

  private startHealthPolling(): void {
    this.stopHealthPolling();

    const poll = async () => {
      try {
        const port = this.getServerPort();

        if (this._fleetMode) {
          // Fleet mode: poll /fleet endpoint
          const response = await fetch(`http://localhost:${port}/fleet`, {
            signal: AbortSignal.timeout(5000),
          });
          const fleetData = await response.json() as FleetStatus;
          this.lastFleetStatus = fleetData;

          // Synthesize a HealthData from fleet status for backward compat
          const healthData: HealthData = {
            status: fleetData.agents.every(a => a.status === 'running') ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: fleetData.uptime,
            channels: fleetData.agents.flatMap(a => a.channels ?? []),
            services: fleetData.agents.flatMap(a =>
              (a.services ?? []).map(s => ({ name: `${a.name}/${s.name}`, status: s.status }))
            ),
            errors: 0,
            memory: {},
            pid: fleetData.pid,
            node_version: '',
          };
          this.lastHealth = healthData;

          if (this._status === 'starting') {
            this._status = 'running';
            this.emit('status-change', this._status);
          }

          this.emit('health-update', healthData);
          this.emit('fleet-status-update', fleetData);
        } else {
          // Single-agent mode: poll /health endpoint
          const response = await fetch(`http://localhost:${port}/health`, {
            signal: AbortSignal.timeout(5000),
          });
          const data = await response.json() as HealthData;
          this.lastHealth = data;

          if (this._status === 'starting') {
            this._status = 'running';
            this.emit('status-change', this._status);
          }

          this.emit('health-update', data);
        }
      } catch {
        if (this._status === 'running') {
          const offlineHealth: HealthData = {
            status: 'offline',
            timestamp: new Date().toISOString(),
            uptime: '0s',
            channels: [],
            services: [],
            errors: 0,
            memory: {},
            pid: 0,
            node_version: '',
          };
          this.lastHealth = offlineHealth;
          this.lastFleetStatus = null;
          this.emit('health-update', offlineHealth);
        }
      }
    };

    poll();
    this.healthTimer = setInterval(poll, 5000);
  }

  private stopHealthPolling(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private getServerPort(): number {
    const agentRoot = this.store.getAgentRoot();
    if (!agentRoot) return 3456;
    try {
      const yaml = require('js-yaml');
      const fs = require('fs');
      const identity = yaml.load(fs.readFileSync(join(agentRoot, 'identity.yaml'), 'utf-8'));
      return identity?.server?.port ?? 3456;
    } catch {
      return 3456;
    }
  }

  /**
   * Build a full PATH that includes common Node/nvm/homebrew locations.
   * Electron's packaged app doesn't inherit the user's shell PATH.
   */
  private getFullPath(): string {
    const home = process.env.HOME || '';
    const existing = process.env.PATH || '';
    const extras = [
      join(home, '.local/bin'),          // claude CLI installs here
      '/usr/local/bin',
      '/opt/homebrew/bin',
      join(home, '.npm-global/bin'),
      join(home, '.yarn/bin'),
      '/usr/bin',
      '/bin',
    ];

    // Find nvm node versions — put the HIGHEST version first
    // (kyberbot is compiled against the latest node, better-sqlite3
    // native module must match the node version that runs it)
    const nvmDir = join(home, '.nvm/versions/node');
    const nvmPaths: string[] = [];
    try {
      const versions = require('fs').readdirSync(nvmDir) as string[];
      // Sort descending so newest node is first on PATH
      versions.sort((a: string, b: string) => {
        const va = a.replace('v', '').split('.').map(Number);
        const vb = b.replace('v', '').split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if ((vb[i] || 0) !== (va[i] || 0)) return (vb[i] || 0) - (va[i] || 0);
        }
        return 0;
      });
      for (const v of versions) {
        nvmPaths.push(join(nvmDir, v, 'bin'));
      }
    } catch { /* nvm not installed */ }

    const allPaths = [...nvmPaths, ...extras, ...existing.split(':')];
    return [...new Set(allPaths)].join(':');
  }

  private resolveCliPath(): string {
    const fullPath = this.getFullPath();

    // Try `which kyberbot` with full PATH
    try {
      const globalPath = execSync('which kyberbot', {
        encoding: 'utf-8',
        env: { ...process.env, PATH: fullPath },
      }).trim();
      if (globalPath) return globalPath;
    } catch { /* not found */ }

    // Check common global install locations directly
    const home = process.env.HOME || '';
    const candidates = [
      // nvm installs
      ...(() => {
        try {
          const nvmDir = join(home, '.nvm/versions/node');
          return require('fs').readdirSync(nvmDir).map((v: string) => join(nvmDir, v, 'bin', 'kyberbot'));
        } catch { return []; }
      })(),
      '/usr/local/bin/kyberbot',
      '/opt/homebrew/bin/kyberbot',
      join(home, '.npm-global/bin/kyberbot'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }

    // Check agent root node_modules
    const agentRoot = this.store.getAgentRoot();
    if (agentRoot) {
      const localCli = join(agentRoot, 'node_modules', '@kyberbot', 'cli', 'dist', 'index.js');
      if (existsSync(localCli)) return localCli;
    }

    throw new Error('kyberbot CLI not found. Install with: npm install -g @kyberbot/cli');
  }

  private pushLogLine(line: string): void {
    this.stdoutBuffer.push(line);
    if (this.stdoutBuffer.length > this.MAX_BUFFER_LINES) {
      this.stdoutBuffer.shift();
    }
    this.emit('log-line', line);
  }
}
