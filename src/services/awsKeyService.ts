import { AWSKeyDao } from "../lib/dao/awsKey.dao"
import { throwError } from "../util/util";


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

        const awsConfig: any = {
            region: keyData.region,
            credentials: {
                accessKeyId: keyData.accessKeyId, // Replace with your access key id
                secretAccessKey: keyData.secretAccessKey // Replace with your secret access key
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
}


