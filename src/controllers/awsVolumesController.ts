import express from "express";
import { AWSVolumesService } from "../services/awsVolumesService";

export class AwsVolumesController {
    static async getVolumes(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const data = await AWSVolumesService.getAllEBSVolumes(keyId);
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

}