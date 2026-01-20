import cron from 'node-cron';
import { UserSessionService } from '../services/userSessionService';

/**
 * Cron job to expire old sessions and cleanup inactive sessions
 * Runs every 5 minutes
 */
export const initSessionCleanupCron = () => {
    // Expire sessions based on JWT expiry time - runs every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            console.log('[SessionCron] Running session expiry check...');
            const result = await UserSessionService.expireOldSessions();
            if (result.modifiedCount > 0) {
                console.log(`[SessionCron] Expired ${result.modifiedCount} sessions`);
            }
        } catch (error) {
            console.error('[SessionCron] Error expiring sessions:', error);
        }
    });

    // Cleanup old inactive session records - runs once daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
        try {
            console.log('[SessionCron] Running session cleanup...');
            const result = await UserSessionService.cleanupOldSessions(90);
            if (result.deletedCount > 0) {
                console.log(`[SessionCron] Cleaned up ${result.deletedCount} old session records`);
            }
        } catch (error) {
            console.error('[SessionCron] Error cleaning up sessions:', error);
        }
    });

    console.log('[SessionCron] Session cleanup cron jobs initialized');
};
