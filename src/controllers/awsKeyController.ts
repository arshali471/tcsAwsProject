import express from "express";
import { AWSKeyService } from "../services/awsKeyService";
import { AWSRegionEnum } from "../lib/enum/awsRegion.enum";


export class AwsKeyController {
    static async createAWSKey(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const user = req.user; 
            if (!user.addAWSKey) {
                return res.status(400).send("User not allowed to add AWS Key.")
            }
            
            const keyData = req.body; 
            keyData.createdBy = user._id; 

            const createdAwsKey = await AWSKeyService.createAWSKey(keyData); 
            if (!createdAwsKey) {
                return res.status(404).send("AWS Key data not created.")
            }
            res.status(200).send(createdAwsKey);
        } catch (err) {
            next(err);
        }
    }

    static async getAllAWSKey(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const awsKeys = await AWSKeyService.getAllAWSKey();
            res.status(200).send(awsKeys);
        } catch (err) {
            next(err);
        }
    }

    static async updateApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const user = req.user; 
            const id = req.params.id; 
            if (!user.addAWSKey) {
                return res.status(400).send("User not allowed to add AWS Key.")
            }
            
            const keyData = req.body; 
            keyData.updatedBy = user._id; 

            const createdAwsKey = await AWSKeyService.updateApiKey(keyData, id);
            if (!createdAwsKey) {
                return res.status(404).send("AWS Key data not created.")
            }
            res.status(200).send("Key updated successfully.");
        } catch (err) {
            next(err);
        }
    }

    static async deleteApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const id = req.params.id; 
            const user = req.user;
            if (!user.addAWSKey) {
                return res.status(400).send("User not allowed to add AWS Key.")
            }
            const awsKeys = await AWSKeyService.deleteAWSKey(id);
            if (!awsKeys) {
                return res.status(404).send("Key not deleted.")
            } 
            res.status(200).send("key deleted successfully.");
        } catch (err) {
            next(err);
        }
    }

    static async getAWSRegions(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const awsKeys = AWSRegionEnum;  
            res.status(200).send(awsKeys);
        } catch (err) {
            next(err);
        }
    }
    
}   