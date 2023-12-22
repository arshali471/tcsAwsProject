import express from "express";
import { AWSKeyService } from "../services/awsKeyService";


export class AwsKeyController {
    static async createAWSKey(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const user = req.user; 
            if (!user.addAWSKey) {
                return res.status(400).send("User not allowed to add AWS Key.")
            }
            
            const keyData = req.body; 

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

    
}   