/**
 * CLI child process lifecycle manager.
 *
 * Manages multiple agent processes independently. Each agent gets its own
 * child process, health polling, log stream, and status tracking.
 * The desktop app can start/stop any combination of agents.
 */

import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync, createWriteStream, mkdirSync, readFileSync, WriteStream } from 'fs';
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

// Per-agent process state
interface AgentProcess {
  root: string;
  process: ChildProcess | null;
  status: CliStatus;
  health: HealthData | null;
  healthTimer: ReturnType<typeof setInterval> | null;
  logStream: WriteStream | null;
  attached: boolean;
  restartCount: number;
  port: number;
}

export class LifecycleManager extends EventEmitter {
  private store: AppStore;
  private agents = new Map<string, AgentProcess>();
  private readonly MAX_RESTARTS = 10;

  // Fleet mode (shared process)
  private fleetProcess: ChildProcess | null = null;
  private _fleetMode = false;
  private _fleetAgents: string[] = [];
  private lastFleetStatus: FleetStatus | null = null;
  private fleetHealthTimer: ReturnType<typeof setInterval> | null = null;
  private fleetLogStream: WriteStream | null = null;

  constructor(store: AppStore) {
    super();
    this.store = store;
  }

  // ── Public API ──

  /** Get the process state for the currently viewed agent */
  private getAgentState(): AgentProcess | undefined {
    const root = this.store.getAgentRoot();
    return root ? this.agents.get(root) : undefined;
  }

  /** Status of the currently viewed agent (from store.agentRoot) */
  get status(): CliStatus {
    if (this._fleetMode) {
      return this.fleetProcess ? 'running' : 'stopped';
    }
    const agent = this.getAgentState();
    return agent?.status || 'stopped';
  }

  get fleetMode(): boolean { return this._fleetMode; }
  set fleetMode(v: boolean) { this._fleetMode = v; }

  getHealth(): HealthData | null {
    const agent = this.getAgentState();
    return agent?.health || null;
  }

  /** Get health for a specific agent root */
  getAgentHealth(root: string): HealthData | null {
    return this.agents.get(root)?.health || null;
  }

  getFleetStatus(): FleetStatus | null { return this.lastFleetStatus; }

  isRunning(): boolean {
    const s = this.status;
    return s === 'running' || s === 'starting';
  }

  /** Which agent roots have running processes? */
  getRunningAgentRoot(): string | null {
    if (this._fleetMode && this.fleetProcess) return '__fleet__';
    // Return the first running agent root, or the viewed one if running
    const viewedRoot = this.store.getAgentRoot();
    if (viewedRoot && this.agents.has(viewedRoot)) {
      const a = this.agents.get(viewedRoot)!;
      if (a.status === 'running' || a.status === 'starting') return viewedRoot;
    }
    return null;
  }

  /** Get all running agent roots */
  getRunningAgentRoots(): string[] {
    const roots: string[] = [];
    for (const [root, agent] of this.agents) {
      if (agent.status === 'running' || agent.status === 'starting') {
        roots.push(root);
      }
    }
    return roots;
  }

  getAgentRoot(): string | null {
    return this.store.getAgentRoot();
  }

  /** Check if a specific agent root is running */
  isAgentRunning(root: string): boolean {
    if (this._fleetMode && this.fleetProcess) return true;
    const agent = this.agents.get(root);
    return agent?.status === 'running' || agent?.status === 'starting' || false;
  }

  /** Get status for a specific agent root */
  getAgentStatus(root: string): CliStatus {
    if (this._fleetMode && this.fleetProcess) return 'running';
    return this.agents.get(root)?.status || 'stopped';
  }

  getRecentLogs(): string[] { return []; } // Logs are per-agent via IPC events now

  // ── Single-agent start/stop ──

  async startCli(): Promise<void> {
    if (this._fleetMode && this._fleetAgents.length > 0) {
      return this.startFleet(this._fleetAgents);
    }

    const agentRoot = this.store.getAgentRoot();
    if (!agentRoot) throw new Error('Agent root not configured');

    // Already running?
    const existing = this.agents.get(agentRoot);
    if (existing && (existing.status === 'running' || existing.status === 'starting')) {
      return;
    }

    const port = this.getPortForRoot(agentRoot);

    // Check if server already running on this port
    try {
      const res = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        console.log(`[lifecycle] Server already running on port ${port} — attaching`);
        const agent = this.ensureAgent(agentRoot, port);
        agent.status = 'running';
        agent.attached = true;
        this.emitAgentStatus(agentRoot);
        this.startAgentHealthPolling(agentRoot);
        return;
      }
    } catch { /* not running */ }

