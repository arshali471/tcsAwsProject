import { BedrockUsageDao } from "../lib/dao/bedrockUsage.dao";
import { BedrockPricingService } from "./bedrockPricingService";

export class BedrockUsageService {
    /**
     * Log Bedrock inference usage
     * @param usageData - Usage details including user, model, tokens, etc.
     */
    static async logUsage(usageData: {
        userId: string;
        username: string;
        email: string;
        region: string;
        environment: string;
        inferenceProfileId?: string;
        inferenceProfileName?: string;
        modelId: string;
        modelName: string;
        provider: string;
        requestId?: string;
        inputTokens: number;
        outputTokens: number;
        latencyMs?: number;
        status?: 'success' | 'error' | 'throttled';
        errorMessage?: string;
        metadata?: any;
        keyId: string; // For calculating costs
    }) {
        try {
            // Calculate costs based on pricing
            const pricing = await BedrockPricingService.getModelPricing(usageData.keyId, usageData.modelId);

            let inputCost = 0;
            let outputCost = 0;
            let totalCost = 0;

            if (pricing) {
                inputCost = (usageData.inputTokens / 1000) * pricing.input;
                outputCost = (usageData.outputTokens / 1000) * pricing.output;
                totalCost = inputCost + outputCost;
            }

            const totalTokens = usageData.inputTokens + usageData.outputTokens;

            const usageRecord = {
                userId: usageData.userId,
                username: usageData.username,
                email: usageData.email,
                region: usageData.region,
                environment: usageData.environment,
                inferenceProfileId: usageData.inferenceProfileId,
                inferenceProfileName: usageData.inferenceProfileName,
                modelId: usageData.modelId,
                modelName: usageData.modelName,
                provider: usageData.provider,
                requestId: usageData.requestId,
                inputTokens: usageData.inputTokens,
                outputTokens: usageData.outputTokens,
                totalTokens,
                inputCost,
                outputCost,
                totalCost,
                currency: 'USD',
                latencyMs: usageData.latencyMs,
                status: usageData.status || 'success',
                errorMessage: usageData.errorMessage,
                metadata: usageData.metadata || {},
                timestamp: new Date()
            };

            return await BedrockUsageDao.logUsage(usageRecord);
        } catch (error: any) {
            console.error('[Bedrock Usage] Error logging usage:', error);
            throw error;
        }
    }

    /**
     * Get usage records for a specific user
     */
    static async getUserUsage(userId: string, days: number = 30, region?: string) {
        return await BedrockUsageDao.getUserUsage(userId, days, region);
    }

    /**
     * Get usage records by username
     */
    static async getUserUsageByUsername(username: string, days: number = 30) {
        return await BedrockUsageDao.getUserUsageByUsername(username, days);
    }

    /**
     * Get aggregated usage statistics for a user
     */
    static async getUserUsageStats(userId: string, days: number = 30, region?: string) {
        const stats = await BedrockUsageDao.getUserUsageStats(userId, days, region);
        return stats[0] || {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            totalRequests: 0,
            successfulRequests: 0,
            errorRequests: 0,
            throttledRequests: 0,
            avgLatency: 0
        };
    }

    /**
     * Get usage by model for a user
     */
    static async getUserUsageByModel(userId: string, days: number = 30, region?: string) {
        const results = await BedrockUsageDao.getUserUsageByModel(userId, days, region);

        return results.map((item: any) => ({
            modelId: item._id.modelId,
            modelName: item._id.modelName,
            provider: item._id.provider,
            inputTokens: item.inputTokens,
            outputTokens: item.outputTokens,
            totalTokens: item.totalTokens,
            totalCost: item.totalCost,
            requestCount: item.requestCount,
            avgLatency: item.avgLatency ? Math.round(item.avgLatency) : 0
        }));
    }

