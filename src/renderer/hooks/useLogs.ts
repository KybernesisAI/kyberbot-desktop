/**
 * Log accumulator — per-agent log buffers that persist across tab/agent switches.
 * Each agent root gets its own buffer. Incoming logs are routed by root.
 */

const logBuffers = new Map<string, string[]>();
let subscriber: ((root: string, lines: string[]) => void) | null = null;
let ipcUnsubscribe: (() => void) | null = null;

function getBuffer(root: string): string[] {
  if (!logBuffers.has(root)) logBuffers.set(root, []);
  return logBuffers.get(root)!;
}

export function initLogSubscription(): void {
  if (ipcUnsubscribe) return;
  const kb = (window as any).kyberbot;
  if (!kb) return;

  ipcUnsubscribe = kb.logs.onLine((line: string, root?: string) => {
    const key = root || '__unknown__';
    const buffer = getBuffer(key);
    buffer.push(line);
    if (buffer.length > 2000) {
      const trimmed = buffer.slice(-2000);
      buffer.length = 0;
      buffer.push(...trimmed);
    }
    subscriber?.(key, buffer);
  });
}

/**
 * Get the log buffer for a specific agent root.
 */
export function getLogBuffer(root?: string | null): string[] {
  if (!root) return [];
  return getBuffer(root);
}

/**
 * Subscribe to log updates for any agent. Callback receives (root, lines).
 */
export function subscribeToLogs(cb: (root: string, lines: string[]) => void): () => void {
  subscriber = cb;
  return () => { subscriber = null; };
}