    this.spawnAgentProcess(agentRoot, port);
  }

  async stopCli(): Promise<void> {
    if (this._fleetMode) return this.stopFleet();

    const agentRoot = this.store.getAgentRoot();
    if (!agentRoot) return;

    await this.stopAgent(agentRoot);
  }

  /** Stop a specific agent by root */
  async stopAgent(root: string): Promise<void> {
    const agent = this.agents.get(root);
    if (!agent) return;

    this.stopAgentHealthPolling(root);

    if (!agent.process) {
      if (agent.attached) {
        agent.status = 'stopped';
        agent.attached = false;
        this.emitAgentStatus(root);
      }
      return;
    }

    agent.status = 'stopping';
    this.emitAgentStatus(root);

    agent.process.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        agent.process?.kill('SIGKILL');
        resolve();
      }, 10_000);
      agent.process?.on('exit', () => { clearTimeout(timeout); resolve(); });
    });

    agent.process = null;
    agent.logStream?.end();
    agent.logStream = null;
    agent.status = 'stopped';
    agent.health = null;
    this.emitAgentStatus(root);
  }

  // ── Fleet mode ──

  async startFleet(agents: string[]): Promise<void> {
    if (this.fleetProcess) return;

    this._fleetMode = true;
    this._fleetAgents = agents;

    const port = 3456;
    try {
      const res = await fetch(`http://localhost:${port}/fleet`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        this.lastFleetStatus = await res.json() as FleetStatus;
        this.emit('status-change', 'running', '__fleet__');
        this.startFleetHealthPolling();
        return;
      }
    } catch { /* not running */ }

    this.spawnFleetProcess(agents);
  }

  async stopFleet(): Promise<void> {
    if (this.fleetHealthTimer) { clearInterval(this.fleetHealthTimer); this.fleetHealthTimer = null; }

    if (!this.fleetProcess) {
      this._fleetMode = false;
      this.lastFleetStatus = null;
      this.emit('status-change', 'stopped', null);
      return;
    }

    this.emit('status-change', 'stopping', '__fleet__');
    this.fleetProcess.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => { this.fleetProcess?.kill('SIGKILL'); resolve(); }, 10_000);
      this.fleetProcess?.on('exit', () => { clearTimeout(timeout); resolve(); });
    });

    this.fleetProcess = null;
    this.fleetLogStream?.end();
    this.fleetLogStream = null;
    this._fleetMode = false;
    this.lastFleetStatus = null;
    this.emit('status-change', 'stopped', null);
  }

  /** Graceful shutdown of everything */
  async shutdown(): Promise<void> {
    if (this._fleetMode) {
      await this.stopFleet();
    }
    for (const root of this.agents.keys()) {
      await this.stopAgent(root);
    }
  }

  // ── Private: per-agent process management ──

  private ensureAgent(root: string, port: number): AgentProcess {
    if (!this.agents.has(root)) {
      this.agents.set(root, {
        root,
        process: null,
        status: 'stopped',
        health: null,
        healthTimer: null,
        logStream: null,
        attached: false,
        restartCount: 0,
        port,
      });
    }
    return this.agents.get(root)!;
  }

  private spawnAgentProcess(root: string, port: number): void {
    const agent = this.ensureAgent(root, port);
    agent.status = 'starting';
    agent.restartCount = 0;
    this.emitAgentStatus(root);

    const cliPath = this.resolveCliPath();
    const fullPath = this.getFullPath();

    // Logs
    const logDir = join(root, 'logs');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    agent.logStream = createWriteStream(join(logDir, 'desktop-cli.log'), { flags: 'a' });

    // Load .env
    const agentEnv: Record<string, string> = {};
    try {
      const envContent = readFileSync(join(root, '.env'), 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) agentEnv[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
      }
    } catch {}

    agent.process = spawn(cliPath, ['run'], {
      cwd: root,
      env: {
        ...process.env,
        ...agentEnv,
        KYBERBOT_ROOT: root,
        KYBERBOT_CHILD: '1',
        NODE_ENV: 'production',
        PATH: fullPath,
        FORCE_COLOR: '3',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    agent.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.emit('log-line', root, line);
        agent.logStream?.write(line + '\n');
      }
    });

    agent.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.emit('log-line', root, `[stderr] ${line}`);
        agent.logStream?.write(`[stderr] ${line}\n`);
      }
    });

    agent.process.on('error', (error: Error) => {
      agent.status = 'crashed';
      this.emitAgentStatus(root);
    });

    agent.process.on('exit', (code) => {
      agent.process = null;
      agent.logStream?.end();
      agent.logStream = null;

      if (agent.status === 'stopping') {
        agent.status = 'stopped';
        this.emitAgentStatus(root);
        return;
      }

      agent.status = 'crashed';
      this.emitAgentStatus(root);

      if (code !== 0 && agent.restartCount < this.MAX_RESTARTS) {
        agent.restartCount++;
        const delay = agent.restartCount > 3 ? 10_000 : 2_000;
        setTimeout(() => this.spawnAgentProcess(root, port), delay);
      }
    });

    setTimeout(() => this.startAgentHealthPolling(root), 3000);
  }

  private startAgentHealthPolling(root: string): void {
    const agent = this.agents.get(root);
    if (!agent) return;
    this.stopAgentHealthPolling(root);

    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:${agent.port}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json() as HealthData;
        agent.health = data;

        if (agent.status === 'starting') {
          agent.status = 'running';
          this.emitAgentStatus(root);
        }

        this.emit('health-update', root, data);
      } catch {
        if (agent.status === 'running') {
          agent.health = { status: 'offline', timestamp: new Date().toISOString(), uptime: '0s', channels: [], services: [], errors: 0, memory: {}, pid: 0, node_version: '' } as HealthData;
          this.emit('health-update', root, agent.health);
        }
      }
    };

    poll();
    agent.healthTimer = setInterval(poll, 5000);
  }

  private stopAgentHealthPolling(root: string): void {
    const agent = this.agents.get(root);
    if (agent?.healthTimer) {
      clearInterval(agent.healthTimer);
      agent.healthTimer = null;
    }
  }

  private emitAgentStatus(root: string): void {
    const agent = this.agents.get(root);
    if (!agent) return;
    this.emit('agent-status-change', root, agent.status);
    // Also emit generic status-change for the currently viewed agent
    if (root === this.store.getAgentRoot()) {
      this.emit('status-change', agent.status, root);
    }
  }

  // ── Private: fleet process management ──

  private spawnFleetProcess(agents: string[]): void {
    this.emit('status-change', 'starting', '__fleet__');

    const cliPath = this.resolveCliPath();
    const fullPath = this.getFullPath();
    const agentRoot = this.store.getAgentRoot();

    if (agentRoot) {
      const logDir = join(agentRoot, 'logs');
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
      this.fleetLogStream = createWriteStream(join(logDir, 'desktop-fleet.log'), { flags: 'a' });
    }

    this.fleetProcess = spawn(cliPath, ['fleet', 'start', '--only', agents.join(',')], {
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

    this.fleetProcess.stdout?.on('data', (data: Buffer) => {
      for (const line of data.toString().split('\n').filter(Boolean)) {
        this.emit('log-line', '__fleet__', line);
        this.fleetLogStream?.write(line + '\n');
      }
    });

    this.fleetProcess.stderr?.on('data', (data: Buffer) => {
      for (const line of data.toString().split('\n').filter(Boolean)) {
        this.emit('log-line', '__fleet__', `[stderr] ${line}`);
        this.fleetLogStream?.write(`[stderr] ${line}\n`);
      }
    });

    this.fleetProcess.on('exit', (code) => {
      this.fleetProcess = null;
      this.fleetLogStream?.end();
      this.fleetLogStream = null;
      this._fleetMode = false;
      this.lastFleetStatus = null;
      this.emit('status-change', 'stopped', null);
    });

    setTimeout(() => this.startFleetHealthPolling(), 3000);
  }

  private startFleetHealthPolling(): void {
    if (this.fleetHealthTimer) clearInterval(this.fleetHealthTimer);

    const poll = async () => {
      try {
        const res = await fetch('http://localhost:3456/fleet', { signal: AbortSignal.timeout(5000) });
        const data = await res.json() as FleetStatus;
        this.lastFleetStatus = data;

        const healthData: HealthData = {
          status: data.agents.every(a => a.status === 'running') ? 'ok' : 'degraded',
          timestamp: new Date().toISOString(),
          uptime: data.uptime,
          channels: data.agents.flatMap(a => a.channels ?? []),
          services: data.agents.flatMap(a => (a.services ?? []).map(s => ({ name: `${a.name}/${s.name}`, status: s.status }))),
          errors: 0, memory: {}, pid: data.pid, node_version: '',
        };

        if (!this._fleetMode) { this._fleetMode = true; }
        this.emit('status-change', 'running', '__fleet__');
        this.emit('health-update', '__fleet__', healthData);
        this.emit('fleet-status-update', data);
      } catch {
        // Fleet not responding
      }
    };

    poll();
    this.fleetHealthTimer = setInterval(poll, 5000);
  }

  // ── Private: utilities ──

  private getPortForRoot(root: string): number {
    try {
      const yaml = require('js-yaml');
      const identity = yaml.load(readFileSync(join(root, 'identity.yaml'), 'utf-8'));
      return identity?.server?.port ?? 3456;
    } catch { return 3456; }
  }

  private getServerPort(): number {
    const root = this.store.getAgentRoot();
    if (!root) return 3456;
    return this.getPortForRoot(root);
  }

  private resolveCliPath(): string {
    const which = (cmd: string): string | null => {
      try {
        const { execSync } = require('child_process');
        return execSync(`which ${cmd}`, { encoding: 'utf-8', env: { ...process.env, PATH: this.getFullPath() } }).trim();
      } catch { return null; }
    };
    return which('kyberbot') || 'kyberbot';
  }

  private getFullPath(): string {
    const { homedir } = require('os');
    const home = homedir();
    const paths: string[] = [];

    // nvm versions (newest first)
    try {
      const nvmDir = join(home, '.nvm', 'versions', 'node');
      if (existsSync(nvmDir)) {
        const { readdirSync } = require('fs');
        const versions = readdirSync(nvmDir).filter((v: string) => v.startsWith('v')).sort().reverse();
        for (const v of versions) paths.push(join(nvmDir, v, 'bin'));
      }
    } catch {}

    paths.push(
      join(home, '.local', 'bin'),
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
    );

    return paths.join(':') + ':' + (process.env.PATH || '');
  }
}
