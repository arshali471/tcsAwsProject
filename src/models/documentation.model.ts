import { Schema, model, Document } from "mongoose";

export interface IDocumentation extends Document {
    title: string;
    description?: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
    category?: string;
    uploadedBy: string;
    tags?: string[];
    documentType: 'file' | 'link'; // 'file' for uploaded files, 'link' for external URLs
    visibility: 'public' | 'private'; // 'public' = visible to all, 'private' = only shared users
    sharedWith?: Array<{ email: string; permission: 'view' | 'edit'; sharedAt: Date; }>;
    createdAt: Date;
    updatedAt: Date;
}

const documentationSchema = new Schema<IDocumentation>({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    fileName: {
        type: String,
        required: false
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: false,
        default: 0
    },
    fileType: {
        type: String,
        required: false,
        default: 'link'
    },
    documentType: {
        type: String,
        enum: ['file', 'link'],
        default: 'file'
    },
    visibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
    },
    category: {
        type: String,
        default: "General"
    },
    uploadedBy: {
        type: String,
        required: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    sharedWith: [{
        email: {
            type: String,
            required: true,
            trim: true
        },
        permission: {
            type: String,
            enum: ['view', 'edit'],
            default: 'view'
        },
        sharedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true,
    collection: "documentation"
});

// Index for search
documentationSchema.index({ title: 'text', description: 'text', tags: 'text' });

export default model<IDocumentation>("documentation", documentationSchema);
