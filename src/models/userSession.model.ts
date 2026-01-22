import { Schema, model, Document } from "mongoose";

export interface IUserSession extends Document {
    userId: Schema.Types.ObjectId;
    username: string;
    email: string;
    token: string;
    tokenHash: string; // Store hashed version for security
    ipAddress: string;
    userAgent: string;
    deviceType: string; // mobile, desktop, tablet
    browser: string;
    os: string;
    location?: {
        country?: string;
        city?: string;
        region?: string;
        timezone?: string;
    };
    isActive: boolean;
    loginTime: Date;
    lastActivityTime: Date;
    logoutTime?: Date;
    expiresAt: Date;
    sessionDuration?: number; // in seconds
}

const UserSessionSchema = new Schema<IUserSession>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false // Optional since some users may not have email (e.g., username-only accounts)
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    tokenHash: {
        type: String,
        required: true,
        index: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    deviceType: {
        type: String,
        enum: ['mobile', 'desktop', 'tablet', 'unknown'],
        default: 'unknown'
    },
    browser: {
        type: String,
        default: 'unknown'
    },
    os: {
        type: String,
        default: 'unknown'
    },
    location: {
        country: String,
        city: String,
        region: String,
        timezone: String
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    loginTime: {
        type: Date,
        required: true,
        default: Date.now
    },
    lastActivityTime: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    logoutTime: {
        type: Date
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    sessionDuration: {
        type: Number // in seconds
    }
}, {
    timestamps: true,
    collection: 'userSessions'
});

// Compound indexes for efficient queries
UserSessionSchema.index({ userId: 1, isActive: 1 });
UserSessionSchema.index({ isActive: 1, expiresAt: 1 });
UserSessionSchema.index({ tokenHash: 1, isActive: 1 });

// TTL index to automatically delete old inactive sessions after 90 days
UserSessionSchema.index({ logoutTime: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60, partialFilterExpression: { isActive: false } });

export default model<IUserSession>('UserSession', UserSessionSchema);
