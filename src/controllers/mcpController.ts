import { Request, Response, NextFunction } from "express";
import { MCPService } from "../services/mcpService";

export class MCPController {
    private mcpService: MCPService;

    constructor() {
        this.mcpService = new MCPService();
    }

    async query(req: Request, res: Response, next: NextFunction) {
        try {
            const { query, session_id, server_name, encrypted_credentials, eks_token_id } = req.body;

            if (!query) {
                return res.status(400).json({ error: "Query is required" });
            }

            const response = await this.mcpService.query({
                query,
                session_id,
                server_name,
                encrypted_credentials,
                eks_token_id
            });

            res.json({
                response,
                session_id: session_id || "default",
                server_used: server_name || "default"
            });
        } catch (error: any) {
            console.error("MCP query error:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async queryStream(req: Request, res: Response, next: NextFunction) {
        try {
            const { query, session_id, server_name, encrypted_credentials, eks_token_id } = req.body;

            if (!query) {
                return res.status(400).json({ error: "Query is required" });
            }

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            const stream = this.mcpService.queryStream({
                query,
                session_id,
                server_name,
                encrypted_credentials,
                eks_token_id
            });

            for await (const chunk of stream) {
                res.write(`data: ${chunk}\n\n`);
            }

            res.end();
        } catch (error: any) {
            console.error("MCP stream error:", error);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        }
    }

    async listServers(req: Request, res: Response, next: NextFunction) {
        try {
            const servers = this.mcpService.getActiveServers();
            res.json(servers);
        } catch (error: any) {
            console.error("List servers error:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async healthCheck(req: Request, res: Response, next: NextFunction) {
        res.json({ status: "healthy" });
    }
}
