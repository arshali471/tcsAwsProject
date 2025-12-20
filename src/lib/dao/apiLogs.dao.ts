import apiLogsModel from "../../models/apiLogs.model";

export class ApiLogsDao {
    static async createLog(payload: any) {
        try {
            const result = await apiLogsModel.create(payload);
            return result;
        } catch (error) {
            console.error('DAO: Error creating log:', error);
            throw error;
        }
    }

    static async getLogs(filters: any = {}, limit: number = 100, skip: number = 0) {
        const query: any = {};

        if (filters.method) {
            query.method = filters.method;
        }

        if (filters.statusCode) {
            query.statusCode = filters.statusCode;
        }

        if (filters.endpoint) {
            query.endpoint = { $regex: filters.endpoint, $options: "i" };
        }

        if (filters.username) {
            query.username = { $regex: filters.username, $options: "i" };
        }

        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                startDate.setHours(0, 0, 0, 0); // Start of day
                query.createdAt.$gte = startDate;
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999); // End of day
                query.createdAt.$lte = endDate;
            }
        }

        const results = await apiLogsModel.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        return results;
    }

    static async getLogsCount(filters: any = {}) {
        const query: any = {};

        if (filters.method) {
            query.method = filters.method;
        }

        if (filters.statusCode) {
            query.statusCode = filters.statusCode;
        }

        if (filters.endpoint) {
            query.endpoint = { $regex: filters.endpoint, $options: "i" };
        }

        if (filters.username) {
            query.username = { $regex: filters.username, $options: "i" };
        }

        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                startDate.setHours(0, 0, 0, 0); // Start of day
                query.createdAt.$gte = startDate;
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999); // End of day
                query.createdAt.$lte = endDate;
            }
        }

        const count = await apiLogsModel.countDocuments(query);
        return count;
    }

    static async getApiStats(filters: any = {}) {
        const query: any = {};

        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                startDate.setHours(0, 0, 0, 0);
                query.createdAt.$gte = startDate;
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endDate;
            }
        }

        const stats = await apiLogsModel.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: 1 },
                    avgResponseTime: { $avg: "$responseTime" },
                    successCount: {
                        $sum: {
                            $cond: [{ $lt: ["$statusCode", 400] }, 1, 0]
                        }
                    },
                    errorCount: {
                        $sum: {
                            $cond: [{ $gte: ["$statusCode", 400] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        return stats[0] || {
            totalRequests: 0,
            avgResponseTime: 0,
            successCount: 0,
            errorCount: 0
        };
    }

    static async getMethodStats(filters: any = {}) {
        const query: any = {};

        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                startDate.setHours(0, 0, 0, 0);
                query.createdAt.$gte = startDate;
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endDate;
            }
        }

        return await apiLogsModel.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$method",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
    }

    static async getEndpointStats(filters: any = {}, limit: number = 10) {
        const query: any = {};

        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                startDate.setHours(0, 0, 0, 0);
                query.createdAt.$gte = startDate;
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endDate;
            }
        }

        return await apiLogsModel.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$endpoint",
                    count: { $sum: 1 },
                    avgResponseTime: { $avg: "$responseTime" }
                }
            },
            { $sort: { count: -1 } },
            { $limit: limit }
        ]);
    }

    static async deleteOldLogs(daysToKeep: number = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        return await apiLogsModel.deleteMany({
            createdAt: { $lt: cutoffDate }
        });
    }
}
