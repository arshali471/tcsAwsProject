import express from "express";
import { BedrockUsageService } from "../services/bedrockUsageService";

export class BedrockUsageController {
    /**
     * Log Bedrock inference usage
     * POST /api/v1/bedrock-usage/log
     * Body: { keyId, inferenceProfileId, modelId, modelName, provider, inputTokens, outputTokens, ... }
     */
    static async logUsage(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const user = req.user;
            const {
                keyId,
                region,
                environment,
                inferenceProfileId,
                inferenceProfileName,
                modelId,
                modelName,
                provider,
                requestId,
                inputTokens,
                outputTokens,
                latencyMs,
                status,
                errorMessage,
                metadata
            } = req.body;

            const usageRecord = await BedrockUsageService.logUsage({
                userId: String(user._id),
                username: user.username,
                email: user.email,
                region,
                environment,
                inferenceProfileId,
                inferenceProfileName,
                modelId,
                modelName,
                provider,
                requestId,
                inputTokens,
                outputTokens,
                latencyMs,
                status,
                errorMessage,
                metadata,
                keyId
            });

            res.status(201).send({
                success: true,
                message: "Usage logged successfully",
                data: usageRecord
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get current user's usage summary
     * GET /api/v1/bedrock-usage/my-usage?days=30&region=us-east-1
     */
    static async getMyUsage(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const user = req.user;
            const days = parseInt(req.query.days as string) || 30;
            const region = req.query.region as string | undefined;

            const summary = await BedrockUsageService.getUserUsageSummary(String(user._id), days, region);

            res.send({
                success: true,
                data: summary
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get usage for a specific user (admin only)
     * GET /api/v1/bedrock-usage/user/:userId?days=30&region=us-east-1
     */
    static async getUserUsage(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { userId } = req.params;
            const days = parseInt(req.query.days as string) || 30;
            const region = req.query.region as string | undefined;

            const summary = await BedrockUsageService.getUserUsageSummary(userId, days, region);

            res.send({
                success: true,
                data: summary
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get usage for a specific user by username (admin only)
     * GET /api/v1/bedrock-usage/user/by-username/:username?days=30
     */
    static async getUserUsageByUsername(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { username } = req.params;
            const days = parseInt(req.query.days as string) || 30;

            const records = await BedrockUsageService.getUserUsageByUsername(username, days);

            res.send({
                success: true,
                data: {
                    username,
                    recordCount: records.length,
                    records
                }
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get usage for a specific inference profile (admin only)
     * GET /api/v1/bedrock-usage/inference-profile/:profileId?days=30
     */
    static async getInferenceProfileUsage(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const { profileId } = req.params;
            const days = parseInt(req.query.days as string) || 30;

            const data = await BedrockUsageService.getInferenceProfileUsage(profileId, days);

            res.send({
                success: true,
                data
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get all users usage summary (admin only)
     * GET /api/v1/bedrock-usage/all-users?days=30&region=us-east-1
     */
    static async getAllUsersUsage(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const days = parseInt(req.query.days as string) || 30;
            const region = req.query.region as string | undefined;

            const summary = await BedrockUsageService.getAllUsersUsageSummary(days, region);

            res.send({
                success: true,
                data: {
                    period: {
                        days,
                        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                        endDate: new Date().toISOString()
                    },
                    region: region || 'all',
                    userCount: summary.length,
                    users: summary
                }
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get model usage statistics (admin only)
     * GET /api/v1/bedrock-usage/model-stats?days=30&region=us-east-1
     */
    static async getModelStats(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const days = parseInt(req.query.days as string) || 30;
            const region = req.query.region as string | undefined;

            const stats = await BedrockUsageService.getModelUsageStats(days, region);

            res.send({
                success: true,
                data: {
                    period: {
                        days,
                        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                        endDate: new Date().toISOString()
                    },
                    region: region || 'all',
                    modelCount: stats.length,
                    models: stats
                }
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get comprehensive admin analytics
     * GET /api/v1/bedrock-usage/admin/analytics?days=30&region=us-east-1
     */
    static async getAdminAnalytics(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const days = parseInt(req.query.days as string) || 30;
            const region = req.query.region as string | undefined;

            const analytics = await BedrockUsageService.getAdminAnalytics(days, region);

            res.send({
                success: true,
                data: analytics
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Clean up old usage records (admin only)
     * DELETE /api/v1/bedrock-usage/cleanup?daysToKeep=90
     */
    static async cleanupOldRecords(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        try {
            const daysToKeep = parseInt(req.query.daysToKeep as string) || 90;

            const result = await BedrockUsageService.cleanupOldRecords(daysToKeep);

            res.send({
                success: true,
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
}
