import express from "express";
import { UserSessionService } from "../services/userSessionService";
import { UserService } from "../services/userService";

export class UserSessionController {
    /**
     * Get all active users with their session details (admin only)
     * GET /api/v1/sessions/active-users
     */
    static async getActiveUsers(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const activeUsers = await UserSessionService.getActiveUsers();

            res.send({
                success: true,
                count: activeUsers.length,
                data: activeUsers
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get detailed active sessions (admin only)
     * GET /api/v1/sessions/active-sessions
     */
    static async getActiveSessions(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const sessions = await UserSessionService.getActiveSessionsDetailed();

            res.send({
                success: true,
                count: sessions.length,
                data: sessions
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get session statistics (admin only)
     * GET /api/v1/sessions/stats
     */
    static async getSessionStats(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const stats = await UserSessionService.getSessionStats();

            res.send({
                success: true,
                data: stats
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get current user's active sessions
     * GET /api/v1/sessions/my-sessions
     */
    static async getMySessions(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const userId = req.user._id;
            const sessions = await UserSessionService.getUserSessions(String(userId));

            res.send({
                success: true,
                count: sessions.length,
                data: sessions
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get specific user's active sessions (admin only)
     * GET /api/v1/sessions/user/:userId
     */
    static async getUserSessions(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { userId } = req.params;
            const sessions = await UserSessionService.getUserSessions(userId);

            // Get user details
            const user = await UserService.getUserById(userId);

            if (!user) {
                return res.status(404).send({ success: false, message: "User not found" });
            }

            res.send({
                success: true,
                user: {
                    userId: user._id,
                    username: user.username,
                    email: user.email
                },
                count: sessions.length,
                data: sessions
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * End all sessions for a specific user (admin only)
     * POST /api/v1/sessions/user/:userId/end-all
     */
    static async endAllUserSessions(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { userId } = req.params;

            const result = await UserSessionService.endAllUserSessions(userId);

            res.send({
                success: true,
                message: `Ended ${result.modifiedCount} active sessions for user`,
                data: result
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Manually trigger session expiry check (admin only)
     * POST /api/v1/sessions/expire-old
     */
    static async expireOldSessions(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const result = await UserSessionService.expireOldSessions();

            res.send({
                success: true,
                message: `Expired ${result.modifiedCount} old sessions`,
                data: result
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get active users list with real-time status (admin only)
     * This endpoint combines user data with session status
     * GET /api/v1/sessions/users-with-status
     */
    static async getUsersWithStatus(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            // Get all users
            const allUsers = await UserService.getAllUser();

            // Get active sessions grouped by user
            const activeSessions = await UserSessionService.getActiveUsers();

            // Create a map of active users for quick lookup
            const activeUsersMap = new Map(
                activeSessions.map((session: any) => [
                    String(session._id),
                    {
                        sessionCount: session.sessionCount,
                        lastActivity: session.lastActivity,
                        sessions: session.sessions
                    }
                ])
            );

            // Combine user data with session status
            const usersWithStatus = allUsers.map((user: any) => {
                const sessionData = activeUsersMap.get(String(user._id));
                const isActive = !!sessionData;

                return {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    admin: user.admin,
                    isActive: isActive,
                    sessionCount: sessionData?.sessionCount || 0,
                    lastActivity: sessionData?.lastActivity || user.lastLogout || user.lastLogin,
                    lastLogin: user.lastLogin,
                    lastLogout: user.lastLogout,
                    createdAt: user.createdAt,
                    sessions: sessionData?.sessions || [],
                    ssoProvider: user.ssoProvider || 'local'
                };
            });

            // Sort by activity (active users first, then by last activity time)
            usersWithStatus.sort((a: any, b: any) => {
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;
                return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
            });

            res.send({
                success: true,
                totalUsers: usersWithStatus.length,
                activeUsers: usersWithStatus.filter((u: any) => u.isActive).length,
                inactiveUsers: usersWithStatus.filter((u: any) => !u.isActive).length,
                data: usersWithStatus
            });
        } catch (err) {
            next(err);
        }
    }
}
