import express from "express";
import { ApiLogsDao } from "../lib/dao/apiLogs.dao";

export class ApiLogsController {
    static async getApiLogs(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const {
                page = "1",
                limit = "100",
                method,
                statusCode,
                endpoint,
                username,
                startDate,
                endDate
            } = req.query;

            console.log('getApiLogs - Query params:', req.query);

            const pageNum = Math.max(parseInt(page as string, 10), 1);
            const limitNum = Math.max(parseInt(limit as string, 10), 1);
            const skip = (pageNum - 1) * limitNum;

            const filters: any = {};
            if (method) filters.method = method;
            if (statusCode) filters.statusCode = parseInt(statusCode as string);
            if (endpoint) filters.endpoint = endpoint;
            if (username) filters.username = username;
            if (startDate) filters.startDate = startDate;
            if (endDate) filters.endDate = endDate;

            console.log('getApiLogs - Filters:', filters);
            console.log('getApiLogs - Pagination:', { page: pageNum, limit: limitNum, skip });

            const [logs, total] = await Promise.all([
                ApiLogsDao.getLogs(filters, limitNum, skip),
                ApiLogsDao.getLogsCount(filters)
            ]);

            console.log('getApiLogs - Results:', { logsCount: logs.length, total });

            return res.status(200).json({
                success: true,
                data: logs,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum)
                }
            });
        } catch (err) {
            console.error('getApiLogs - Error:', err);
            next(err);
        }
    }

    static async getApiStats(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { startDate, endDate } = req.query;

            const filters: any = {};
            if (startDate) filters.startDate = startDate;
            if (endDate) filters.endDate = endDate;

            const [stats, methodStats, endpointStats] = await Promise.all([
                ApiLogsDao.getApiStats(filters),
                ApiLogsDao.getMethodStats(filters),
                ApiLogsDao.getEndpointStats(filters, 10)
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    overall: stats,
                    byMethod: methodStats,
                    topEndpoints: endpointStats
                }
            });
        } catch (err) {
            next(err);
        }
    }

    static async deleteOldLogs(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { days = "30" } = req.query;
            const daysToKeep = parseInt(days as string, 10);

            const result = await ApiLogsDao.deleteOldLogs(daysToKeep);

            return res.status(200).json({
                success: true,
                message: `Deleted logs older than ${daysToKeep} days`,
                deletedCount: result.deletedCount
            });
        } catch (err) {
            next(err);
        }
    }
}
