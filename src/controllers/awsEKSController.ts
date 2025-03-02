import express from "express";
import { AWSEKSService } from "../services/awsEKSService";

export class AwsEKSController {
    static async getEksCluster(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const data = await AWSEKSService.getAllEKSClusterDetails(keyId);
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

}