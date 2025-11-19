import statusRecordModel from "../../models/statusRecord.model";


export class StatusRecordDao {
    static async addStatusRecord(statusRecord: any) {
        return await statusRecordModel.create(statusRecord);
    }

    static async getZabbixStatusFromDB(keyId: any, startDate: any, endDate: any, operatingSystem: any) {
        // Replace space with "+" to fix malformed timezone offset
        const sanitizeDate = (dateStr: string) => dateStr?.replace(" ", "+");

        const sanitizedStartDate = sanitizeDate(startDate);
        const sanitizedEndDate = sanitizeDate(endDate);

        const start = new Date(sanitizedStartDate);
        const end = new Date(sanitizedEndDate);

        // Defensive check for date validity
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error(`Invalid startDate or endDate. Received: startDate=${startDate}, endDate=${endDate}`);
        }

        // Fetch matching records from DB
        return await statusRecordModel.find({
            awsKeyId: keyId,
            os: { $regex: operatingSystem, $options: "i" },
            createdAt: {
                $gte: start,
                $lte: end
            },
        }).sort({ createdAt: -1 });
    }

    /**
     * Get all latest agent status records for a specific AWS key
     * Returns the most recent status for each instance
     * Supports optional date range filtering
     */
    static async getAllLatestAgentStatus(keyId: any, startDate?: string, endDate?: string) {
        const matchQuery: any = { awsKeyId: keyId };

        // Add date range filter if provided
        if (startDate && endDate) {
            const sanitizeDate = (dateStr: string) => dateStr?.replace(" ", "+");
            const start = new Date(sanitizeDate(startDate));
            const end = new Date(sanitizeDate(endDate));

            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                matchQuery.createdAt = {
                    $gte: start,
                    $lte: end
                };
            }
        }

        // Get the latest status for each unique instance
        const latestRecords = await statusRecordModel.aggregate([
            { $match: matchQuery },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$instanceId",
                    latestRecord: { $first: "$$ROOT" }
                }
            },
            { $replaceRoot: { newRoot: "$latestRecord" } },
            { $sort: { instanceName: 1 } }
        ]);

        return latestRecords;
    }

    /**
     * Get dashboard statistics for agent status
     * Supports optional date range filtering
     */
    static async getAgentStatusDashboardStats(keyId: any, startDate?: string, endDate?: string) {
        const latestRecords = await this.getAllLatestAgentStatus(keyId, startDate, endDate);

        const stats = {
            totalServers: latestRecords.length,
            zabbixAgent: {
                active: 0,
                inactive: 0,
                total: 0
            },
            crowdStrike: {
                active: 0,
                inactive: 0,
                total: 0
            },
            qualys: {
                active: 0,
                inactive: 0,
                total: 0
            },
            cloudWatch: {
                active: 0,
                inactive: 0,
                total: 0
            },
            alloy: {
                active: 0,
                inactive: 0,
                total: 0
            },
            byOS: {} as any,
            byState: {} as any
        };

        latestRecords.forEach((record: any) => {
            // Count by agent status
            if (record.services?.zabbixAgent === "active") stats.zabbixAgent.active++;
            else stats.zabbixAgent.inactive++;
            stats.zabbixAgent.total++;

            if (record.services?.crowdStrike === "active") stats.crowdStrike.active++;
            else stats.crowdStrike.inactive++;
            stats.crowdStrike.total++;

            if (record.services?.qualys === "active") stats.qualys.active++;
            else stats.qualys.inactive++;
            stats.qualys.total++;

            if (record.services?.cloudWatch === "active") stats.cloudWatch.active++;
            else stats.cloudWatch.inactive++;
            stats.cloudWatch.total++;

            if (record.services?.alloy === "active") stats.alloy.active++;
            else stats.alloy.inactive++;
            stats.alloy.total++;

            // Count by OS
            const os = record.os || "Unknown";
            if (!stats.byOS[os]) stats.byOS[os] = 0;
            stats.byOS[os]++;

            // Count by state
            const state = record.state || "Unknown";
            if (!stats.byState[state]) stats.byState[state] = 0;
            stats.byState[state]++;
        });

        return {
            stats,
            records: latestRecords
        };
    }
}