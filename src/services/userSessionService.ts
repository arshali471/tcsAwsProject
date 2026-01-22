import { UserSessionDao } from "../lib/dao/userSession.dao";
import { UserAgentParser } from "../util/userAgentParser";
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/environment';
import crypto from 'crypto';

export class UserSessionService {
    /**
     * Create a new session on login
     */
    static async createSession(user: any, token: string, req: any) {
        try {
            const userAgent = req.headers['user-agent'] || 'unknown';
            const ipAddress = UserAgentParser.getClientIP(req);
            const { deviceType, browser, os } = UserAgentParser.parse(userAgent);

            // Decode token to get expiration time
            const decoded: any = jwt.decode(token);
            const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 60 * 60 * 1000);

            const sessionData = {
                userId: user._id,
                username: user.username,
                email: user.email || user.username, // Fallback to username if email not available
                token,
                ipAddress,
                userAgent,
                deviceType,
                browser,
                os,
                expiresAt
            };

            return await UserSessionDao.createSession(sessionData);
        } catch (error: any) {
            console.error('[Session] Error creating session:', error);
            throw error;
        }
    }

    /**
     * Update session last activity
     */
    static async updateActivity(token: string) {
        try {
            return await UserSessionDao.updateLastActivity(token);
        } catch (error: any) {
            console.error('[Session] Error updating activity:', error);
            return null;
        }
    }

    /**
     * End session on logout
     */
    static async endSession(token: string) {
        try {
            return await UserSessionDao.deactivateSession(token);
        } catch (error: any) {
            console.error('[Session] Error ending session:', error);
            throw error;
        }
    }

    /**
     * End all sessions for a user
     */
    static async endAllUserSessions(userId: string) {
        try {
            return await UserSessionDao.deactivateAllUserSessions(userId);
        } catch (error: any) {
            console.error('[Session] Error ending all user sessions:', error);
            throw error;
        }
    }

    /**
     * Get active sessions for a user
     */
    static async getUserSessions(userId: string) {
        try {
            return await UserSessionDao.getActiveUserSessions(userId);
        } catch (error: any) {
            console.error('[Session] Error getting user sessions:', error);
            return [];
        }
    }

    /**
     * Get all active users with session details (admin only)
     */
    static async getActiveUsers() {
        try {
            return await UserSessionDao.getAllActiveSessions();
        } catch (error: any) {
            console.error('[Session] Error getting active users:', error);
            return [];
        }
    }

    /**
     * Get detailed active sessions (admin only)
     */
    static async getActiveSessionsDetailed() {
        try {
            return await UserSessionDao.getActiveUsersDetailed();
        } catch (error: any) {
            console.error('[Session] Error getting detailed sessions:', error);
            return [];
        }
    }

    /**
     * Get session statistics (admin only)
     */
    static async getSessionStats() {
        try {
            return await UserSessionDao.getSessionStats();
        } catch (error: any) {
            console.error('[Session] Error getting session stats:', error);
            return {
                totalActiveSessions: 0,
                uniqueActiveUsers: 0,
                deviceBreakdown: [],
                last24HoursLogins: 0
            };
        }
    }

    /**
     * Expire old sessions (called by cron job)
     */
    static async expireOldSessions() {
        try {
            const result = await UserSessionDao.expireOldSessions();
            console.log(`[Session] Expired ${result.modifiedCount} old sessions`);
            return result;
        } catch (error: any) {
            console.error('[Session] Error expiring sessions:', error);
            throw error;
        }
    }

    /**
     * Cleanup old session records (called by cron job)
     */
    static async cleanupOldSessions(daysToKeep: number = 90) {
        try {
            const result = await UserSessionDao.cleanupOldSessions(daysToKeep);
            console.log(`[Session] Cleaned up ${result.deletedCount} old session records`);
            return result;
        } catch (error: any) {
            console.error('[Session] Error cleaning up sessions:', error);
            throw error;
        }
    }

    /**
     * Validate session
     */
    static async validateSession(token: string) {
        try {
            const session = await UserSessionDao.getSessionByToken(token);

            if (!session) {
                return { valid: false, reason: 'Session not found' };
            }

            if (!session.isActive) {
                return { valid: false, reason: 'Session is inactive' };
            }

            if (session.expiresAt < new Date()) {
                // Auto-deactivate expired session
                await UserSessionDao.deactivateSession(token);
                return { valid: false, reason: 'Session expired' };
            }

            return { valid: true, session };
        } catch (error: any) {
            console.error('[Session] Error validating session:', error);
            return { valid: false, reason: 'Validation error' };
        }
    }

    /**
     * Update session token (for token refresh)
     */
    static async updateSessionToken(oldToken: string, newToken: string) {
        try {
            const oldTokenHash = crypto.createHash('sha256').update(oldToken).digest('hex');
            const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');

            // Decode new token to get new expiry
            const decoded: any = jwt.decode(newToken);
            const newExpiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 60 * 60 * 1000);

            const result = await UserSessionDao.updateSessionToken(oldTokenHash, newTokenHash, newToken, newExpiresAt);
            console.log('[Session] Updated session token, affected:', result.modifiedCount);
            return result;
        } catch (error: any) {
            console.error('[Session] Error updating session token:', error);
            throw error;
        }
    }
}
