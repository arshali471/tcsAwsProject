import express from "express";
import { AWSKeyService, EC2InstanceService } from "../services";
import { CronJobExecutionStatusService } from "../services/cronjobService";
import { AWSStatusCheckService } from "../services/awsEC2StatusCheckService";
import { CONFIG } from "../config/environment";

export class CronController {
    // static async getAllInstance(req?: express.Request, res?: express.Response, next?: express.NextFunction) {
    //     try {
    //         const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
    //         console.log("starting cron job to fetch instance data...");

    //         for (let key of awsConfig) {
    //             const keyId = key._id;
    //             const environment = String(key.enviroment);

    //             const data = await EC2InstanceService.getAllInstanceDetails(keyId);
    //             const enviromentData = data.map((item: any) => ({
    //                 ...item,
    //                 environment: environment,
    //             }));

    //             const saveData = await EC2InstanceService.saveInstanceDetails(enviromentData, environment);
    //             if (!saveData) {
    //                 console.error(`❌ Error saving data for environment: ${environment}`);
    //                 if (res) return res.status(500).json({ message: "Error saving data to DB" });
    //             } else {
    //                 console.log(`✅ Data saved for environment: ${environment}`);
    //             }

    //             // Wait for 5 minutes (300,000 milliseconds)
    //             await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    //         }

    //         if (res) {
    //             return res.status(200).json({
    //                 message: "Instance Data fetched from AWS and saved to DB",
    //             });
    //         }

    //     } catch (err) {
    //         console.error("❌ Error in CronController.getAllInstance:", err);
    //         if (next) next(err);
    //     }
    // }

    static async getAllInstance(req?: express.Request, res?: express.Response, next?: express.NextFunction) {
        try {
            const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
            console.log("🕒 Starting cron job to fetch instance data...");

            for (const key of awsConfig) {
                const keyId = key._id;
                const environment = String(key.enviroment);
                console.log(environment, keyId, "keyId");

                const data = await EC2InstanceService.getAllInstanceDetails(keyId);
                const environmentData = data.map((item: any) => ({
                    ...item,
                    environment,
                }));

                const saveData = await EC2InstanceService.saveInstanceDetails(environmentData, environment);

                if (!saveData) {
                    console.error(`❌ Error saving data for environment: ${environment}`);
                    if (res) return res.status(500).json({ message: "Error saving data to DB" });
                } else {
                    console.log(`✅ ${saveData.length} records saved for environment: ${environment}`);
                }

                const cronJobStatus = {
                    jobName: "getAllInstance",
                    environment,
                    resourceCount: saveData.length,
                    status: saveData ? "success" : "failed",
                    startTime: new Date(),
                    endTime: new Date(),
                    error: saveData ? null : "Error saving data to DB",
                };

                await CronJobExecutionStatusService.create(cronJobStatus);

                // Wait for 2 minutes before next environment
                await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
            }

            if (res) {
                return res.status(200).json({
                    message: "Instance data fetched from AWS and saved to DB successfully.",
                });
            }

        } catch (err) {
            console.error("❌ Error in CronController.getAllInstance:", err);
            if (next) next(err);
        }
    }


    static async getAllAgentStatus(req?: express.Request, res?: express.Response, next?: express.NextFunction) {
        try {
            const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
            console.log("🕒 Starting cron job to fetch agent status...");
            const masterKey: any = CONFIG.masterKey;
            if (!masterKey) {
                console.error("❌ Master key is not defined in the environment variables.");
                if (res) return res.status(500).json({ message: "Master key is not defined." });
            }

            for (const key of awsConfig) {
                const keyId = key._id;
                const environment = String(key.enviroment);
                console.log(environment, keyId, "keyId");

                let sshUsernames = [
                    "awx",
                    "centos",
                    "ec2-user",
                    "ubuntu",
                ]

                const operatingSystems: any = {
                    "awx": "rocky",
                    "centos": "centos",
                    "ec2-user": "amazon linux",
                    "ubuntu": "ubuntu",
                }

                for (let sshUsername of sshUsernames) {
                    try {
                        console.log(`🔍 Checking Nginx status for ${sshUsername} in environment: ${environment}`);

                        const operatingSystem = operatingSystems[sshUsername] || "unknown";
                        const data: any = await AWSStatusCheckService.getAllInstanceDetailsWithNginxStatus(keyId, sshUsername, masterKey, operatingSystem);



                        const cronJobStatus = {
                            jobName: "getAllAgentStatus",
                            environment,
                            resourceCount: data.length,
                            status: data.success ? "success" : "failed",
                            startTime: new Date(),
                            endTime: new Date(),
                            error: data.success ? null : data.message || "Error fetching data from AWS",
                        };

                        await CronJobExecutionStatusService.create(cronJobStatus);
                        if (!data.success) {
                            console.error(`❌ Error fetching data for environment: ${environment}`);
                            if (res) return res.status(500).json({ message: "Error fetching data from AWS" });
                        } else {
                            console.log(`✅ Data fetched for environment: ${environment}`);
                        }

                    } catch (err) {
                        console.error(`❌ Error checking Nginx status for ${sshUsername} in environment: ${environment}`, err);
                        if (res) return res.status(500).json({ message: `Error checking Nginx status for ${sshUsername} in environment: ${environment}` });
                    }
                }

                // Wait for 2 minutes before next environment
                await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
            }

            if (res) {
                return res.status(200).json({
                    message: "Instance data fetched from AWS and saved to DB successfully.",
                });
            }

        } catch (err) {
            console.error("❌ Error in CronController.getAllInstance:", err);
            if (next) next(err);
        }
    }
}
