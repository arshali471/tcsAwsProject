import express from "express";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { DateTime } from "luxon";
import { CONFIG } from "../config/environment";
import { S3BucketService } from "../services/awsS3Service";
import { EC2InstanceService } from "../services/awsEC2Service";


export class AwsController {
    static async getAllInstance(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const data = await EC2InstanceService.getAllInstanceDetails(); 
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

    static async getInstanceDetailsByInstanceId(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const instanceId = req.params.instanceId; 
            const data = await EC2InstanceService.getInstanceDetailsByInstanceId(instanceId); 
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

    static async getS3Bucket(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {

            // Call the function and log the results
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