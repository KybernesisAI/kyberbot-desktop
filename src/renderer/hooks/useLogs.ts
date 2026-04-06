/**
 * Log accumulator — per-agent log buffers that persist across tab switches.
 * Each agent root gets its own buffer. Switching agents shows only that agent's logs.
 */

const logBuffers = new Map<string, string[]>();
let currentAgentRoot: string | null = null;
let subscriber: ((lines: string[]) => void) | null = null;
let ipcUnsubscribe: (() => void) | null = null;

function getBuffer(root: string | null): string[] {
  const key = root || '__default__';
  if (!logBuffers.has(key)) logBuffers.set(key, []);
  return logBuffers.get(key)!;
}

export function initLogSubscription(): void {
  if (ipcUnsubscribe) return;
  const kb = (window as any).kyberbot;
  if (!kb) return;

  ipcUnsubscribe = kb.logs.onLine((line: string) => {
    // Append to the current agent's buffer
    const buffer = getBuffer(currentAgentRoot);
    buffer.push(line);
    if (buffer.length > 2000) {
      const trimmed = buffer.slice(-2000);
      buffer.length = 0;
      buffer.push(...trimmed);
    }
    subscriber?.(buffer);
  });
}

/**
 * Set which agent root logs should be routed to.
 * Called when the running agent changes.
 */
export function setLogAgentRoot(root: string | null): void {
  currentAgentRoot = root;
}

/**
 * Get the log buffer for a specific agent root.
 */
export function getLogBuffer(root?: string | null): string[] {
  return getBuffer(root ?? currentAgentRoot);
}

/**
 * Subscribe to log updates. Returns unsubscribe function.
 */
export function subscribeToLogs(cb: (lines: string[]) => void): () => void {
  subscriber = cb;
  return () => { subscriber = null; };
}
