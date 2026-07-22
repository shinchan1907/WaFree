import type { WaManager } from '../wa/manager.js';

let managerRef: WaManager | null = null;

export function initAutomation(manager: WaManager): void {
  managerRef = manager;
}

export function getManager(): WaManager {
  if (!managerRef) throw new Error('Automation not initialised');
  return managerRef;
}

/** System user id used for automated sends (no real user). */
export const AUTOMATION_USER_ID = 0;
