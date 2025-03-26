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

    static async getEksClusterName(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const id = req.params.id;
            const data = await AWSEKSService.getAllEKSClusterName(id);
            if (!data) {
                return res.status(404).send("EKS cluster not found.")
            }
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

    static async addEKSToken(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { keyId, token, clusterName, dashboardUrl, monitoringUrl } = req.body;
            const data = await AWSEKSService.addEKSToken({ awsKeyId: keyId, token, clusterName, dashboardUrl, createdBy: req.user.id, monitoringUrl });
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
            const { keyId, token, clusterName, dashboardUrl, monitoringUrl } = req.body;
            const data = await AWSEKSService.updateEKSToken(id, { awsKeyId: keyId, token, clusterName, dashboardUrl, monitoringUrl, updatedBy: req.user.id });
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

    static async getEKSTokenById(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const id = req.params.id;
            const data = await AWSEKSService.getEKSTokenById(id);
            if (!data) {
                return res.status(404).send("EKS token not found.")
            }
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

    static async getEKSTokenByAWSKey(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const data = await AWSEKSService.getEKSTokenByAWSKey(keyId);
            if (!data) {
                return res.status(404).send("EKS token not found.")
            }
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

    static async getAllEKSToken(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const pageNumber = req.query.pageNumber ? parseInt(req.query.pageNumber as string) : 1;
            const pageSize = req.query.count ? parseInt(req.query.count as string) : 20;
            const skip = Math.max(pageSize * (pageNumber - 1), 0);
            const search = req.query.search ? req.query.search as string : "";
            const filter = req.query.filter ? req.query.filter as string : "";
            const data = await AWSEKSService.getAllEKSToken({search, filter}, skip, pageSize);
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

}