    /**
     * Get detailed usage summary for a user
     */
    static async getUserUsageSummary(userId: string, days: number = 30, region?: string) {
        try {
            const [stats, byModel, dailyUsage] = await Promise.all([
                this.getUserUsageStats(userId, days, region),
                this.getUserUsageByModel(userId, days, region),
                BedrockUsageDao.getUserDailyUsage(userId, days, region)
            ]);

            return {
                period: {
                    days,
                    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                },
                summary: stats,
                byModel: byModel || [],
                dailyUsage: dailyUsage || []
            };
        } catch (error: any) {
            console.error('[Bedrock Usage] Error getting user summary:', error);
            // Return empty data structure instead of throwing
            return {
                period: {
                    days,
                    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                },
                summary: {
                    totalInputTokens: 0,
                    totalOutputTokens: 0,
                    totalTokens: 0,
                    totalCost: 0,
                    totalRequests: 0,
                    successfulRequests: 0,
                    errorRequests: 0,
                    throttledRequests: 0,
                    avgLatency: 0
                },
                byModel: [],
                dailyUsage: []
            };
        }
    }

    /**
     * Get usage for a specific inference profile
     */
    static async getInferenceProfileUsage(inferenceProfileId: string, days: number = 30) {
        const results = await BedrockUsageDao.getUsageByInferenceProfile(inferenceProfileId, days);

        return {
            inferenceProfileId,
            period: {
                days,
                startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date().toISOString()
            },
            users: results.map((item: any) => ({
                userId: item._id.userId,
                username: item._id.username,
                email: item._id.email,
                inputTokens: item.inputTokens,
                outputTokens: item.outputTokens,
                totalTokens: item.totalTokens,
                totalCost: item.totalCost,
                requestCount: item.requestCount
            }))
        };
    }

    /**
     * Get all users usage summary (admin view)
     */
    static async getAllUsersUsageSummary(days: number = 30, region?: string) {
        return await BedrockUsageDao.getAllUsersUsageSummary(days, region);
    }

    /**
     * Get model usage statistics across all users (admin view)
     */
    static async getModelUsageStats(days: number = 30, region?: string) {
        return await BedrockUsageDao.getModelUsageStats(days, region);
    }

    /**
     * Get comprehensive analytics for admin dashboard
     */
    static async getAdminAnalytics(days: number = 30, region?: string) {
        try {
            const [usersSummary, modelStats] = await Promise.all([
                this.getAllUsersUsageSummary(days, region),
                this.getModelUsageStats(days, region)
            ]);

            // Calculate overall totals
            const overallStats = usersSummary.reduce((acc: any, user: any) => ({
                totalUsers: acc.totalUsers + 1,
                totalInputTokens: acc.totalInputTokens + user.totalInputTokens,
                totalOutputTokens: acc.totalOutputTokens + user.totalOutputTokens,
                totalTokens: acc.totalTokens + user.totalTokens,
                totalCost: acc.totalCost + user.totalCost,
                totalRequests: acc.totalRequests + user.totalRequests,
                successfulRequests: acc.successfulRequests + user.successfulRequests,
                errorRequests: acc.errorRequests + user.errorRequests
            }), {
                totalUsers: 0,
                totalInputTokens: 0,
                totalOutputTokens: 0,
                totalTokens: 0,
                totalCost: 0,
                totalRequests: 0,
                successfulRequests: 0,
                errorRequests: 0
            });

            return {
                period: {
                    days,
                    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                },
                region: region || 'all',
                overallStats,
                topUsers: usersSummary.slice(0, 10),
                topModels: modelStats.slice(0, 10),
                allUsers: usersSummary,
                allModels: modelStats
            };
        } catch (error: any) {
            console.error('[Bedrock Usage] Error getting admin analytics:', error);
            // Return empty data structure
            return {
                period: {
                    days,
                    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                },
                region: region || 'all',
                overallStats: {
                    totalUsers: 0,
                    totalInputTokens: 0,
                    totalOutputTokens: 0,
                    totalTokens: 0,
                    totalCost: 0,
                    totalRequests: 0,
                    successfulRequests: 0,
                    errorRequests: 0
                },
                topUsers: [],
                topModels: [],
                allUsers: [],
                allModels: []
            };
        }
    }

    /**
     * Clean up old usage records
     */
    static async cleanupOldRecords(daysToKeep: number = 90) {
        const result = await BedrockUsageDao.deleteOldRecords(daysToKeep);
        return {
            deletedCount: result.deletedCount,
            message: `Deleted ${result.deletedCount} records older than ${daysToKeep} days`
        };
    }
}
