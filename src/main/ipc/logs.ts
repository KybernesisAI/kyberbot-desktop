/**
 * Log streaming IPC handlers.
 * Log forwarding is now handled by services.ts (root, line) signature.
 * This file is kept as a no-op for backwards compatibility with registerLogHandlers() calls.
 */

import { BrowserWindow } from 'electron';
import { LifecycleManager } from '../lifecycle.js';

export function registerLogHandlers(
  _lifecycle: LifecycleManager,
  _getMainWindow: () => BrowserWindow | null,
): void {
  // No-op: log forwarding is handled in services.ts with the correct (root, line) signature
}
