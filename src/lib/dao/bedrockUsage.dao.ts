import bedrockUsageModel from "../../models/bedrockUsage.model";

export class BedrockUsageDao {
    /**
     * Log a single Bedrock inference usage record
     */
    static async logUsage(usageData: any) {
        return await bedrockUsageModel.create(usageData);
    }

    /**
     * Get all usage records with optional filters
     */
    static async getAllUsage(filters: any = {}, limit: number = 1000, skip: number = 0) {
        return await bedrockUsageModel
            .find(filters)
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(skip)
            .lean();
    }

    /**
     * Get usage records for a specific user
     */
    static async getUserUsage(userId: string, days: number = 30, region?: string) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const filters: any = {
            userId,
            timestamp: { $gte: startDate }
        };

        if (region) {
            filters.region = region;
        }

        return await bedrockUsageModel
            .find(filters)
            .sort({ timestamp: -1 })
            .lean();
    }

    /**
     * Get usage records by username
     */
    static async getUserUsageByUsername(username: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await bedrockUsageModel
            .find({
                username,
                timestamp: { $gte: startDate }
            })
            .sort({ timestamp: -1 })
            .lean();
    }

    /**
     * Get aggregated usage statistics for a user
     */
    static async getUserUsageStats(userId: string, days: number = 30, region?: string) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const matchStage: any = {
            userId,
            timestamp: { $gte: startDate }
        };

        if (region) {
            matchStage.region = region;
        }

        return await bedrockUsageModel.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: null,
                    totalInputTokens: { $sum: "$inputTokens" },
                    totalOutputTokens: { $sum: "$outputTokens" },
                    totalTokens: { $sum: "$totalTokens" },
                    totalCost: { $sum: "$totalCost" },
                    totalRequests: { $sum: 1 },
                    successfulRequests: {
                        $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
                    },
                    errorRequests: {
                        $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] }
                    },
                    throttledRequests: {
                        $sum: { $cond: [{ $eq: ["$status", "throttled"] }, 1, 0] }
                    },
                    avgLatency: { $avg: "$latencyMs" }
                }
            }
        ]);
    }

    /**
     * Get usage by model for a user
     */
    static async getUserUsageByModel(userId: string, days: number = 30, region?: string) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const matchStage: any = {
            userId,
            timestamp: { $gte: startDate }
        };

        if (region) {
            matchStage.region = region;
        }

        return await bedrockUsageModel.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: {
                        modelId: "$modelId",
                        modelName: "$modelName",
                        provider: "$provider"
                    },
                    inputTokens: { $sum: "$inputTokens" },
                    outputTokens: { $sum: "$outputTokens" },
                    totalTokens: { $sum: "$totalTokens" },
                    totalCost: { $sum: "$totalCost" },
                    requestCount: { $sum: 1 },
                    avgLatency: { $avg: "$latencyMs" }
                }
            },
            {
                $sort: { totalCost: -1 }
            }
        ]);
    }

    /**
     * Get usage by inference profile
     */
    static async getUsageByInferenceProfile(inferenceProfileId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await bedrockUsageModel.aggregate([
            {
                $match: {
                    inferenceProfileId,
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        userId: "$userId",
                        username: "$username",
                        email: "$email"
                    },
                    inputTokens: { $sum: "$inputTokens" },
                    outputTokens: { $sum: "$outputTokens" },
                    totalTokens: { $sum: "$totalTokens" },
                    totalCost: { $sum: "$totalCost" },
                    requestCount: { $sum: 1 }
                }
            },
            {
                $sort: { totalCost: -1 }
            }
        ]);
    }

    /**
     * Get all users usage summary
     */
    static async getAllUsersUsageSummary(days: number = 30, region?: string) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const matchStage: any = {
            timestamp: { $gte: startDate }
        };

        if (region) {
            matchStage.region = region;
        }

        return await bedrockUsageModel.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: {
                        userId: "$userId",
                        username: "$username",
                        email: "$email"
                    },
                    totalInputTokens: { $sum: "$inputTokens" },
                    totalOutputTokens: { $sum: "$outputTokens" },
                    totalTokens: { $sum: "$totalTokens" },
                    totalCost: { $sum: "$totalCost" },
                    totalRequests: { $sum: 1 },
                    modelsUsed: { $addToSet: "$modelId" },
                    successfulRequests: {
                        $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
                    },
                    errorRequests: {
                        $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] }
                    },
                    lastUsed: { $max: "$timestamp" }
                }
            },
            {
                $project: {
                    userId: "$_id.userId",
                    username: "$_id.username",
                    email: "$_id.email",
                    totalInputTokens: 1,
                    totalOutputTokens: 1,
                    totalTokens: 1,
                    totalCost: 1,
                    totalRequests: 1,
                    successfulRequests: 1,
                    errorRequests: 1,
                    modelsUsedCount: { $size: "$modelsUsed" },
                    lastUsed: 1,
                    _id: 0
                }
            },
            {
                $sort: { totalCost: -1 }
            }
        ]);
    }

    /**
     * Get daily usage trend for a user
     */
    static async getUserDailyUsage(userId: string, days: number = 30, region?: string) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const matchStage: any = {
            userId,
            timestamp: { $gte: startDate }
        };

        if (region) {
            matchStage.region = region;
        }

        return await bedrockUsageModel.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
                    },
                    inputTokens: { $sum: "$inputTokens" },
                    outputTokens: { $sum: "$outputTokens" },
                    totalCost: { $sum: "$totalCost" },
                    requestCount: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            },
            {
                $project: {
                    date: "$_id",
                    inputTokens: 1,
                    outputTokens: 1,
                    totalCost: 1,
                    requestCount: 1,
                    _id: 0
                }
            }
        ]);
    }

    /**
     * Get model usage statistics across all users
     */
    static async getModelUsageStats(days: number = 30, region?: string) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const matchStage: any = {
            timestamp: { $gte: startDate }
        };

        if (region) {
            matchStage.region = region;
        }

        return await bedrockUsageModel.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: {
                        modelId: "$modelId",
                        modelName: "$modelName",
                        provider: "$provider"
                    },
                    totalInputTokens: { $sum: "$inputTokens" },
                    totalOutputTokens: { $sum: "$outputTokens" },
                    totalCost: { $sum: "$totalCost" },
                    totalRequests: { $sum: 1 },
                    uniqueUsers: { $addToSet: "$userId" },
                    avgLatency: { $avg: "$latencyMs" }
                }
            },
            {
                $project: {
                    modelId: "$_id.modelId",
                    modelName: "$_id.modelName",
                    provider: "$_id.provider",
                    totalInputTokens: 1,
                    totalOutputTokens: 1,
                    totalCost: 1,
                    totalRequests: 1,
                    uniqueUsersCount: { $size: "$uniqueUsers" },
                    avgLatency: 1,
                    _id: 0
                }
            },
            {
                $sort: { totalCost: -1 }
            }
        ]);
    }

    /**
     * Delete old usage records (for cleanup/maintenance)
     */
    static async deleteOldRecords(daysToKeep: number = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        return await bedrockUsageModel.deleteMany({
            timestamp: { $lt: cutoffDate }
        });
    }
}
