import express from "express";
import { DateTime } from "luxon";
import { S3BucketService } from "../services/awsS3Service";
import { EC2InstanceService } from "../services/awsEC2Service";
import { AWSStatusCheckService } from "../services/awsEC2StatusCheckService";
import { AWSKeyService } from "../services";
import { start } from "repl";


export class AwsController {
    static async getAllInstance(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const query = String(req.query.query) || req.query;
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const environment = String(awsConfig.enviroment);
            if (query === "api") {
                const data = await EC2InstanceService.getAllInstanceDetails(keyId);
                return res.status(200).json({ data, message: "Data fetched from API" });
            } else if (query === "db") {
                const date = String(req.query.date);

                const data = await EC2InstanceService.getInstancesByDate(date, environment);
                return res.status(200).json({ data, message: "Data fetched from DB" });
            } else if (query === "api-save-db") {
                const data = await EC2InstanceService.getAllInstanceDetails(keyId);
                // return res.status(200).json({data, message: "Data fetched from API"});
                const enviromentData: any = data.map((item: any) => {
                    return {
                        ...item,
                        environment: environment
                    }
                })
                console.log(enviromentData.environment, environment, "enviroment")

                const saveData = await EC2InstanceService.saveInstanceDetails(enviromentData, environment);
                return res.status(200).json({ data: saveData, message: "Fetched from API and Data saved to DB" });
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
            const { startDate, endDate } = req.query;


            const { sshUsername, sshKeyPath, operatingSystem }: any = req.query;
            if (!sshUsername || !sshKeyPath || !operatingSystem) {
                return res.status(400).json({ message: "Please provide sshUsername, sshKeyPath and operatingSystem" });
            }
            if (startDate != undefined && endDate != undefined) {
                const data = await AWSStatusCheckService.getZabbixStatusFromDB(keyId, startDate, endDate, operatingSystem);
                if (!data) {
                    return res.status(404).send({ results: data })
                }
                return res.status(200).json({ results: data });
            }

            const data = await AWSStatusCheckService.getAllInstanceDetailsWithNginxStatus(keyId, sshUsername, sshKeyPath, operatingSystem);
            if (data?.error) {
                return res.status(404).send(data)
            }
            res.status(200).json(data);
        } catch (err) {
            next(err);
        }
    }

    // static async getZabbixStatusFromDB(req: express.Request, res: express.Response, next: express.NextFunction) {
    //     try {
    //         const keyId = req.params.keyId;
    //         const { startDate, endDate } = req.query;
    //         if (!startDate || !endDate) {
    //             return res.status(400).json({ message: "Please provide startDate and endDate" });
    //         }
    //         const data = await AWSStatusCheckService.getZabbixStatusFromDB(keyId, startDate, endDate);
    //         if (!data) {
    //             return res.status(404).send(data)
    //         }
    //         res.status(200).json(data);
    //     } catch (err) {
    //         next(err);
    //     }
    // }

    static async getInstanceDetailsByGlobalSearch(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const ip = req.params.ip;
            const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
            const matchedInstances: any[] = [];

            for (const key of awsConfig) {
                const keyId = key._id;
                const environment = String(key.enviroment);

                const data = await EC2InstanceService.getAllInstanceDetails(keyId);
                data.forEach((item: any) => {
                    if (item.PrivateIpAddress === ip || item.PublicIpAddress === ip) {
                        matchedInstances.push({ ...item, environment });
                    }
                });
            }

            if (res) {
                return res.status(200).json({ matchedInstances });
            } else {
                return matchedInstances;
            }

        } catch (err) {
            console.error("❌ Error searching instance by IP:", err);
            if (next) next(err);
        }
    }


}