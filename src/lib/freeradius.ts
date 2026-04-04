import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Track last restart time to prevent concurrent restarts
let lastRestartTime = 0;
const RESTART_COOLDOWN = 3000; // 3 seconds cooldown

/**
 * Restart FreeRADIUS service
 * Not needed in Docker with SQL read_clients = yes configuration
 */
export async function reloadFreeRadius(): Promise<void> {
  console.log('FreeRADIUS reload skipped (managed by dynamic SQL clients / no longer required)');
  return;
}

