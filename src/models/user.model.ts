import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
    email: string
    phone: string
    username: string
    password: string
    isActive: boolean
    admin: boolean
    addUser: boolean
    addAWSKey: boolean
    addDocument: boolean
    // SSO fields
    ssoProvider?: 'azure' | 'local'
    azureOid?: string
    displayName?: string
    department?: string
    jobTitle?: string
    lastLogin?: Date
    lastLogout?: Date
}

const UserSchema = new Schema<IUser>({
    email: String,
    phone: String,
    username: String,
    password: { type: String, required: false },
    isActive: {
        type: Boolean,
        default: true
    },
    admin: {
        type: Boolean,
        default: false
    },
    addUser: {
        type: Boolean,
        default: false
    },
    addAWSKey: {
        type: Boolean,
        default: false
    },
    addDocument: {
        type: Boolean,
        default: false
    },
    // SSO fields
    ssoProvider: {
        type: String,
        enum: ['azure', 'local'],
        default: 'local'
    },
    azureOid: {
        type: String,
        sparse: true,
        unique: true
    },
    displayName: String,
    department: String,
    jobTitle: String,
    lastLogin: Date,
    lastLogout: Date
},
    {
        versionKey: false,
        timestamps: true,
        collection: "user"
    }
);

// Add indexes for SSO
UserSchema.index({ ssoProvider: 1, azureOid: 1 });
UserSchema.index({ email: 1 });

export default model<IUser>("user", UserSchema)