import { CronJobExecutionStatus } from "../../models/cron.model";



export class CronJobExecutionStatusDao {
    static async create(cronJobStatus: any) {
        if (!cronJobStatus || !cronJobStatus.jobName || !cronJobStatus.environment) {
            throw new Error("Invalid cron job status data");
        }

        const cronJobExecutionStatus = new CronJobExecutionStatus({
            jobName: cronJobStatus.jobName,
            environment: cronJobStatus.environment,
            resourceCount: cronJobStatus.resourceCount || 0, // Default to 0 if not provided
            status: cronJobStatus.status,
            startTime: cronJobStatus.startTime,
            endTime: cronJobStatus.endTime,
            error: cronJobStatus.error
        });

        return await cronJobExecutionStatus.save();
    }
}