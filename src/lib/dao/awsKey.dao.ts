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
        return await awsKeysModel.findByIdAndUpdate({ _id: id }, {
            $set: payload
        }, { new: true })
    }

    static async deleteAWSKey(id: any) {
        return await awsKeysModel.findByIdAndDelete({ _id: id });
    }

    static async getAllAWSKeyId() {
        return await awsKeysModel.find({}, "_id enviroment");
    }
}