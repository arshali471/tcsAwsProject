import { Schema, model, Document } from "mongoose";
import mongooseEncryption from "mongoose-encryption";
import { AWSRegionEnum } from "../lib/enum/awsRegion.enum";
import { CONFIG } from "../config/environment"; // Make sure encKey and sigKey are exported from here

const encKey = CONFIG.encKey;
const sigKey = CONFIG.sigKey;

if (!encKey || !sigKey) {
    throw new Error("ENCRYPTION_SECRET and SIGNING_SECRET must be set");
}

export interface IAWSKey extends Document {
    region: AWSRegionEnum;
    accessKeyId: string;
    secretAccessKey: string;
    enviroment: string;
    createdBy: Schema.Types.ObjectId;
    updatedBy: Schema.Types.ObjectId;
}

const AWSKeySchema = new Schema<IAWSKey>({
    region: {
        type: String,
        enum: AWSRegionEnum,
    },
    accessKeyId: String,
    secretAccessKey: String,
    enviroment: String,
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "user",
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "user",
    },
}, {
    versionKey: false,
    timestamps: true,
    collection: "awsKey"
});

// 🔐 Encrypt all fields except _id
AWSKeySchema.plugin(mongooseEncryption, {
    encryptionKey: Buffer.from(encKey, "base64"),
    signingKey: Buffer.from(sigKey, "base64"),
    encryptedFields: [
        "region",
        "accessKeyId",
        "secretAccessKey",
        "enviroment",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
    ],
    excludeFromEncryption: ["_id"]
});

export default model<IAWSKey>("awsKey", AWSKeySchema);
