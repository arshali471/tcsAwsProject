import { Router } from 'express';
import { BedrockUsageController } from '../controllers/bedrockUsageController';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { adminAuthMiddleware } from '../middleware/AdminAuthMiddleware';

export default class BedrockUsageRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // User endpoints (authenticated users)
        this.router.post("/log", authMiddleware, BedrockUsageController.logUsage);
        this.router.get("/my-usage", authMiddleware, BedrockUsageController.getMyUsage);

        // Admin endpoints (admin only)
        this.router.get("/user/:userId", authMiddleware, adminAuthMiddleware, BedrockUsageController.getUserUsage);
        this.router.get("/user/by-username/:username", authMiddleware, adminAuthMiddleware, BedrockUsageController.getUserUsageByUsername);
        this.router.get("/inference-profile/:profileId", authMiddleware, adminAuthMiddleware, BedrockUsageController.getInferenceProfileUsage);
        this.router.get("/all-users", authMiddleware, adminAuthMiddleware, BedrockUsageController.getAllUsersUsage);
        this.router.get("/model-stats", authMiddleware, adminAuthMiddleware, BedrockUsageController.getModelStats);
        this.router.get("/admin/analytics", authMiddleware, adminAuthMiddleware, BedrockUsageController.getAdminAnalytics);
        this.router.delete("/cleanup", authMiddleware, adminAuthMiddleware, BedrockUsageController.cleanupOldRecords);
    }
}
