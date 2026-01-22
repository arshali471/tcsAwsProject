import { Router } from "express";
import { MCPController } from "../controllers/mcpController";

export default class MCPRouter {
    public router: Router;
    private mcpController: MCPController;

    constructor() {
        this.router = Router();
        this.mcpController = new MCPController();
        this.initRoutes();
    }

    private initRoutes() {
        this.router.post("/query", this.mcpController.query.bind(this.mcpController));
        this.router.post("/query/stream", this.mcpController.queryStream.bind(this.mcpController));
        this.router.get("/servers", this.mcpController.listServers.bind(this.mcpController));
        this.router.get("/health", this.mcpController.healthCheck.bind(this.mcpController));
    }
}
