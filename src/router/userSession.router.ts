import { Router } from 'express';
import { UserSessionController } from '../controllers/userSessionController';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { adminAuthMiddleware } from '../middleware/AdminAuthMiddleware';

export default class UserSessionRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // User endpoints (authenticated users can view their own sessions)
        this.router.get("/my-sessions", authMiddleware, UserSessionController.getMySessions);

        // Admin endpoints (admin only)
        this.router.get("/active-users", authMiddleware, adminAuthMiddleware, UserSessionController.getActiveUsers);
        this.router.get("/active-sessions", authMiddleware, adminAuthMiddleware, UserSessionController.getActiveSessions);
        this.router.get("/stats", authMiddleware, adminAuthMiddleware, UserSessionController.getSessionStats);
        this.router.get("/users-with-status", authMiddleware, adminAuthMiddleware, UserSessionController.getUsersWithStatus);
        this.router.get("/user/:userId", authMiddleware, adminAuthMiddleware, UserSessionController.getUserSessions);
        this.router.post("/user/:userId/end-all", authMiddleware, adminAuthMiddleware, UserSessionController.endAllUserSessions);
        this.router.post("/expire-old", authMiddleware, adminAuthMiddleware, UserSessionController.expireOldSessions);
    }
}
