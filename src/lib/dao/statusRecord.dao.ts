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
}