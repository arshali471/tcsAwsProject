import awsKeysModel from "../../models/awsKeys.model";

export class AWSKeyDao {
    static async createAWSKey(payload: any) {
        return await awsKeysModel.create(payload); 
    }

    static async getAllAWSKey() {
        return await awsKeysModel.find(); 
    }

    static async getAWSKeyById(keyId: any) {
        return await awsKeysModel.findById({_id: keyId}); 
    }
}