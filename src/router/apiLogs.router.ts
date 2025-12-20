import { Router } from 'express';
import { ApiLogsController } from '../controllers/apiLogsController';
import { adminAuthMiddleware } from '../middleware/AdminAuthMiddleware';

export default class ApiLogsRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // GET - All routes require admin authentication
        this.router.get("/logs", adminAuthMiddleware(), ApiLogsController.getApiLogs);
        this.router.get("/stats", adminAuthMiddleware(), ApiLogsController.getApiStats);

        // DELETE
        this.router.delete("/old-logs", adminAuthMiddleware(), ApiLogsController.deleteOldLogs);
    }
}
