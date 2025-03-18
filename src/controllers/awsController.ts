import express from "express";
import { DateTime } from "luxon";
import { S3BucketService } from "../services/awsS3Service";
import { EC2InstanceService } from "../services/awsEC2Service";
import { AWSStatusCheckService } from "../services/awsEC2StatusCheckService";
import { AWSKeyService } from "../services";


export class AwsController {
    static async getAllInstance(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const query = String(req.query.query) || req.query;
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const environment = String(awsConfig.enviroment);
            if (query === "api") {
                const data = await EC2InstanceService.getAllInstanceDetails(keyId);
                return res.status(200).json({data, message: "Data fetched from API"});
            } else if (query === "db") {
                const date = String(req.query.date);

                const data = await EC2InstanceService.getInstancesByDate(date, environment);
                return res.status(200).json({data, message: "Data fetched from DB"});
            } else if (query === "api-save-db") {
                const data = await EC2InstanceService.getAllInstanceDetails(keyId);
                // return res.status(200).json({data, message: "Data fetched from API"});
                const enviromentData = data.map((item: any) => {
                    return {
                        ...item,
                        environment: environment
                    }
                })
                console.log(enviromentData.environment, environment , "enviroment")

                const saveData = await EC2InstanceService.saveInstanceDetails(enviromentData, environment);
                return res.status(200).json({data: saveData, message: "Fetched from API and Data saved to DB"});
            }

            res.status(200).json("please provide valide query");
        } catch (err) {
            next(err);
        }
    }

    static async getInstanceDetailsByInstanceId(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const instanceId = req.params.instanceId;
            const data = await EC2InstanceService.getInstanceDetailsByInstanceId(instanceId, keyId);
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

    static async getS3Bucket(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            await S3BucketService.getBucketDetails(keyId)
                .then((bucketDetails: any) => {
                    const formattedDetails = bucketDetails.map((bucket: any) => ({
                        ...bucket,
                        creationDate: bucket.creationDate ? DateTime.fromJSDate(bucket.creationDate).toISODate() : 'Unknown',
                        size: `${(bucket.size / 1024 / 1024 / 1024).toFixed(2)} GB` // Convert bytes to GB
                    }));
                    res.send(formattedDetails);
                })
                .catch(err => {
                    console.error(err);
                    next(err);
                });
        } catch (err) {
            next(err);
        }
    }


    static async getZabbixStatus(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const data = await AWSStatusCheckService.checkNginxStatusOnLinuxInstances(keyId);
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }
}   