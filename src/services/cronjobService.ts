import { CronJobExecutionStatusDao } from "../lib/dao/cronjob.dao";


export class CronJobExecutionStatusService {
    static async create(cronJobStatus: any) {
        return await CronJobExecutionStatusDao.create(cronJobStatus);
    }
}