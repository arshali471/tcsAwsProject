import awsKeysModel from "../../models/awsKeys.model";

export class AWSKeyDao {
    static async createAWSKey(payload: any) {
        return await awsKeysModel.create(payload);
    }

    static async getAllAWSKey() {
        return await awsKeysModel.find({}).populate("createdBy updatedBy", "username");
    }

    static async getAWSKeyById(keyId: any) {
        return await awsKeysModel.findById({ _id: keyId });
    }

    static async updateApiKey(payload: any, id: any) {
        return await awsKeysModel.findByIdAndUpdate({ _id: id }, {
            $set: payload
        }, { new: true })
    }

    static async deleteAWSKey(id: any) {
        return await awsKeysModel.findByIdAndDelete({_id: id}); 
    }
}