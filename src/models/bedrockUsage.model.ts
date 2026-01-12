import { Schema, model, Document } from "mongoose";

export interface IBedrockUsage extends Document {
    userId: Schema.Types.ObjectId;
    username: string;
    email: string;
    region: string;
    environment: string;
    inferenceProfileId?: string;
    inferenceProfileName?: string;
    modelId: string;
    modelName: string;
    provider: string;
    requestId?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
    latencyMs?: number;
    status: 'success' | 'error' | 'throttled';
    errorMessage?: string;
    metadata?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        stopSequences?: string[];
        [key: string]: any;
    };
    timestamp: Date;
}

const BedrockUsageSchema = new Schema<IBedrockUsage>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        index: true
    },
    region: {
        type: String,
        required: true,
        index: true
    },
    environment: {
        type: String,
        required: true
    },
    inferenceProfileId: {
        type: String,
        index: true
    },
    inferenceProfileName: String,
    modelId: {
        type: String,
        required: true,
        index: true
    },
    modelName: {
        type: String,
        required: true
    },
    provider: {
        type: String,
        required: true,
        index: true
    },
    requestId: String,
    inputTokens: {
        type: Number,
        required: true,
        default: 0
    },
    outputTokens: {
        type: Number,
        required: true,
        default: 0
    },
    totalTokens: {
        type: Number,
        required: true,
        default: 0
    },
    inputCost: {
        type: Number,
        required: true,
        default: 0
    },
    outputCost: {
        type: Number,
        required: true,
        default: 0
    },
    totalCost: {
        type: Number,
        required: true,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    latencyMs: Number,
    status: {
        type: String,
        enum: ['success', 'error', 'throttled'],
        required: true,
        default: 'success'
    },
    errorMessage: String,
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    versionKey: false,
    timestamps: true,
    collection: "bedrockUsage"
});

// Compound indexes for common queries
BedrockUsageSchema.index({ userId: 1, timestamp: -1 });
BedrockUsageSchema.index({ username: 1, timestamp: -1 });
BedrockUsageSchema.index({ region: 1, timestamp: -1 });
BedrockUsageSchema.index({ modelId: 1, timestamp: -1 });
BedrockUsageSchema.index({ inferenceProfileId: 1, timestamp: -1 });
BedrockUsageSchema.index({ timestamp: -1 });

export default model<IBedrockUsage>("bedrockUsage", BedrockUsageSchema);
