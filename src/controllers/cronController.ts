import express from "express";
import { AWSKeyService, EC2InstanceService } from "../services";
import { CronJobExecutionStatusService } from "../services/cronjobService";
import { AWSStatusCheckService } from "../services/awsEC2StatusCheckService";
import { CONFIG } from "../config/environment";

import { Parser } from 'json2csv';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';

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


    // static async getAllAgentStatus(req?: express.Request, res?: express.Response, next?: express.NextFunction) {
    //     try {
    //         const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
    //         console.log("🕒 Starting cron job to fetch agent status...");
    //         const masterKey: any = CONFIG.masterKey;
    //         if (!masterKey) {
    //             console.error("❌ Master key is not defined in the environment variables.");
    //             if (res) return res.status(500).json({ message: "Master key is not defined." });
    //         }

    //         for (const key of awsConfig) {
    //             const keyId = key._id;
    //             const environment = String(key.enviroment);
    //             console.log(environment, keyId, "keyId");

    //             let sshUsernames = [
    //                 "awx",
    //                 "centos",
    //                 "ec2-user",
    //                 "ubuntu",
    //             ]

    //             const operatingSystems: any = {
    //                 "awx": "rocky",
    //                 "centos": "centos",
    //                 "ec2-user": "amazon linux",
    //                 "ubuntu": "ubuntu",
    //             }

    //             for (let sshUsername of sshUsernames) {
    //                 try {
    //                     console.log(`🔍 Checking Nginx status for ${sshUsername} in environment: ${environment}`);

    //                     const operatingSystem = operatingSystems[sshUsername] || "unknown";
    //                     const data: any = await AWSStatusCheckService.getAllInstanceDetailsWithNginxStatus(keyId, sshUsername, masterKey, operatingSystem);



    //                     const cronJobStatus = {
    //                         jobName: "getAllAgentStatus",
    //                         environment,
    //                         resourceCount: data.length,
    //                         status: data.success ? "success" : "failed",
    //                         startTime: new Date(),
    //                         endTime: new Date(),
    //                         error: data.success ? null : data.message || "Error fetching data from AWS",
    //                     };

    //                     await CronJobExecutionStatusService.create(cronJobStatus);
    //                     if (!data.success) {
    //                         console.error(`❌ Error fetching data for environment: ${environment}`);
    //                         if (res) return res.status(500).json({ message: "Error fetching data from AWS" });
    //                     } else {
    //                         console.log(`✅ Data fetched for environment: ${environment}`);
    //                     }

    //                 } catch (err) {
    //                     console.error(`❌ Error checking Nginx status for ${sshUsername} in environment: ${environment}`, err);
    //                     if (res) return res.status(500).json({ message: `Error checking Nginx status for ${sshUsername} in environment: ${environment}` });
    //                 }
    //             }

    //             // Wait for 2 minutes before next environment
    //             await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    //         }

    //         if (res) {
    //             return res.status(200).json({
    //                 message: "Instance data fetched from AWS and saved to DB successfully.",
    //             });
    //         }

    //     } catch (err) {
    //         console.error("❌ Error in CronController.getAllInstance:", err);
    //         if (next) next(err);
    //     }
    // }


    static async getAllAgentStatus(req?: express.Request, res?: express.Response, next?: express.NextFunction) {
        try {
            const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
            console.log("🕒 Starting cron job to fetch agent status...");
            const masterKey: any = CONFIG.masterKey;
            if (!masterKey) {
                console.error("❌ Master key is not defined.");
                if (res) return res.status(500).json({ message: "Master key is not defined." });
            }

            for (const key of awsConfig) {
                const keyId = key._id;
                const environment = String(key.enviroment);
                console.log(environment, keyId, "keyId");

                let sshUsernames = ["awx", "centos", "ec2-user", "ubuntu"];
                const operatingSystems: any = {
                    "awx": ["rocky"],
                    "centos": ["centos"],
                    "ec2-user": ["amazon linux", "suse"],
                    "ubuntu": ["ubuntu"],
                };

                for (let sshUsername of sshUsernames) {
                    const osList = operatingSystems[sshUsername] || ["unknown"];
                    for (let os of osList) {
                        try {
                            console.log(`🔍 Checking Nginx status for ${sshUsername} (${os}) in environment: ${environment}`);
                            const data: any = await AWSStatusCheckService.getAllInstanceDetailsWithNginxStatus(
                                keyId,
                                sshUsername,
                                masterKey,
                                os
                            );

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
                                console.error(`❌ Error fetching data for ${sshUsername} (${os}) in environment: ${environment}`);
                            } else {
                                console.log(`✅ Data fetched for ${sshUsername} (${os}) in environment: ${environment}`);
                            }
                        } catch (err) {
                            console.error(`❌ Error checking Nginx status for ${sshUsername} (${os}) in environment: ${environment}`, err);
                        }
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
            }

            if (res) {
                return res.status(200).json({
                    message: "Instance data fetched from AWS and saved to DB successfully.",
                });
            }

        } catch (err) {
            console.error("❌ Error in CronController.getAllAgentStatus:", err);
            if (next) next(err);
        }
    }




    // static async getAllAgentStatusAndUploadtoS3(req?: express.Request, res?: express.Response, next?: express.NextFunction) {
    //     try {
    //         const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
    //         const masterKey: any = CONFIG.masterKey;
    //         if (!masterKey) {
    //             if (res) return res.status(500).json({ message: "Master key is not defined." });
    //         }

    //         let allData: any[] = [];

    //         for (const key of awsConfig) {
    //             const keyId = key._id;
    //             const environment = String(key.enviroment);
    //             if (environment === "test") {
    //                 continue;
    //             }
    //             console.log(`🕒 Starting cron job to fetch agent status for environment: ${environment} (Key ID: ${keyId})`);
    //             let sshUsernames = ["awx", "centos", "ec2-user", "ubuntu"];
    //             const operatingSystems: any = {
    //                 "awx": ["rocky"],
    //                 "centos": ["centos"],
    //                 "ec2-user": ["amazon linux", "suse"],
    //                 "ubuntu": ["ubuntu"],
    //             };

    //             for (let sshUsername of sshUsernames) {
    //                 const osList = operatingSystems[sshUsername] || ["unknown"];
    //                 for (let os of osList) {
    //                     try {
    //                         const data: any = await AWSStatusCheckService.getAllInstanceDetailsWithNginxStatusToSaveInS3(
    //                             keyId, sshUsername, masterKey, os
    //                         );

    //                         if (data.success) {
    //                             data.data.forEach((instance: any) => {
    //                                 allData.push({ ...instance, environment: data.environment });
    //                             });
    //                         }
    //                     } catch (err) {
    //                         console.error(err);
    //                     }
    //                 }
    //             }
    //             break;
    //             // await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    //         }

    //         const flattenedData = allData.map(item => ({
    //             instanceName: item.instanceName,
    //             instanceId: item.instanceId,
    //             ip: item.ip,
    //             os: item.os,
    //             platform: item.platform,
    //             state: item.state,
    //             zabbixAgentStatus: item.services?.zabbixAgent || 'N/A',
    //             crowdStrikeStatus: item.services?.crowdStrike || 'N/A',
    //             qualysStatus: item.services?.qualys || 'N/A',
    //             cloudWatchStatus: item.services?.cloudWatch || 'N/A',
    //             zabbixAgentVersion: item.versions?.zabbixAgent || 'N/A',
    //             crowdStrikeVersion: item.versions?.crowdStrike || 'N/A',
    //             qualysVersion: item.versions?.qualys || 'N/A',
    //             cloudWatchVersion: item.versions?.cloudWatch || 'N/A',
    //             environment: item.environment || '',
    //             error: item.error || '',
    //         }));

    //         const fields = Object.keys(flattenedData[0] || {});
    //         const parser = new Parser({ fields });
    //         const csv = parser.parse(flattenedData);
    //         const now = new Date();
    //         const formattedDate = now.toLocaleString('en-GB').replace(/[/,: ]/g, '-');
    //         const fileName = `agent_status_${formattedDate}.csv`;
    //         const filePath = CONFIG.agentStatusFolderPath ? path.join(CONFIG.agentStatusFolderPath, fileName) : path.join(__dirname, 'agent-status', fileName);
    //         fs.writeFileSync(filePath, csv);
    //         console.log(`✅ CSV file created at ${filePath}`);

    //         const s3 = new AWS.S3();
    //         const uploadParams = {
    //             Bucket: CONFIG.awsS3BucketName!,
    //             Key: `agent-status-reports/${fileName}`,
    //             Body: fs.createReadStream(filePath)
    //         };

    //         await s3.upload(uploadParams).promise();

    //         if (res) {
    //             // return res.status(200).json({ message: "CSV uploaded to S3 successfully.", s3Key: uploadParams.Key });
    //             return res.status(200).json({ message: "CSV uploaded to S3 successfully." });
    //         }

    //     } catch (err) {
    //         console.error(err);
    //         if (next) next(err);
    //     }
    // }


    static async getAllAgentStatusAndUploadtoS3(req?: express.Request, res?: express.Response, next?: express.NextFunction) {
        try {
            const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
            const masterKey: any = CONFIG.masterKey;
            if (!masterKey) {
                if (res) return res.status(500).json({ message: "Master key is not defined." });
            }

            const s3 = new AWS.S3();

            for (const key of awsConfig) {
                const keyId = key._id;
                const environment = String(key.enviroment);
                if (environment === "test") continue;

                let allData: any[] = [];
                let sshUsernames = ["awx", "centos", "ec2-user", "ubuntu"];
                const operatingSystems: any = {
                    "awx": ["rocky"],
                    "centos": ["centos"],
                    "ec2-user": ["amazon linux", "suse"],
                    "ubuntu": ["ubuntu"],
                };

                for (let sshUsername of sshUsernames) {
                    const osList = operatingSystems[sshUsername] || ["unknown"];
                    for (let os of osList) {
                        try {
                            const data: any = await AWSStatusCheckService.getAllInstanceDetailsWithNginxStatusToSaveInS3(
                                keyId, sshUsername, masterKey, os
                            );

                            if (data.success) {
                                data.data.forEach((instance: any) => {
                                    allData.push({ ...instance, environment: data.environment });
                                });
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }

                const flattenedData = allData.map(item => ({
                    instanceName: item.instanceName,
                    instanceId: item.instanceId,
                    ip: item.ip,
                    os: item.os,
                    platform: item.platform,
                    state: item.state,
                    zabbixAgentStatus: item.services?.zabbixAgent || 'N/A',
                    crowdStrikeStatus: item.services?.crowdStrike || 'N/A',
                    qualysStatus: item.services?.qualys || 'N/A',
                    cloudWatchStatus: item.services?.cloudWatch || 'N/A',
                    zabbixAgentVersion: item.versions?.zabbixAgent || 'N/A',
                    crowdStrikeVersion: item.versions?.crowdStrike || 'N/A',
                    qualysVersion: item.versions?.qualys || 'N/A',
                    cloudWatchVersion: item.versions?.cloudWatch || 'N/A',
                    environment: item.environment || '',
                    error: item.error || '',
                }));

                if (flattenedData.length === 0) continue;

                const fields = Object.keys(flattenedData[0]);
                const parser = new Parser({ fields });
                const csv = parser.parse(flattenedData);

                const now = new Date();
                const formattedDate = now.toLocaleString('en-GB').replace(/[/,: ]/g, '-');
                const fileName = `agent_status_${environment}_${formattedDate}.csv`;
                const filePath = CONFIG.agentStatusFolderPath ? path.join(CONFIG.agentStatusFolderPath, fileName) : path.join(__dirname, 'agent-status', fileName);
                fs.writeFileSync(filePath, csv);

                console.log(`✅ CSV file created for ${environment} at ${filePath}`);

                const uploadParams = {
                    Bucket: CONFIG.awsS3BucketName!,
                    Key: `agent-status-reports/${environment}/${fileName}`,
                    Body: fs.createReadStream(filePath)
                };

                await s3.upload(uploadParams).promise();
                console.log(`✅ CSV uploaded to S3 for environment ${environment}`);
            }

            if (res) {
                return res.status(200).json({ message: "CSV files created and uploaded to S3 successfully." });
            }

        } catch (err) {
            console.error(err);
            if (next) next(err);
        }
    }
}
