import express from "express";
import { AWSEKSService } from "../services/awsEKSService";
import { validateKubeConfigYml } from "../helper/ymlValidator";
import fs from "fs";

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
            const { clusterName } = req.body;

            // Check if cluster name is provided
            if (!clusterName) {
                return res.status(400).send("Cluster name is required");
            }

            // Check if file is uploaded
            if (!req.file) {
                return res.status(400).send("YML file is required");
            }

            // Read the uploaded file content
            const ymlFileContent = fs.readFileSync(req.file.path, 'utf-8');

            // Validate the YML file - must have kind: Config
            try {
                validateKubeConfigYml(ymlFileContent);
            } catch (validationError: any) {
                // Delete the uploaded file if validation fails
                fs.unlinkSync(req.file.path);
                return res.status(400).send(validationError.message);
            }

            // Delete the uploaded file from disk after reading
            fs.unlinkSync(req.file.path);

            const data = await AWSEKSService.addEKSToken({
                clusterName,
                fileName: req.file.originalname,
                ymlFileContent,
                createdBy: req.user.id
            });

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
            const { clusterName } = req.body;

            let updateData: any = {
                updatedBy: req.user.id
            };

            if (clusterName) updateData.clusterName = clusterName;

            // If a new YML file is uploaded
            if (req.file) {
                const ymlFileContent = fs.readFileSync(req.file.path, 'utf-8');

                // Validate the YML file
                try {
                    validateKubeConfigYml(ymlFileContent);
                } catch (validationError: any) {
                    // Delete the uploaded file if validation fails
                    fs.unlinkSync(req.file.path);
                    return res.status(400).send(validationError.message);
                }

                // Delete the uploaded file from disk after reading
                fs.unlinkSync(req.file.path);
                updateData.fileName = req.file.originalname;
                updateData.ymlFileContent = ymlFileContent;
            }

            const data = await AWSEKSService.updateEKSToken(id, updateData);
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

    static async getEKSTokenContent(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const id = req.params.id;
            const data = await AWSEKSService.getEKSTokenById(id);
            if (!data) {
                return res.status(404).send("EKS token not found.")
            }
            // Encode the yml content to base64 to prevent plain text exposure in network tab
            const encodedContent = Buffer.from(data.ymlFileContent).toString('base64');

            res.status(200).json({
                fileName: data.fileName,
                content: encodedContent // Send as base64 encoded
            });
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