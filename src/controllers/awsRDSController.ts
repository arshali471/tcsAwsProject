import express from "express";
import { AWSRDSService } from "../services/awsRDSService";

export class AwsRDSController {

    static async getRdsInstances(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const data = await AWSRDSService.getRDSInstances(keyId);
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

}