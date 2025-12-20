import awsKeysModel from "../../models/awsKeys.model";

export class AWSKeyDao {
    static async createAWSKey(payload: any) {
        return await awsKeysModel.create(payload);
    }

    static async getAllAWSKey() {
        // Step 1: Fetch all documents without projection
        let data: any = await awsKeysModel.find({});

        // Step 2: Populate createdBy and updatedBy with username
        data = await awsKeysModel.populate(data, [
            { path: "createdBy", select: "username" },
            { path: "updatedBy", select: "username" }
        ]);

        // Step 3: Remove secretAccessKey manually
        data = data.map((doc: any) => {
            const obj = doc.toObject();
            delete obj.secretAccessKey;
            return obj;
        });

        return data;
    }


    static async getAWSKeyById(keyId: any) {
        return await awsKeysModel.findById({ _id: keyId });
    }

    static async getAWSKeyAccessKeyById(keyId: any) {
        return await awsKeysModel.findById({ _id: keyId }, "-secretAccessKey");
    }

    static async updateApiKey(payload: any, id: any) {
        // For encrypted models, we need to fetch, modify, and save to ensure proper encryption
        const awsKey = await awsKeysModel.findById(id);
        if (!awsKey) {
            return null;
        }

        // Update only the provided fields
        Object.keys(payload).forEach(key => {
            (awsKey as any)[key] = payload[key];
        });

        // Save will trigger mongoose-encryption to re-encrypt all fields
        const savedKey = await awsKey.save();
        return savedKey;
    }

    static async deleteAWSKey(id: any) {
        return await awsKeysModel.findByIdAndDelete({ _id: id });
    }

    static async getAllAWSKeyId() {
        return await awsKeysModel.find({}, "-secretAccessKey  -createdAt -updatedAt -createdBy -updatedBy -accessKeyId");
    }

    /**
     * Get all AWS keys WITH credentials (for internal service use only)
     * Returns decrypted accessKeyId and secretAccessKey
     */
    static async getAllAWSKeyWithCredentials() {
        return await awsKeysModel.find({});
    }
}