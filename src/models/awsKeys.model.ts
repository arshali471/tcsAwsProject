import { Schema, model, Document } from "mongoose";
import { AWSRegionEnum } from "../lib/enum/awsRegion.enum";

export interface IAWSKey extends Document {
    region: AWSRegionEnum,
    accessKeyId: string
    secretAccessKey: string
    enviroment: string
    createdBy: Schema.Types.ObjectId; 
    updatedBy: Schema.Types.ObjectId; 
}

const AWSKeySchema = new Schema<IAWSKey>({
    region: {
        type: String,
        enum: AWSRegionEnum
    }, 
    accessKeyId: String, 
    secretAccessKey: String, 
    enviroment: String, 
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
        collection: "awsKey"
    }
);

export default model<IAWSKey>("awsKey", AWSKeySchema)