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

    static async addEKSToken(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const {keyId, token, clusterName, dashboardUrl } = req.body;
            const data = await AWSEKSService.addEKSToken({awsKeyId: keyId, token, clusterName, dashboardUrl, createdBy: req.user.id});
            if (!data) {
                return res.status(404).send("EKS token not created.")
            }
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

    static async updateEKSToken(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const id = req.params.id;
            const {keyId, token, clusterName, dashboardUrl } = req.body;
            const data = await AWSEKSService.updateEKSToken(id, {awsKeyId: keyId, token, clusterName, dashboardUrl, updatedBy: req.user.id});
            if (!data) {
                return res.status(404).send("EKS token not updated.")
            }
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

    static async deleteEKSToken(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const id = req.params.id;
            const data = await AWSEKSService.deleteEKSToken(id);
            if (!data) {
                return res.status(404).send("EKS token not deleted.")
            }
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

}