import { Schema, model, Document } from "mongoose";

export interface ISSHKey extends Document {
    sshKeyName: string
    sshkey: string
    createdBy: Schema.Types.ObjectId; 
    updatedBy: Schema.Types.ObjectId;
}

const SSHKeySchema = new Schema<ISSHKey>({
    sshKeyName: {
        type: String,
        required: true
    },
    sshkey: {
        type: String,
        required: true
    },
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
        collection: "sshKey"
    }
);

export default model<ISSHKey>("sshKey", SSHKeySchema)