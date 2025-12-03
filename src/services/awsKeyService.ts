import { AWSKeyDao } from "../lib/dao/awsKey.dao"
import { throwError } from "../util/util";
import { encryptAWSCredentials } from "../util/crypto.util";


export class AWSKeyService {
    static async createAWSKey(payload: any) {
        return await AWSKeyDao.createAWSKey(payload);
    }

    static async getAllAWSKey() {
        return await AWSKeyDao.getAllAWSKey();
    }

    static async getAWSKeyById(keyId: any) {
        const keyData: any = await AWSKeyDao.getAWSKeyById(keyId);
        if (!keyData) {
            throwError("no key found", 404);
        }

        // Return AWS config in format expected by AWS SDK clients
        const awsConfig: any = {
            region: keyData.region,
            credentials: {
                accessKeyId: keyData.accessKeyId,
                secretAccessKey: keyData.secretAccessKey
            },
            enviroment: keyData.enviroment
        };
        return awsConfig;
    } 

    static async updateApiKey(payload: any, id: any) {
        return await AWSKeyDao.updateApiKey(payload, id); 
    }

    static async deleteAWSKey(id: any) {
        return await AWSKeyDao.deleteAWSKey(id); 
    }

    static async getAllAWSKeyId() {
        return await AWSKeyDao.getAllAWSKeyId();
    }
}


