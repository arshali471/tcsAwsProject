import { Schema, model, Document } from "mongoose";
import { AWSRegionEnum } from "../lib/enum/awsRegion.enum";
import { IAWSKey } from "./awsKeys.model";

export interface IEKSDashboard extends Document {
    awsKeyId: Schema.Types.ObjectId | IAWSKey
    token: string
    clusterName: string
    dashboardUrl: string
    monitoringUrl: string
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
},
    {
        versionKey: false,
        timestamps: true,
        collection: "eksDashboard"
    }
);

export default model<IEKSDashboard>("eksDashboard", EksDashboardSchema)