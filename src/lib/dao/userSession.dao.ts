import userSessionModel from "../../models/userSession.model";
import crypto from 'crypto';

export class UserSessionDao {
    /**
     * Create a new session
     */
    static async createSession(sessionData: any) {
        // Hash the token for storage
        const tokenHash = crypto.createHash('sha256').update(sessionData.token).digest('hex');

        return await userSessionModel.create({
            ...sessionData,
            tokenHash,
            isActive: true,
            loginTime: new Date(),
            lastActivityTime: new Date()
        });
    }

    /**
     * Get session by token
     */
    static async getSessionByToken(token: string) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        return await userSessionModel.findOne({
            tokenHash,
            isActive: true
        });
    }

    /**
     * Update session last activity
     */
    static async updateLastActivity(token: string) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        return await userSessionModel.findOneAndUpdate(
            { tokenHash, isActive: true },
            { lastActivityTime: new Date() },
            { new: true }
        );
    }

    /**
     * Mark session as inactive (logout)
     */
    static async deactivateSession(token: string) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const session = await userSessionModel.findOne({ tokenHash, isActive: true });

        if (session) {
            const logoutTime = new Date();
            const sessionDuration = Math.floor((logoutTime.getTime() - session.loginTime.getTime()) / 1000);

            return await userSessionModel.findOneAndUpdate(
                { tokenHash, isActive: true },
                {
                    isActive: false,
                    logoutTime,
                    sessionDuration
                },
                { new: true }
            );
        }

        return null;
    }

    /**
     * Deactivate all sessions for a user
     */
    static async deactivateAllUserSessions(userId: string) {
        const now = new Date();
        return await userSessionModel.updateMany(
            { userId, isActive: true },
            {
                isActive: false,
                logoutTime: now
            }
        );
    }

    /**
     * Get all active sessions for a user
     */
    static async getActiveUserSessions(userId: string) {
        return await userSessionModel.find({
            userId,
            isActive: true,
            expiresAt: { $gt: new Date() }
        }).sort({ lastActivityTime: -1 });
    }

    /**
     * Get all active sessions (for admin)
     */
    static async getAllActiveSessions() {
        return await userSessionModel.aggregate([
            {
                $match: {
                    isActive: true,
                    expiresAt: { $gt: new Date() }
                }
            },
            {
                $group: {
                    _id: "$userId",
                    username: { $first: "$username" },
                    email: { $first: "$email" },
                    sessionCount: { $sum: 1 },
                    lastActivity: { $max: "$lastActivityTime" },
                    sessions: {
                        $push: {
                            ipAddress: "$ipAddress",
                            deviceType: "$deviceType",
                            browser: "$browser",
                            os: "$os",
                            location: "$location",
                            loginTime: "$loginTime",
                            lastActivityTime: "$lastActivityTime"
                        }
                    }
                }
            },
            {
                $sort: { lastActivity: -1 }
            }
        ]);
    }

    /**
     * Get detailed active users list
     */
    static async getActiveUsersDetailed() {
        return await userSessionModel.find({
            isActive: true,
            expiresAt: { $gt: new Date() }
        })
        .sort({ lastActivityTime: -1 })
        .select('-token -tokenHash'); // Don't expose tokens
    }

    /**
     * Expire sessions based on expiresAt time
     */
    static async expireOldSessions() {
        const now = new Date();
        return await userSessionModel.updateMany(
            {
                isActive: true,
                expiresAt: { $lt: now }
            },
            {
                isActive: false,
                logoutTime: now
            }
        );
    }

    /**
     * Get session statistics
     */
    static async getSessionStats() {
        const now = new Date();

        const stats = await userSessionModel.aggregate([
            {
                $facet: {
                    totalActive: [
                        {
                            $match: {
                                isActive: true,
                                expiresAt: { $gt: now }
                            }
                        },
                        { $count: "count" }
                    ],
                    uniqueActiveUsers: [
                        {
                            $match: {
                                isActive: true,
                                expiresAt: { $gt: now }
                            }
                        },
                        {
                            $group: {
                                _id: "$userId"
                            }
                        },
                        { $count: "count" }
                    ],
                    deviceBreakdown: [
                        {
                            $match: {
                                isActive: true,
                                expiresAt: { $gt: now }
                            }
                        },
                        {
                            $group: {
                                _id: "$deviceType",
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    recentLogins: [
                        {
                            $match: {
                                loginTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                            }
                        },
                        { $count: "count" }
                    ]
                }
            }
        ]);

        return {
            totalActiveSessions: stats[0].totalActive[0]?.count || 0,
            uniqueActiveUsers: stats[0].uniqueActiveUsers[0]?.count || 0,
            deviceBreakdown: stats[0].deviceBreakdown || [],
            last24HoursLogins: stats[0].recentLogins[0]?.count || 0
        };
    }

    /**
     * Delete old inactive sessions (cleanup)
     */
    static async cleanupOldSessions(daysToKeep: number = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        return await userSessionModel.deleteMany({
            isActive: false,
            logoutTime: { $lt: cutoffDate }
        });
    }

    /**
     * Update session token (for token refresh)
     */
    static async updateSessionToken(oldTokenHash: string, newTokenHash: string, newToken: string, newExpiresAt: Date) {
        return await userSessionModel.updateOne(
            {
                tokenHash: oldTokenHash,
                isActive: true
            },
            {
                $set: {
                    token: newToken,
                    tokenHash: newTokenHash,
                    expiresAt: newExpiresAt,
                    lastActivityTime: new Date()
                }
            }
        );
    }
}
