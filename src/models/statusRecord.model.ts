import { Schema, model, Document } from "mongoose";
import { IAWSKey } from "./awsKeys.model";

export interface IServiceStatus {
    zabbixAgent: string;
    crowdStrike: string;
    qualys: string;
    cloudWatch: string;
}

export interface IVersionStatus {
    zabbixAgent: string;
    crowdStrike: string;
    qualys: string;
    cloudWatch: string;
}

export interface IStatusRecord extends Document {
    awsKeyId: Schema.Types.ObjectId | IAWSKey;
    instanceName: string;
    instanceId: string;
    ip: string;
    os: string;
    platform: string;
    state: string;
    services: IServiceStatus;
    versions: IVersionStatus;
    error: string | null;
}

// ⚡ No need to type generic here for nested schemas!
const ServiceStatusSchema = new Schema({
    zabbixAgent: { type: String, default: "inactive" },
    crowdStrike: { type: String, default: "inactive" },
    qualys: { type: String, default: "inactive" },
    cloudWatch: { type: String, default: "inactive" },
}, { _id: false });

const VersionStatusSchema = new Schema({
    zabbixAgent: { type: String, default: "N/A" },
    crowdStrike: { type: String, default: "N/A" },
    qualys: { type: String, default: "N/A" },
    cloudWatch: { type: String, default: "N/A" },
}, { _id: false });

const statusRecordSchema = new Schema<IStatusRecord>({
    awsKeyId: {
        type: Schema.Types.ObjectId,
        ref: "awsKey"
    },
    instanceName: { type: String },
    instanceId: { type: String },
    ip: { type: String, default: "N/A" },
    os: { type: String },
    platform: { type: String },
    state: { type: String },
    services: { type: ServiceStatusSchema, default: {} },
    versions: { type: VersionStatusSchema, default: {} },
    error: { type: String, default: null },
},
{
    versionKey: false,
    timestamps: true,
    collection: "statusRecord"
});

export default model<IStatusRecord>("statusRecord", statusRecordSchema);


