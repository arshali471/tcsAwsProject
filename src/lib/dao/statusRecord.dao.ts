import statusRecordModel from "../../models/statusRecord.model";


export class StatusRecordDao {
    static async addStatusRecord(statusRecord: any) {
        return await statusRecordModel.create(statusRecord);
    }
}