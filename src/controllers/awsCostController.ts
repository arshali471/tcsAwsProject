import express from "express";
import { AWSCostService } from "../services/awsCostService";
import { DateTime } from "luxon";

export class AwsCostController {
    /**
     * GET /api/v1/aws/cost/dashboard/:keyId
     * Get comprehensive cost dashboard data
     * Query params: ?days=30 (optional, default 30)
     */
    static async getCostDashboard(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const days = parseInt(req.query.days as string) || 30;

            const dashboardData = await AWSCostService.getCostDashboardData(keyId, days);

            res.status(200).json({
                success: true,
                data: dashboardData,
            });
        } catch (err: any) {
            console.error("Error fetching cost dashboard:", err);

            // Extract detailed error information
            const errorDetails = {
                success: false,
                message: err.message || "Failed to fetch cost dashboard data",
                errorType: err.name || "Unknown Error",
                details: null as any
            };

            // Handle AWS IAM permission errors
            if (err.message && err.message.includes("is not authorized to perform")) {
                errorDetails.errorType = "IAM Permission Error";
                errorDetails.message = "IAM user lacks required permissions for AWS Cost Explorer";
                errorDetails.details = {
                    error: err.message,
                    requiredPermissions: [
                        "ce:GetCostAndUsage",
                        "ce:GetCostForecast"
                    ],
                    solution: "Please add the following IAM policy to the user/role:\n" +
                             "{\n" +
                             '  "Version": "2012-10-17",\n' +
                             '  "Statement": [\n' +
                             '    {\n' +
                             '      "Effect": "Allow",\n' +
                             '      "Action": [\n' +
                             '        "ce:GetCostAndUsage",\n' +
                             '        "ce:GetCostForecast",\n' +
                             '        "ce:GetDimensionValues"\n' +
                             '      ],\n' +
                             '      "Resource": "*"\n' +
                             '    }\n' +
                             '  ]\n' +
                             '}',
                    awsDocumentation: "https://docs.aws.amazon.com/cost-management/latest/userguide/billing-permissions-ref.html"
                };
            } else if (err.code === "AccessDeniedException") {
                errorDetails.errorType = "Access Denied";
                errorDetails.message = "Access denied to AWS Cost Explorer";
                errorDetails.details = {
                    error: err.message,
                    hint: "Verify IAM permissions for Cost Explorer access"
                };
            }

            return res.status(403).json(errorDetails);
        }
    }

    /**
     * GET /api/v1/aws/cost/by-service/:keyId
     * Get costs grouped by AWS service
     * Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&granularity=DAILY
     */
    static async getCostByService(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const { startDate, endDate, granularity } = req.query;

            // Default to last 30 days if not provided
            const end = endDate ? String(endDate) : DateTime.now().toISODate()!;
            const start = startDate ? String(startDate) : DateTime.now().minus({ days: 30 }).toISODate()!;
            const gran = granularity ? String(granularity).toUpperCase() : "DAILY";

            if (!["DAILY", "MONTHLY", "HOURLY"].includes(gran)) {
                return res.status(400).json({
                    success: false,
                    message: "Granularity must be DAILY, MONTHLY, or HOURLY",
                });
            }

            const costData = await AWSCostService.getCostByService(keyId, start, end, gran);

            res.status(200).json({
                success: true,
                data: costData,
            });
        } catch (err: any) {
            console.error("Error fetching cost by service:", err);
            return res.status(403).json({
                success: false,
                message: err.message || "Failed to fetch cost by service",
                errorType: err.name || "Unknown Error",
                details: err.message && err.message.includes("is not authorized")
                    ? { error: err.message, hint: "IAM permissions required for ce:GetCostAndUsage" }
                    : null
            });
        }
    }

    /**
     * GET /api/v1/aws/cost/by-resource/:keyId
     * Get costs grouped by resource (instance, bucket, etc.)
     * Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
     */
    static async getCostByResource(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const { startDate, endDate } = req.query;

            const end = endDate ? String(endDate) : DateTime.now().toISODate()!;
            const start = startDate ? String(startDate) : DateTime.now().minus({ days: 30 }).toISODate()!;

            const costData = await AWSCostService.getCostByResource(keyId, start, end);

            res.status(200).json({
                success: true,
                data: costData,
            });
        } catch (err: any) {
            console.error("Error fetching cost by resource:", err);
            next(err);
        }
    }

    /**
     * GET /api/v1/aws/cost/ec2-instances/:keyId
     * Get EC2 instance costs with details
     * Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
     */
    static async getEC2InstanceCosts(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const { startDate, endDate } = req.query;

            const end = endDate ? String(endDate) : DateTime.now().toISODate()!;
            const start = startDate ? String(startDate) : DateTime.now().minus({ days: 30 }).toISODate()!;

            const costData = await AWSCostService.getEC2InstanceCosts(keyId, start, end);

            res.status(200).json({
                success: true,
                data: costData,
            });
        } catch (err: any) {
            console.error("Error fetching EC2 instance costs:", err);
            next(err);
        }
    }

    /**
     * GET /api/v1/aws/cost/forecast/:keyId
     * Get cost forecast for next 30 days
     */
    static async getCostForecast(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;

            const forecastData = await AWSCostService.getCostForecast(keyId);

            res.status(200).json({
                success: true,
                data: forecastData,
            });
        } catch (err: any) {
            console.error("Error fetching cost forecast:", err);
            next(err);
        }
    }

    /**
     * GET /api/v1/aws/cost/compare/:keyId
     * Compare costs across different time periods
     * Query params: ?currentStart=YYYY-MM-DD&currentEnd=YYYY-MM-DD&previousStart=YYYY-MM-DD&previousEnd=YYYY-MM-DD
     */
    static async compareCosts(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const { currentStart, currentEnd, previousStart, previousEnd } = req.query;

            // Default: compare last 30 days vs previous 30 days
            const currEnd = currentEnd ? String(currentEnd) : DateTime.now().toISODate()!;
            const currStart = currentStart ? String(currentStart) : DateTime.now().minus({ days: 30 }).toISODate()!;
            const prevEnd = previousEnd ? String(previousEnd) : DateTime.now().minus({ days: 30 }).toISODate()!;
            const prevStart = previousStart ? String(previousStart) : DateTime.now().minus({ days: 60 }).toISODate()!;

            const [currentPeriod, previousPeriod] = await Promise.all([
                AWSCostService.getCostByService(keyId, currStart, currEnd, "DAILY"),
                AWSCostService.getCostByService(keyId, prevStart, prevEnd, "DAILY"),
            ]);

            const currentTotal = parseFloat(currentPeriod.totalCost);
            const previousTotal = parseFloat(previousPeriod.totalCost);
            const difference = currentTotal - previousTotal;
            const percentageChange = previousTotal > 0
                ? ((difference / previousTotal) * 100).toFixed(2)
                : "N/A";

            res.status(200).json({
                success: true,
                data: {
                    currentPeriod: {
                        ...currentPeriod,
                        label: "Current Period",
                    },
                    previousPeriod: {
                        ...previousPeriod,
                        label: "Previous Period",
                    },
                    comparison: {
                        difference: difference.toFixed(2),
                        percentageChange,
                        trend: difference > 0 ? "increased" : difference < 0 ? "decreased" : "unchanged",
                        currency: currentPeriod.currency,
                    },
                },
            });
        } catch (err: any) {
            console.error("Error comparing costs:", err);
            return res.status(403).json({
                success: false,
                message: err.message || "Failed to compare costs",
                errorType: err.name || "Unknown Error",
                details: err.message && err.message.includes("is not authorized")
                    ? { error: err.message, hint: "IAM permissions required for ce:GetCostAndUsage" }
                    : null
            });
        }
    }

    /**
     * GET /api/v1/aws/cost/top-services/:keyId
     * Get top N most expensive services
     * Query params: ?limit=10&days=30
     */
    static async getTopServices(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const limit = parseInt(req.query.limit as string) || 10;
            const days = parseInt(req.query.days as string) || 30;

            const endDate = DateTime.now().toISODate()!;
            const startDate = DateTime.now().minus({ days }).toISODate()!;

            const costData = await AWSCostService.getCostByService(keyId, startDate, endDate, "DAILY");

            res.status(200).json({
                success: true,
                data: {
                    topServices: costData.services.slice(0, limit),
                    totalCost: costData.totalCost,
                    currency: costData.currency,
                    period: costData.period,
                },
            });
        } catch (err: any) {
            console.error("Error fetching top services:", err);
            return res.status(403).json({
                success: false,
                message: err.message || "Failed to fetch top services",
                errorType: err.name || "Unknown Error",
                details: err.message && err.message.includes("is not authorized")
                    ? { error: err.message, hint: "IAM permissions required for ce:GetCostAndUsage" }
                    : null
            });
        }
    }

    /**
     * GET /api/v1/aws/cost/bedrock/:keyId
     * Get AWS Bedrock model usage and costs
     * Query params: ?days=30 (optional, default 30)
     */
    static async getBedrockCosts(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const days = parseInt(req.query.days as string) || 30;

            const bedrockData = await AWSCostService.getBedrockCosts(keyId, days);

            res.status(200).json({
                success: true,
                data: bedrockData,
            });
        } catch (err: any) {
            console.error("Error fetching Bedrock costs:", err);
            return res.status(403).json({
                success: false,
                message: err.message || "Failed to fetch Bedrock costs",
                errorType: err.name || "Unknown Error",
                details: err.message && err.message.includes("is not authorized")
                    ? {
                        error: err.message,
                        hint: "IAM permissions required for ce:GetCostAndUsage",
                        requiredPermissions: ["ce:GetCostAndUsage"]
                    }
                    : null
            });
        }
    }
}
