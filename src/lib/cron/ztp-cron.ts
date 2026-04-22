import cron from 'node-cron';
import { runZtpOrchestrator } from '../ztp/orchestrator';

let isRunning = false;

export function initZtpCron() {
  console.log('[CRON] Initializing ZTP Auto-Provisioning Loop (runs every 30s)...');
  
  // Runs every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    if (isRunning) {
      console.log('[ZTP CRON] Previous cycle still running, skipping this tick.');
      return;
    }
    
    isRunning = true;
    try {
      await runZtpOrchestrator();
    } catch (err) {
      console.error('[ZTP CRON] Encountered an error:', err);
    } finally {
      isRunning = false;
    }
  });
}
