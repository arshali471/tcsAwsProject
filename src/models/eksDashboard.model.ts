import { Schema, model, Document } from "mongoose";
import mongooseEncryption from "mongoose-encryption";
import { CONFIG } from "../config/environment";
import { IAWSKey } from "./awsKeys.model";

export interface IEKSDashboard extends Document {
    awsKeyId?: Schema.Types.ObjectId | IAWSKey;
    clusterName: string;
    fileName: string;
    ymlFileContent: string;
    createdBy: Schema.Types.ObjectId;
    updatedBy: Schema.Types.ObjectId;
}

const EksDashboardSchema = new Schema<IEKSDashboard>({
    awsKeyId: {
        type: Schema.Types.ObjectId,
        ref: "awsKey"
    },
    clusterName: String,
    fileName: String,
    ymlFileContent: String,
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
    encryptionKey: encKey,
    signingKey: sigKey,
    encryptedFields: [
        "ymlFileContent"
    ],
    excludeFromEncryption: [
        "_id",
        "awsKeyId",
        "clusterName",
        "fileName",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
    ]
});

export default model<IEKSDashboard>("eksDashboard", EksDashboardSchema);
