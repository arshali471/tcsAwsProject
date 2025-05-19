import { Schema, model, Document } from "mongoose";
import mongooseEncryption from "mongoose-encryption";
import { AWSRegionEnum } from "../lib/enum/awsRegion.enum";
import { CONFIG } from "../config/environment";
import { IAWSKey } from "./awsKeys.model";

export interface IEKSDashboard extends Document {
    awsKeyId: Schema.Types.ObjectId | IAWSKey;
    token: string;
    clusterName: string;
    dashboardUrl: string;
    monitoringUrl: string;
    createdBy: Schema.Types.ObjectId;
    updatedBy: Schema.Types.ObjectId;
}

const EksDashboardSchema = new Schema<IEKSDashboard>({
    awsKeyId: {
        type: Schema.Types.ObjectId,
        ref: "awsKey"
    },
    token: String,
    clusterName: String,
    dashboardUrl: String,
    monitoringUrl: String,
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "user"
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "user"
    }
}, {
    versionKey: false,
    timestamps: true,
    collection: "eksDashboard"
});

// ✅ Configure encryption
const encKey = CONFIG.encKey;
const sigKey = CONFIG.sigKey;

if (!encKey || !sigKey) {
    throw new Error("ENCRYPTION_SECRET and SIGNING_SECRET must be set");
}

EksDashboardSchema.plugin(mongooseEncryption, {
    encryptionKey: Buffer.from(encKey, "base64"),
    signingKey: Buffer.from(sigKey, "base64"),
    encryptedFields: [
        "token",
        "dashboardUrl",
        "monitoringUrl"
    ],
    excludeFromEncryption: [
        "_id",
        "awsKeyId",
        "clusterName",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
    ]
});

export default model<IEKSDashboard>("eksDashboard", EksDashboardSchema);
