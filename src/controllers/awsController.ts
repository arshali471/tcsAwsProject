import express from "express";
import { DateTime } from "luxon";
import { S3BucketService } from "../services/awsS3Service";
import { EC2InstanceService } from "../services/awsEC2Service";
import { AWSStatusCheckService } from "../services/awsEC2StatusCheckService";
import { AWSKeyService } from "../services";
import path from "path";
import { SshService } from "../services/sshService";
import fs from "fs";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";


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
                    const formattedDetails = bucketDetails.map((bucket: any) => {
                        // Handle size formatting with proper error handling
                        let sizeFormatted = 'N/A';
                        let sizeBytes = 0;

                        if (typeof bucket.size === 'number') {
                            sizeBytes = bucket.size;
                            if (sizeBytes === 0) {
                                sizeFormatted = '0.00 GB (Empty or no data)';
                            } else {
                                sizeFormatted = `${(sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
                            }
                        } else if (bucket.size && bucket.size.error) {
                            sizeFormatted = `Error: ${bucket.size.error}`;
                        }

                        return {
                            ...bucket,
                            creationDate: bucket.creationDate ? DateTime.fromJSDate(bucket.creationDate).toISODate() : 'Unknown',
                            size: sizeFormatted,
                            sizeBytes: sizeBytes // Include raw bytes for sorting/filtering
                        };
                    });
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


    /**
     * Get agent status dashboard with statistics
     * If no date range: fetches live status from instances via SSH
     * If date range provided: fetches historical data from DB
     * Supports optional date range filtering via query params: startDate, endDate
     * Supports Windows credentials via request body: windowsUsername, windowsPassword
     */
    static async getAgentStatusDashboard(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.keyId;
            const { startDate, endDate, live } = req.query;
            const { windowsUsername, windowsPassword } = req.body;

            // If no date range or live=true, fetch live status from instances
            if ((!startDate && !endDate) || live === 'true') {
                const liveData = await AWSStatusCheckService.getLiveAgentStatus(
                    keyId,
                    windowsUsername,
                    windowsPassword
                );

                if (!liveData.success) {
                    return res.status(500).json({
                        success: false,
                        message: liveData.message || "Failed to fetch live agent status"
                    });
                }

                return res.status(200).json(liveData);
            }

            // Otherwise, fetch from database with date range
            const data = await AWSStatusCheckService.getAgentStatusDashboard(
                keyId,
                startDate ? String(startDate) : undefined,
                endDate ? String(endDate) : undefined
            );

            if (!data.success) {
                return res.status(500).json({
                    success: false,
                    message: data.message || "Failed to fetch agent status dashboard"
                });
            }

            return res.status(200).json(data);
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
                const data = await AWSStatusCheckService.getZabbixStatusFromDB(keyId, String(startDate), String(endDate), String(operatingSystem));
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


    // static async sshToInstance(req: express.Request, res: express.Response, next: express.NextFunction) {
    //     try {
    //         const { ip, username, sshKey } = req.body;
    //         if (!ip || !username || !sshKey) {
    //             return res.status(400).json({ error: 'Missing ip, username, or sshKey' });
    //         }

    //         // Instead of setting headers, save session for websocket handshake
    //         await SshService.saveSession({ ip, username, sshKey });

    //         // Serve terminal page
    //         return res.sendFile(path.join(__dirname, '../../public/terminal.html'));
    //     } catch (error) {
    //         next(error);
    //     }


    // }

    static async sshToInstance(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { ip, username } = req.body;
            const sshKeyFile = req.file;

            if (!ip || !username || !sshKeyFile || !sshKeyFile.path) {
                return res.status(400).json({ error: 'Missing ip, username, or sshKey file' });
            }

            const sshKey = fs.readFileSync(sshKeyFile.path, 'utf-8');
            // Optionally delete file: fs.unlinkSync(sshKeyFile.path);
            fs.unlinkSync(sshKeyFile.path);
            res.json({ ip, username, sshKey });
        } catch (error) {
            next(error);
        }
    }


    static async getTerminalSession(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const sessionId = req.params.sessionId as string;
            const session = SshService.sessions[sessionId];

            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            // Serve terminal page with session ID
            return res.sendFile(path.join(__dirname, '../../public/terminal.html'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all EC2 instances from all regions/environments
     * Returns formatted data with statistics
     */
    static async getAllInstancesFromAllRegions(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const data = await EC2InstanceService.getAllInstancesFromAllRegions();

            return res.status(200).json({
                success: true,
                data: data.instances,
                statistics: {
                    totalCount: data.totalCount,
                    runningCount: data.runningCount,
                    stoppedCount: data.stoppedCount
                },
                errors: data.errors,
                message: "EC2 instances fetched from all regions successfully"
            });
        } catch (err) {
            console.error("Error in getAllInstancesFromAllRegions controller:", err);
            next(err);
        }
    }

    /**
     * Export all EC2 instances to Excel with multiple sheets
     * - Summary sheet with counts per account
     * - Separate sheet for each AWS account/environment
     */
    static async exportAllInstancesToExcel(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const data = await EC2InstanceService.getAllInstancesFromAllRegions();

            if (!data.instances || data.instances.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No EC2 instances found to export"
                });
            }

            // Create a new workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'AWS Management Platform';
            workbook.created = new Date();

            // Group instances by environment
            const instancesByEnvironment: any = {};
            data.instances.forEach((instance: any) => {
                const envKey = `${instance.Environment} (${instance.Region})`;
                if (!instancesByEnvironment[envKey]) {
                    instancesByEnvironment[envKey] = [];
                }
                instancesByEnvironment[envKey].push(instance);
            });

            // 1. Create SUMMARY sheet
            const summarySheet = workbook.addWorksheet('Summary', {
                properties: { tabColor: { argb: 'FF4472C4' } }
            });

            // Summary header styling
            summarySheet.columns = [
                { header: 'Environment', key: 'environment', width: 25 },
                { header: 'Region', key: 'region', width: 20 },
                { header: 'Total Instances', key: 'total', width: 18 },
                { header: 'Running', key: 'running', width: 12 },
                { header: 'Stopped', key: 'stopped', width: 12 },
                { header: 'Other', key: 'other', width: 12 }
            ];

            // Style header row
            summarySheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            summarySheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            // Add summary data
            let totalGlobalCount = 0;
            let totalGlobalRunning = 0;
            let totalGlobalStopped = 0;
            let totalGlobalOther = 0;

            Object.entries(instancesByEnvironment).forEach(([envKey, instances]: [string, any]) => {
                const runningCount = instances.filter((i: any) => i.State === 'running').length;
                const stoppedCount = instances.filter((i: any) => i.State === 'stopped').length;
                const otherCount = instances.length - runningCount - stoppedCount;

                totalGlobalCount += instances.length;
                totalGlobalRunning += runningCount;
                totalGlobalStopped += stoppedCount;
                totalGlobalOther += otherCount;

                const [env, region] = envKey.split(' (');
                summarySheet.addRow({
                    environment: env,
                    region: region?.replace(')', '') || '',
                    total: instances.length,
                    running: runningCount,
                    stopped: stoppedCount,
                    other: otherCount
                });
            });

            // Add total row
            const totalRow = summarySheet.addRow({
                environment: 'TOTAL',
                region: '',
                total: totalGlobalCount,
                running: totalGlobalRunning,
                stopped: totalGlobalStopped,
                other: totalGlobalOther
            });
            totalRow.font = { bold: true, size: 12 };
            totalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE7E6E6' }
            };

            // Add borders to summary sheet
            summarySheet.eachRow((row, rowNumber) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // 2. Create separate sheet for each environment
            Object.entries(instancesByEnvironment).forEach(([envKey, instances]: [string, any]) => {
                // Clean sheet name (max 31 chars, no special characters)
                const sheetName = envKey.substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '-');
                const sheet = workbook.addWorksheet(sheetName);

                // Define columns
                sheet.columns = [
                    { header: 'Instance ID', key: 'instanceId', width: 22 },
                    { header: 'Instance Name', key: 'instanceName', width: 25 },
                    { header: 'Instance Type', key: 'instanceType', width: 15 },
                    { header: 'State', key: 'state', width: 12 },
                    { header: 'Private IP', key: 'privateIp', width: 16 },
                    { header: 'Public IP', key: 'publicIp', width: 16 },
                    { header: 'Availability Zone', key: 'availabilityZone', width: 18 },
                    { header: 'Launch Time', key: 'launchTime', width: 20 },
                    { header: 'Platform', key: 'platform', width: 15 },
                    { header: 'VPC ID', key: 'vpcId', width: 22 },
                    { header: 'Subnet ID', key: 'subnetId', width: 22 },
                    { header: 'Key Name', key: 'keyName', width: 20 }
                ];

                // Style header
                sheet.getRow(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
                sheet.getRow(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF70AD47' }
                };
                sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

                // Add instance data
                instances.forEach((instance: any) => {
                    const row = sheet.addRow({
                        instanceId: instance.InstanceId,
                        instanceName: instance.InstanceName,
                        instanceType: instance.InstanceType,
                        state: instance.State,
                        privateIp: instance.PrivateIpAddress,
                        publicIp: instance.PublicIpAddress,
                        availabilityZone: instance.AvailabilityZone,
                        launchTime: instance.LaunchTime ? DateTime.fromJSDate(new Date(instance.LaunchTime)).toFormat('yyyy-MM-dd HH:mm:ss') : 'N/A',
                        platform: instance.Platform,
                        vpcId: instance.VpcId,
                        subnetId: instance.SubnetId,
                        keyName: instance.KeyName
                    });

                    // Color code state cell
                    const stateCell = row.getCell('state');
                    if (instance.State === 'running') {
                        stateCell.font = { bold: true, color: { argb: 'FF008000' } };
                    } else if (instance.State === 'stopped') {
                        stateCell.font = { bold: true, color: { argb: 'FFFF0000' } };
                    }
                });

                // Add borders
                sheet.eachRow((row) => {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });
                });

                // Freeze header row
                sheet.views = [{ state: 'frozen', ySplit: 1 }];
            });

            // Generate Excel file
            const filename = `EC2_Instances_All_Regions_${DateTime.now().toFormat('yyyy-MM-dd_HHmmss')}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            await workbook.xlsx.write(res);
            res.end();
        } catch (err) {
            console.error("Error exporting EC2 instances to Excel:", err);
            next(err);
        }
    }

    /**
     * Get all EKS EC2 instances from all regions/environments
     * Returns formatted data with statistics including cluster count
     */
    static async getAllEKSEC2InstancesFromAllRegions(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const data = await EC2InstanceService.getAllEKSEC2InstancesFromAllRegions();

            return res.status(200).json({
                success: true,
                data: data.instances,
                statistics: {
                    totalCount: data.totalCount,
                    runningCount: data.runningCount,
                    stoppedCount: data.stoppedCount,
                    clusterCount: data.clusterCount
                },
                errors: data.errors,
                message: "EKS EC2 instances fetched from all regions successfully"
            });
        } catch (err) {
            console.error("Error in getAllEKSEC2InstancesFromAllRegions controller:", err);
            next(err);
        }
    }

    /**
     * Export all EKS EC2 instances to Excel with multiple sheets
     * - Summary sheet with counts per cluster
     * - Separate sheet for each EKS cluster
     */
    static async exportAllEKSInstancesToExcel(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const data = await EC2InstanceService.getAllEKSEC2InstancesFromAllRegions();

            if (!data.instances || data.instances.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No EKS EC2 instances found to export"
                });
            }

            // Create a new workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'AWS Management Platform';
            workbook.created = new Date();

            // Group instances by cluster name
            const instancesByCluster: any = {};
            data.instances.forEach((instance: any) => {
                const clusterKey = `${instance.ClusterName} (${instance.Region})`;
                if (!instancesByCluster[clusterKey]) {
                    instancesByCluster[clusterKey] = [];
                }
                instancesByCluster[clusterKey].push(instance);
            });

            // 1. Create SUMMARY sheet
            const summarySheet = workbook.addWorksheet('Summary', {
                properties: { tabColor: { argb: 'FF4472C4' } }
            });

            // Summary header styling
            summarySheet.columns = [
                { header: 'Cluster Name', key: 'clusterName', width: 30 },
                { header: 'Region', key: 'region', width: 20 },
                { header: 'Total Instances', key: 'total', width: 18 },
                { header: 'Running', key: 'running', width: 12 },
                { header: 'Stopped', key: 'stopped', width: 12 },
                { header: 'Other', key: 'other', width: 12 },
                { header: 'Node Groups', key: 'nodeGroups', width: 15 }
            ];

            // Style header row
            summarySheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            summarySheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            // Add summary data
            let totalGlobalCount = 0;
            let totalGlobalRunning = 0;
            let totalGlobalStopped = 0;
            let totalGlobalOther = 0;

            Object.entries(instancesByCluster).forEach(([clusterKey, instances]: [string, any]) => {
                const runningCount = instances.filter((i: any) => i.State === 'running').length;
                const stoppedCount = instances.filter((i: any) => i.State === 'stopped').length;
                const otherCount = instances.length - runningCount - stoppedCount;
                const nodeGroupSet = new Set(instances.map((i: any) => i.NodeGroupName));
                const uniqueNodeGroups = nodeGroupSet.size;

                totalGlobalCount += instances.length;
                totalGlobalRunning += runningCount;
                totalGlobalStopped += stoppedCount;
                totalGlobalOther += otherCount;

                const [cluster, region] = clusterKey.split(' (');
                summarySheet.addRow({
                    clusterName: cluster,
                    region: region?.replace(')', '') || '',
                    total: instances.length,
                    running: runningCount,
                    stopped: stoppedCount,
                    other: otherCount,
                    nodeGroups: uniqueNodeGroups
                });
            });

            // Add total row
            const totalRow = summarySheet.addRow({
                clusterName: 'TOTAL',
                region: '',
                total: totalGlobalCount,
                running: totalGlobalRunning,
                stopped: totalGlobalStopped,
                other: totalGlobalOther,
                nodeGroups: Object.keys(instancesByCluster).length
            });
            totalRow.font = { bold: true, size: 12 };
            totalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE7E6E6' }
            };

            // Add borders to summary sheet
            summarySheet.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // 2. Create separate sheet for each cluster
            Object.entries(instancesByCluster).forEach(([clusterKey, instances]: [string, any]) => {
                // Clean sheet name (max 31 chars, no special characters)
                const sheetName = clusterKey.substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '-');
                const sheet = workbook.addWorksheet(sheetName);

                // Define columns
                sheet.columns = [
                    { header: 'Instance ID', key: 'instanceId', width: 22 },
                    { header: 'Instance Name', key: 'instanceName', width: 25 },
                    { header: 'Cluster Name', key: 'clusterName', width: 25 },
                    { header: 'Node Group', key: 'nodeGroup', width: 25 },
                    { header: 'Instance Type', key: 'instanceType', width: 15 },
                    { header: 'State', key: 'state', width: 12 },
                    { header: 'Private IP', key: 'privateIp', width: 16 },
                    { header: 'Public IP', key: 'publicIp', width: 16 },
                    { header: 'Availability Zone', key: 'availabilityZone', width: 18 },
                    { header: 'Launch Time', key: 'launchTime', width: 20 },
                    { header: 'Platform', key: 'platform', width: 15 },
                    { header: 'VPC ID', key: 'vpcId', width: 22 },
                    { header: 'Environment', key: 'environment', width: 15 }
                ];

                // Style header
                sheet.getRow(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
                sheet.getRow(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF70AD47' }
                };
                sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

                // Add instance data
                instances.forEach((instance: any) => {
                    const row = sheet.addRow({
                        instanceId: instance.InstanceId,
                        instanceName: instance.InstanceName,
                        clusterName: instance.ClusterName,
                        nodeGroup: instance.NodeGroupName,
                        instanceType: instance.InstanceType,
                        state: instance.State,
                        privateIp: instance.PrivateIpAddress,
                        publicIp: instance.PublicIpAddress,
                        availabilityZone: instance.AvailabilityZone,
                        launchTime: instance.LaunchTime ? DateTime.fromJSDate(new Date(instance.LaunchTime)).toFormat('yyyy-MM-dd HH:mm:ss') : 'N/A',
                        platform: instance.Platform,
                        vpcId: instance.VpcId,
                        environment: instance.Environment
                    });

                    // Color code state cell
                    const stateCell = row.getCell('state');
                    if (instance.State === 'running') {
                        stateCell.font = { bold: true, color: { argb: 'FF008000' } };
                    } else if (instance.State === 'stopped') {
                        stateCell.font = { bold: true, color: { argb: 'FFFF0000' } };
                    }
                });

                // Add borders
                sheet.eachRow((row) => {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });
                });

                // Freeze header row
                sheet.views = [{ state: 'frozen', ySplit: 1 }];
            });

            // Generate Excel file
            const filename = `EKS_EC2_Instances_All_Clusters_${DateTime.now().toFormat('yyyy-MM-dd_HHmmss')}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            await workbook.xlsx.write(res);
            res.end();
        } catch (err) {
            console.error("Error exporting EKS EC2 instances to Excel:", err);
            next(err);
        }
    }


}