import { count } from "console";
import { Schema, model, Document } from "mongoose";

export interface ICronJobExecutionStatus extends Document {
    jobName: string;
    environment: string;
    resourceCount: number; // Optional field to track the number of executions
    status: "success" | "failed";
    startTime: Date;
    endTime: Date;
    error?: string;
}

const cronJobExecutionStatusSchema = new Schema<ICronJobExecutionStatus>({
    jobName: { type: String },
    environment: { type: String },
    resourceCount: { type: Number, default: 0 },
    status: { type: String, enum: ["success", "failed"] },
    startTime: { type: Date },
    endTime: { type: Date },
    error: { type: String },
}, {
    versionKey: false,
    timestamps: true,
    collection: "cronJobExecutionStatus"
});

export const CronJobExecutionStatus = model<ICronJobExecutionStatus>("CronJobExecutionStatus", cronJobExecutionStatusSchema);
