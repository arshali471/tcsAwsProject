import { Schema, model, Document } from "mongoose";

export interface IApiLog extends Document {
    method: string;
    endpoint: string;
    statusCode: number;
    responseTime: number;
    userId?: string;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    requestBody?: any;
    responseBody?: any;
    errorMessage?: string;
    createdAt: Date;
}

const ApiLogSchema = new Schema<IApiLog>({
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    endpoint: {
        type: String,
        required: true
    },
    statusCode: {
        type: Number,
        required: true
    },
    responseTime: {
        type: Number,
        required: true
    },
    userId: {
        type: String
    },
    username: {
        type: String
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    requestBody: {
        type: Schema.Types.Mixed
    },
    responseBody: {
        type: Schema.Types.Mixed
    },
    errorMessage: {
        type: String
    }
},
    {
        versionKey: false,
        timestamps: true,
        collection: "apiLogs"
    }
);

// Index for faster querying
ApiLogSchema.index({ createdAt: -1 });
ApiLogSchema.index({ endpoint: 1 });
ApiLogSchema.index({ method: 1 });
ApiLogSchema.index({ statusCode: 1 });
ApiLogSchema.index({ userId: 1 });

export default model<IApiLog>("apiLogs", ApiLogSchema);
