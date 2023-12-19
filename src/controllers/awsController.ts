import express from "express";
import { DateTime } from "luxon";
import { S3BucketService } from "../services/awsS3Service";
import { EC2InstanceService } from "../services/awsEC2Service";


export class AwsController {
    static async getAllInstance(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId; 
            const data = await EC2InstanceService.getAllInstanceDetails(keyId); 
            res.status(200).json(data);
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
            await S3BucketService.getBucketDetails().then((bucketDetails: any) => {
                const formattedDetails = bucketDetails.map((bucket: any) => ({
                    ...bucket,
                    creationDate: bucket.creationDate ? DateTime.fromJSDate(bucket.creationDate).toISODate() : 'Unknown',
                    size: `${(bucket.size / 1024 / 1024).toFixed(2)} MB` // Convert bytes to MB
                }));
                res.send(formattedDetails); 
            }).catch(err => {
                console.error(err);
            });
        } catch (err) {
            next(err);
        }
    }
}   