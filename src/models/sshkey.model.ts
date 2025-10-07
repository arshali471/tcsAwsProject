import { Schema, model, Document } from "mongoose";
import mongooseEncryption from "mongoose-encryption";
import { CONFIG } from "../config/environment"; // Must include `encKey` and `sigKey`

const encKey = CONFIG.encKey;
const sigKey = CONFIG.sigKey;

if (!encKey || !sigKey) {
    throw new Error("ENCRYPTION_SECRET and SIGNING_SECRET must be set");
}

export interface ISSHKey extends Document {
    sshKeyHash: string;
    sshKeyName: string;
    sshkey: string;
    createdBy: Schema.Types.ObjectId;
    updatedBy: Schema.Types.ObjectId;
}

const SSHKeySchema = new Schema<ISSHKey>({
    sshKeyHash: {
        type: String,
        required: true
    },
    sshKeyName: {
        type: String,
        required: true,
    },
    sshkey: {
        type: String,
        required: true,
    },
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
    collection: "sshKey"
});

// 🔐 Encrypt all fields except _id
SSHKeySchema.plugin(mongooseEncryption, {
    encryptionKey: Buffer.from(encKey, "base64"),
    signingKey: Buffer.from(sigKey, "base64"),
    encryptedFields: [
        "sshKeyName",
        "sshkey",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
    ],
    excludeFromEncryption: ["_id", "sshKeyHash"]
});

export default model<ISSHKey>("sshKey", SSHKeySchema);
