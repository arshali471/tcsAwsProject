import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { SSMClient, SendCommandCommand, GetCommandInvocationCommand, DescribeInstanceInformationCommand, OperatingSystem } from "@aws-sdk/client-ssm";
import { AWSKeyService } from "./awsKeyService";
import { NodeSSH } from "node-ssh";
import fs from "fs";
import path from "path";
import { CONFIG } from "../config/environment";
import { SSHKeyService } from "./sshKeyService";
import { platform } from "os";
import { StatusRecordDao } from "../lib/dao/statusRecord.dao";

export class AWSStatusCheckService {
    static async checkNginxStatusOnLinuxInstances(keyId: string) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const ec2Client = new EC2Client(awsConfig);
            const ssmClient = new SSMClient(awsConfig);

            // Fetch all running Linux EC2 instances
            const ec2Data = await ec2Client.send(new DescribeInstancesCommand({
                Filters: [
                    { Name: "instance-state-name", Values: ["running"] },
                    { Name: "platform-details", Values: ["Linux/UNIX"] } // Only Linux instances
                ]
            }));

            // Extract instance IDs
            const instances: any = ec2Data.Reservations?.flatMap(reservation =>
                reservation.Instances?.map(instance => ({
                    instanceId: instance.InstanceId,
                    name: instance.Tags?.find(tag => tag.Key === "Name")?.Value || "Unknown",
                    privateIp: instance.PrivateIpAddress || "N/A",
                    state: instance.State?.Name || "Unknown"
                }))
            ) || [];

            if (instances.length === 0) {
                return { message: "No running Linux instances found." };
            }

            console.log(`Total Instances Found: ${instances.length}`);

            // Fetch the list of instances that are registered with SSM
            const ssmData = await ssmClient.send(new DescribeInstanceInformationCommand({}));

            // Extract instance IDs that are managed by SSM
            const ssmManagedInstances = ssmData.InstanceInformationList?.map(instance => instance.InstanceId) || [];

            // Filter only instances that are managed by SSM
            const validInstances = instances.filter((instance: any) => ssmManagedInstances.includes(instance.instanceId));

            if (validInstances.length === 0) {
                return { message: "No valid instances found with SSM Agent installed." };
            }

            console.log(`SSM Managed Instances Found: ${validInstances.length}`);

            const command = "systemctl is-active nginx";
            const commandIdMap: Record<string, string> = {};

            // Send separate commands for each valid SSM-managed instance
            for (const instance of validInstances) {
                try {
                    const commandResponse = await ssmClient.send(new SendCommandCommand({
                        DocumentName: "AWS-RunShellScript",
                        Targets: [{ Key: "InstanceIds", Values: [instance.instanceId] }],
                        Parameters: { commands: [command] },
                        Comment: `Checking NGINX status on ${instance.name}`,
                    }));

                    if (commandResponse.Command?.CommandId) {
                        commandIdMap[instance.instanceId] = commandResponse.Command.CommandId;
                    }
                } catch (error) {
                    console.error(`Failed to send command for ${instance.instanceId}:`, error);
                }
            }

            console.log(`Total Commands Sent: ${Object.keys(commandIdMap).length}`);

            // Wait before fetching results (AWS SSM takes time)
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Fetch the command results for all valid instances
            const nginxResults = [];

            for (const instance of validInstances) {
                const commandId = commandIdMap[instance.instanceId];

                if (!commandId) {
                    console.warn(`No command ID found for ${instance.instanceId}`);
                    continue;
                }

                try {
                    const commandOutput = await ssmClient.send(new GetCommandInvocationCommand({
                        CommandId: commandId,
                        InstanceId: instance.instanceId
                    }));

                    nginxResults.push({
                        instanceId: instance.instanceId,
                        name: instance.name,
                        privateIp: instance.privateIp,
                        nginxStatus: commandOutput.StandardOutputContent?.trim() || "Unknown",
                        status: commandOutput.Status
                    });
                } catch (error) {
                    console.error(`Failed to fetch status for instance ${instance.instanceId}:`, error);
                }
            }

            return { nginxResults };
        } catch (error: any) {
            console.error("Error checking NGINX status:", error);
            return { error: error.message };
        }
    }


    // static async getAllInstanceDetailsWithNginxStatus(keyId: any, sshUsername: string, privateKeyPath: string) {
    //     try {
    //         const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
    //         const ec2Client = new EC2Client(awsConfig);

    //         const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
    //         const instances = data.Reservations.flatMap((res: any) => res.Instances);

    //         const ssh = new NodeSSH();
    //         const results: any[] = [];

    //         for (const instance of instances) {
    //             const privateIp = instance.PrivateIpAddress;

    //             if (!privateIp) {
    //                 results.push({ instanceId: instance.InstanceId, status: "No private IP" });
    //                 continue;
    //             }

    //             try {
    //                 await ssh.connect({
    //                     host: privateIp,
    //                     username: sshUsername,
    //                     privateKey: privateKeyPath,
    //                 });

    //                 const result = await ssh.execCommand("docker --version");

    //                 results.push({
    //                     instanceId: instance.InstanceId,
    //                     ip: privateIp,
    //                     dockerVersion: result.stdout.trim() || result.stderr.trim(),
    //                 });

    //                 ssh.dispose();
    //             } catch (sshErr: any) {
    //                 results.push({
    //                     instanceId: instance.InstanceId,
    //                     ip: privateIp,
    //                     nginxStatus: `SSH Error: ${sshErr.message}`,
    //                 });
    //             }
    //         }

    //         return results;
    //     } catch (err) {
    //         console.error("Error fetching instance details or nginx status:", err);
    //         throw err;
    //     }
    // }

    // static async getAllInstanceDetailsWithNginxStatus(
    //     keyId: any,
    //     sshUsername: string,
    //     privateKeyRelativePath: string
    //   ) {
    //     try {
    //       const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
    //       const ec2Client = new EC2Client(awsConfig);
    //       const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
    //       const instances = data.Reservations.flatMap((res: any) => res.Instances);

    //       const ssh = new NodeSSH();
    //       const results: any[] = [];

    //       const privateKeyPath = path.resolve(CONFIG.sshKeyFolderPath, privateKeyRelativePath);
    //       console.log(privateKeyPath, "privateKeyPath")
    //       const privateKey = fs.readFileSync(privateKeyPath, "utf8");

    //       for (const instance of instances) {
    //         const privateIp = instance.PrivateIpAddress;

    //         if (!privateIp) {
    //           results.push({ instanceId: instance.InstanceId, status: "No private IP" });
    //           continue;
    //         }

    //         try {
    //           await ssh.connect({
    //             host: privateIp,
    //             username: sshUsername,
    //             privateKey: privateKey,
    //           });

    //           const result = await ssh.execCommand("systemctl is-active nginx");

    //           results.push({
    //             instanceId: instance.InstanceId,
    //             ip: privateIp,
    //             nginxStatus: result.stdout.trim() || result.stderr.trim(),
    //           });

    //           ssh.dispose();
    //         } catch (sshErr: any) {
    //           results.push({
    //             instanceId: instance.InstanceId,
    //             ip: privateIp,
    //             nginxStatus: `SSH Error: ${sshErr.message}`,
    //           });
    //         }
    //       }

    //       return results;
    //     } catch (err) {
    //       console.error("Error fetching instance details or nginx status:", err);
    //       throw err;
    //     }
    //   }


    // static async getAllInstanceDetailsWithNginxStatus(
    //     keyId: any,
    //     sshUsername: string,
    //     privateKeyRelativePath: string,
    //     operatingSystem: any
    // ) {
    //     try {
    //         const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
    //         const ec2Client = new EC2Client(awsConfig);
    //         const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
    //         const instances = data.Reservations.flatMap((res: any) => res.Instances);

    //         const ssh = new NodeSSH();
    //         const results: any[] = [];

    //         const privateKeyPath = path.resolve(CONFIG.sshKeyFolderPath, privateKeyRelativePath);
    //         console.log("Using private key path:", privateKeyPath);
    //         const privateKey = fs.readFileSync(privateKeyPath, "utf8");

    //         // const TARGET_IP = "10.35.58.225";

    //         for (const instance of instances) {
    //             const privateIp = instance.PrivateIpAddress;
    //             // const privateIp = instance.PublicIpAddress;

    //             if (!privateIp) {
    //                 results.push({ instanceId: instance.InstanceId, status: "No private IP" });
    //                 continue;
    //             }

    //             try {
    //                 await ssh.connect({
    //                     host: privateIp,
    //                     username: sshUsername,
    //                     privateKey: privateKey,
    //                 });

    //                 console.log(`✅ SSH connected to ${privateIp} (${instance.InstanceId})`);

    //                 const servicesToCheck: { service: string; displayName: string }[] = [
    //                     { service: "zabbix-agent2", displayName: "zabbix agent" },
    //                     { service: "falcon-sensor", displayName: "Crowd Strike" },
    //                     { service: "qualys-cloud-agent", displayName: "Qualys" },
    //                     { service: "amazon-cloudwatch-agent", displayName: "CloudWatch" },
    //                   ];

    //                   const serviceStatuses: Record<string, string> = {};

    //                   for (const { service, displayName } of servicesToCheck) {
    //                     const result = await ssh.execCommand(`systemctl is-active ${service}`);
    //                     serviceStatuses[displayName] = result.stdout.trim() || result.stderr.trim();
    //                   }

    //                 results.push({
    //                     instanceId: instance.InstanceId,
    //                     ip: privateIp,
    //                     services: serviceStatuses,
    //                 });


    //                 ssh.dispose();
    //             } catch (sshErr: any) {
    //                 results.push({
    //                     instanceId: instance.InstanceId,
    //                     ip: privateIp,
    //                     error: `SSH Error: ${sshErr.message}`,
    //                 });
    //             }
    //         }

    //         return results;
    //     } catch (err) {
    //         console.error("Error fetching instance details or nginx status:", err);
    //         throw err;
    //     }
    // }


    // static async getAllInstanceDetailsWithNginxStatus(
    //     keyId: any,
    //     sshUsername: string,
    //     privateKeyRelativePath: string,
    //     operatingSystem: string
    // ) {
    //     try {
    //         const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
    //         const ec2Client = new EC2Client(awsConfig);
    //         const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
    //         const instances = data.Reservations.flatMap((res: any) => res.Instances);

    //         const results: any[] = [];
    //         const privateKeyPath = await SSHKeyService.getSSHkeyById(privateKeyRelativePath);
    //         if (!privateKeyPath) {
    //             throw new Error("Private key not found");
    //         }

    //         const privateKey = privateKeyPath.sshkey;

    //         // Filter by running state and Operating_System tag (partial match)
    //         const filteredInstances = instances.filter((instance: any) => {
    //             const isRunning = instance.State?.Name === "running";
    //             const tags = instance.Tags || [];
    //             const osTag = tags.find((tag: any) => tag.Key === "Operating_System");

    //             return (
    //                 isRunning &&
    //                 osTag &&
    //                 osTag.Value.toLowerCase().includes(operatingSystem.toLowerCase())
    //             );
    //         });

    //         if (filteredInstances.length === 0) {
    //             return {
    //                 message: "No running instance found with provided operating system",
    //                 operatingSystem,
    //             };
    //         }

    //         for (const instance of filteredInstances) {
    //             const privateIp = instance.PrivateIpAddress;
    //             if (!privateIp) {
    //                 results.push({ instanceId: instance.InstanceId, status: "No private IP" });
    //                 continue;
    //             }

    //             const isWindows = instance.Platform === "windows";
    //             const ssh = new NodeSSH();

    //             try {
    //                 await ssh.connect({
    //                     host: privateIp,
    //                     username: sshUsername,
    //                     privateKey,
    //                 });

    //                 console.log(`✅ SSH connected to ${privateIp} (${instance.InstanceId}) [${isWindows ? "Windows" : "Linux"}]`);

    //                 const servicesToCheck: { service: string; displayName: string }[] = [
    //                     { service: "zabbix-agent2", displayName: "zabbix agent" },
    //                     { service: "falcon-sensor", displayName: "Crowd Strike" },
    //                     { service: "qualys-cloud-agent", displayName: "Qualys" },
    //                     { service: "amazon-cloudwatch-agent", displayName: "CloudWatch" },
    //                 ];

    //                 const serviceStatuses: Record<string, string> = {};
    //                 const serviceVersions: Record<string, string> = {};

    //                 for (const { service, displayName } of servicesToCheck) {
    //                     let statusResult, versionResult;

    //                     if (isWindows) {
    //                         // Check status
    //                         statusResult = await ssh.execCommand(
    //                             `powershell -Command "(Get-Service -Name '${service}').Status"`
    //                         );

    //                         // Check version (Windows approach, may need customization per agent)
    //                         versionResult = await ssh.execCommand(
    //                             `powershell -Command "Get-Command '${service}' | Select-Object -ExpandProperty Version"`
    //                         );
    //                     } else {
    //                         // Check status
    //                         statusResult = await ssh.execCommand(`systemctl is-active ${service}`);

    //                         // Check version (Linux)
    //                         versionResult = await ssh.execCommand(`${service} --version`);
    //                     }

    //                     serviceStatuses[displayName] = statusResult.stdout.trim() || statusResult.stderr.trim();
    //                     serviceVersions[displayName] = versionResult.stdout.trim() || versionResult.stderr.trim();
    //                 }


    //                 results.push({
    //                     instanceName: instance.Tags?.find((tag: any) => tag.Key === "Name")?.Value || "Unknown",
    //                     instanceId: instance.InstanceId,
    //                     ip: privateIp,
    //                     os: instance.Tags?.find((tag: any) => tag.Key === "Operating_System")?.Value || "Unknown",
    //                     services: serviceStatuses,
    //                     versions: serviceVersions,
    //                     platform: instance.PlatformDetails,
    //                     state: instance.State?.Name || "Unknown",
    //                   });


    //                 ssh.dispose();
    //             } catch (sshErr: any) {
    //                 results.push({
    //                     instanceName: instance.Tags?.find((tag: any) => tag.Key === "Name")?.Value || "Unknown",
    //                     instanceId: instance.InstanceId,
    //                     ip: privateIp,
    //                     os: instance.Tags?.find((tag: any) => tag.Key === "Operating_System")?.Value || "Unknown",
    //                     platform: instance.PlatformDetails,
    //                     state: instance.State?.Name || "Unknown",
    //                     error: `SSH Error: ${sshErr.message}`,
    //                   });
    //             }
    //         }

    //         return results;
    //     } catch (err) {
    //         console.error("Error fetching instance details or checking status:", err);
    //         throw err;
    //     }
    // }



    // static async getAllInstanceDetailsWithNginxStatus(
    //     keyId: any,
    //     sshUsername: string,
    //     privateKeyRelativePath: string,
    //     operatingSystem: string
    // ) {
    //     try {
    //         const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
    //         const ec2Client = new EC2Client(awsConfig);
    //         const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
    //         const instances = data.Reservations.flatMap((res: any) => res.Instances);

    //         const results: any[] = [];
    //         const privateKeyPath = await SSHKeyService.getSSHkeyById(privateKeyRelativePath);
    //         if (!privateKeyPath) {
    //             throw new Error("Private key not found");
    //         }

    //         const privateKey = privateKeyPath.sshkey;

    //         // Filter by running state and Operating_System tag (partial match)
    //         const filteredInstances = instances.filter((instance: any) => {
    //             const isRunning = instance.State?.Name === "running";
    //             const tags = instance.Tags || [];
    //             const osTag = tags.find((tag: any) => tag.Key === "Operating_System");

    //             return (
    //                 isRunning &&
    //                 osTag &&
    //                 osTag.Value.toLowerCase().includes(operatingSystem.toLowerCase())
    //             );
    //         });

    //         if (filteredInstances.length === 0) {
    //             return {
    //                 message: "No running instance found with provided operating system",
    //                 operatingSystem,
    //                 error: true
    //             };
    //         }

    //         for (const instance of filteredInstances) {
    //             const privateIp = instance.PrivateIpAddress;

    //             const instanceName = instance.Tags?.find((tag: any) => tag.Key === "Name")?.Value || "Unknown";
    //             const operatingSystem = instance.Tags?.find((tag: any) => tag.Key === "Operating_System")?.Value || "Unknown";
    //             const platform = instance.PlatformDetails || "Unknown";
    //             const state = instance.State?.Name || "Unknown";
    //             const instanceId = instance.InstanceId;

    //             const baseResult: any = {
    //                 instanceName,
    //                 instanceId,
    //                 ip: privateIp || "N/A",
    //                 os: operatingSystem,
    //                 platform,
    //                 state,
    //                 services: {
    //                     zabbixAgent: "Not checked",
    //                     crowdStrike: "Not checked",
    //                     qualys: "Not checked",
    //                     cloudWatch: "Not checked"
    //                 },
    //                 versions: {
    //                     zabbixAgent: "N/A",
    //                     crowdStrike: "N/A",
    //                     qualys: "N/A",
    //                     cloudWatch: "N/A"
    //                 },
    //                 error: null as string | null
    //             };

    //             if (!privateIp) {
    //                 baseResult.error = "No private IP";
    //                 results.push(baseResult);
    //                 continue;
    //             }

    //             const isWindows = instance.Platform === "windows";
    //             const ssh = new NodeSSH();

    //             try {
    //                 await ssh.connect({
    //                     host: privateIp,
    //                     username: sshUsername,
    //                     privateKey,
    //                 });

    //                 console.log(`✅ SSH connected to ${privateIp} (${instanceId}) [${isWindows ? "Windows" : "Linux"}]`);

    //                 const servicesToCheck: { service: string; displayName: keyof typeof baseResult.services }[] = [
    //                     { service: "zabbix-agent2", displayName: "zabbixAgent" },
    //                     { service: "falcon-sensor", displayName: "crowdStrike" },
    //                     { service: "qualys-cloud-agent", displayName: "qualys" },
    //                     { service: "amazon-cloudwatch-agent", displayName: "cloudWatch" },
    //                 ];

    //                 for (const { service, displayName } of servicesToCheck) {
    //                     let statusResult, versionResult;

    //                     if (isWindows) {
    //                         statusResult = await ssh.execCommand(
    //                             `powershell -Command "(Get-Service -Name '${service}').Status"`
    //                         );
    //                         versionResult = await ssh.execCommand(
    //                             `powershell -Command "Get-Command '${service}' | Select-Object -ExpandProperty Version"`
    //                         );
    //                     } else {
    //                         statusResult = await ssh.execCommand(`systemctl is-active ${service}`);
    //                         versionResult = await ssh.execCommand(`${service} --version`);
    //                     }

    //                     baseResult.services[displayName] =
    //                         statusResult.stdout.trim() || statusResult.stderr.trim() || "Unknown";

    //                     baseResult.versions[displayName] =
    //                         versionResult.stdout.trim() || versionResult.stderr.trim() || "Unknown";
    //                 }
    //             } catch (sshErr: any) {
    //                 baseResult.error = `SSH Error: ${sshErr.message}`;
    //             } finally {
    //                 ssh.dispose(); // Ensure cleanup
    //             }

    //             results.push(baseResult);
    //         }


    //     } catch (err) {
    //         console.error("Error fetching instance details or checking status:", err);
    //         throw err;
    //     }
    // }

    // static async getAllInstanceDetailsWithNginxStatus(
    //     keyId: any,
    //     sshUsername: string,
    //     privateKeyRelativePath: string,
    //     operatingSystem: string
    // ) {
    //     try {
    //         const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
    //         const ec2Client = new EC2Client(awsConfig);
    //         const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
    //         const instances = data.Reservations.flatMap((res: any) => res.Instances);

    //         const results: any[] = [];
    //         const privateKeyPath = await SSHKeyService.getSSHkeyById(privateKeyRelativePath);
    //         if (!privateKeyPath) {
    //             throw new Error("Private key not found");
    //         }

    //         const privateKey = privateKeyPath.sshkey;

    //         // Filter by running state and Operating_System tag (partial match)
    //         const filteredInstances = instances.filter((instance: any) => {
    //             const isRunning = instance.State?.Name === "running";
    //             const tags = instance.Tags || [];
    //             const osTag = tags.find((tag: any) => tag.Key === "Operating_System");

    //             return (
    //                 isRunning &&
    //                 osTag &&
    //                 osTag.Value.toLowerCase().includes(operatingSystem.toLowerCase())
    //             );
    //         });

    //         if (filteredInstances.length === 0) {
    //             return {
    //                 message: "No running instance found with provided operating system",
    //                 operatingSystem,
    //                 error: true
    //             };
    //         }

    //         for (const instance of filteredInstances) {
    //             const privateIp = instance.PrivateIpAddress;

    //             const instanceName = instance.Tags?.find((tag: any) => tag.Key === "Name")?.Value || "Unknown";
    //             const osTag = instance.Tags?.find((tag: any) => tag.Key === "Operating_System")?.Value || "Unknown";
    //             const platform = instance.PlatformDetails || "Unknown";
    //             const state = instance.State?.Name || "Unknown";
    //             const instanceId = instance.InstanceId;

    //             const baseResult: any = {
    //                 instanceName,
    //                 instanceId,
    //                 ip: privateIp || "N/A",
    //                 os: osTag,
    //                 platform,
    //                 state,
    //                 services: {
    //                     zabbixAgent: "inactive",
    //                     crowdStrike: "inactive",
    //                     qualys: "inactive",
    //                     cloudWatch: "inactive",
    //                 },
    //                 versions: {
    //                     zabbixAgent: "N/A",
    //                     crowdStrike: "N/A",
    //                     qualys: "N/A",
    //                     cloudWatch: "N/A"
    //                 },
    //                 error: null as string | null
    //             };

    //             if (!privateIp) {
    //                 baseResult.error = "No private IP";
    //                 results.push(baseResult);
    //                 continue;
    //             }

    //             const isWindows = instance.Platform === "windows";
    //             const ssh = new NodeSSH();

    //             try {
    //                 await ssh.connect({
    //                     host: privateIp,
    //                     username: sshUsername,
    //                     privateKey,
    //                 });

    //                 console.log(`✅ SSH connected to ${privateIp} (${instanceId}) [${isWindows ? "Windows" : "Linux"}]`);

    //                 const servicesToCheck: { service: string; displayName: keyof typeof baseResult.services }[] = [
    //                     { service: "zabbix-agent2", displayName: "zabbixAgent" },
    //                     { service: "falcon-sensor", displayName: "crowdStrike" },
    //                     { service: "qualys-cloud-agent", displayName: "qualys" },
    //                     { service: "amazon-cloudwatch-agent", displayName: "cloudWatch" },
    //                 ];

    //                 for (const { service, displayName } of servicesToCheck) {
    //                     let statusResult, versionResult;

    //                     if (isWindows) {
    //                         statusResult = await ssh.execCommand(
    //                             `powershell -Command "(Get-Service -Name '${service}').Status"`
    //                         );
    //                         versionResult = await ssh.execCommand(
    //                             `powershell -Command "Get-Command '${service}' | Select-Object -ExpandProperty Version"`
    //                         );
    //                     } else {
    //                         statusResult = await ssh.execCommand(`systemctl is-active ${service}`);
    //                         versionResult = await ssh.execCommand(`${service} --version`);
    //                     }

    //                     baseResult.services[displayName] =
    //                         statusResult.stdout.trim() || statusResult.stderr.trim() || "Unknown";

    //                     baseResult.versions[displayName] =
    //                         versionResult.stdout.trim() || versionResult.stderr.trim() || "Unknown";
    //                 }
    //             } catch (sshErr: any) {
    //                 baseResult.error = `SSH Error: ${sshErr.message}`;
    //             } finally {
    //                 ssh.dispose();
    //             }

    //             results.push(baseResult);
    //         }

    //         // ✅ Final return after processing all filtered instances
    //         return {
    //             success: true,
    //             operatingSystem,
    //             totalInstances: results.length,
    //             results
    //         };

    //     } catch (err) {
    //         console.error("Error fetching instance details or checking status:", err);
    //         return {
    //             success: false,
    //             error: (err as Error).message || "Unexpected error occurred",
    //         };
    //     }
    // }


    // static async getAllInstanceDetailsWithNginxStatus(
    //     keyId: any,
    //     sshUsername: string,
    //     privateKeyRelativePath: string,
    //     operatingSystem: string
    // ) {
    //     try {
    //         const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
    //         const ec2Client = new EC2Client(awsConfig);
    //         const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
    //         const instances = data.Reservations.flatMap((res: any) => res.Instances);

    //         const results: any[] = [];
    //         const privateKeyPath = await SSHKeyService.getSSHkeyById(privateKeyRelativePath);
    //         if (!privateKeyPath) {
    //             throw new Error("Private key not found");
    //         }

    //         const privateKey = privateKeyPath.sshkey;

    //         const filteredInstances = instances.filter((instance: any) => {
    //             const isRunning = instance.State?.Name === "running";
    //             const tags = instance.Tags || [];
    //             const osTag = tags.find((tag: any) => tag.Key === "Operating_System");

    //             return (
    //                 isRunning &&
    //                 osTag &&
    //                 osTag.Value.toLowerCase().includes(operatingSystem.toLowerCase())
    //             );
    //         });

    //         if (filteredInstances.length === 0) {
    //             return {
    //                 message: "No running instance found with provided operating system",
    //                 operatingSystem,
    //                 error: true
    //             };
    //         }

    //         for (const instance of filteredInstances) {
    //             const privateIp = instance.PrivateIpAddress;

    //             const instanceName = instance.Tags?.find((tag: any) => tag.Key === "Name")?.Value || "Unknown";
    //             const osTag = instance.Tags?.find((tag: any) => tag.Key === "Operating_System")?.Value || "Unknown";
    //             const platform = instance.PlatformDetails || "Unknown";
    //             const state = instance.State?.Name || "Unknown";
    //             const instanceId = instance.InstanceId;

    //             const baseResult: any = {
    //                 instanceName,
    //                 instanceId,
    //                 ip: privateIp || "N/A",
    //                 os: osTag,
    //                 platform,
    //                 state,
    //                 services: {
    //                     zabbixAgent: "inactive",
    //                     crowdStrike: "inactive",
    //                     qualys: "inactive",
    //                     cloudWatch: "inactive",
    //                 },
    //                 versions: {
    //                     zabbixAgent: "N/A",
    //                     crowdStrike: "N/A",
    //                     qualys: "N/A",
    //                     cloudWatch: "N/A"
    //                 },
    //                 error: null as string | null
    //             };

    //             if (!privateIp) {
    //                 baseResult.error = "No private IP";
    //                 results.push(baseResult);
    //                 continue;
    //             }

    //             const isWindows = instance.Platform === "windows";
    //             const ssh = new NodeSSH();

    //             try {
    //                 await ssh.connect({
    //                     host: privateIp,
    //                     username: sshUsername,
    //                     privateKey,
    //                 });

    //                 console.log(`✅ SSH connected to ${privateIp} (${instanceId}) [${isWindows ? "Windows" : "Linux"}]`);

    //                 const servicesToCheck = [
    //                     {
    //                         service: "zabbix-agent2",
    //                         displayName: "zabbixAgent",
    //                         versionCmd: `zabbix_agent2 --version | head -n1 | awk '{print $3}'`
    //                     },
    //                     {
    //                         service: "falcon-sensor",
    //                         displayName: "crowdStrike",
    //                         versionCmd: `sudo -n /opt/CrowdStrike/falconctl -g --version | awk -F'= ' '{print $2}'`
    //                     },
    //                     {
    //                         service: "qualys-cloud-agent",
    //                         displayName: "qualys",
    //                         versionCmd: `sudo -n cat /var/log/qualys/qualys-cloud-agent.log | grep "Current Agent Version" | head -n1 | sed -n 's/.*Current Agent Version : \\(.*\\) Available.*/\\1/p'`
    //                     },
    //                     {
    //                         service: "amazon-cloudwatch-agent",
    //                         displayName: "cloudWatch",
    //                         versionCmd: `/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status | grep -i version | awk -F'"' '{print $4}'`
    //                     },
    //                 ];


    //                 // for (const { service, displayName, versionCmd } of servicesToCheck) {
    //                 //     let statusResult, versionResult;

    //                 //     if (isWindows) {
    //                 //         statusResult = await ssh.execCommand(`powershell -Command "(Get-Service -Name '${service}').Status"`);
    //                 //         versionResult = await ssh.execCommand(`powershell -Command "Get-Command '${service}' | Select-Object -ExpandProperty Version"`); // Adjust this if needed
    //                 //     } else {
    //                 //         statusResult = await ssh.execCommand(`systemctl is-active ${service}`);
    //                 //         versionResult = await ssh.execCommand(versionCmd);
    //                 //     }

    //                 //     baseResult.services[displayName] =
    //                 //         statusResult.stdout.trim() || statusResult.stderr.trim() || "Unknown";

    //                 //     baseResult.versions[displayName] =
    //                 //         versionResult.stdout.trim() || versionResult.stderr.trim() || "Unknown";
    //                 // }

    //                 for (const { service, displayName, versionCmd } of servicesToCheck) {
    //                     let statusResult, versionResult;

    //                     if (isWindows) {
    //                         statusResult = await ssh.execCommand(`powershell -Command "(Get-Service -Name '${service}').Status"`);
    //                         versionResult = await ssh.execCommand(`powershell -Command "Get-Command '${service}' | Select-Object -ExpandProperty Version"`); // Adjust this if needed
    //                     } else {
    //                         statusResult = await ssh.execCommand(`systemctl is-active ${service}`);
    //                         versionResult = await ssh.execCommand(versionCmd);
    //                     }

    //                     baseResult.services[displayName] =
    //                         statusResult.stdout.trim() || statusResult.stderr.trim() || "Unknown";

    //                     const rawVersion = versionResult.stdout.trim() || versionResult.stderr.trim() || "Unknown";
    //                     if (rawVersion !== "Unknown") {
    //                         // Parse and format version to two decimal places
    //                         const formattedVersion = parseFloat(rawVersion).toFixed(2);
    //                         baseResult.versions[displayName] = formattedVersion;
    //                     } else {
    //                         baseResult.versions[displayName] = "Unknown";
    //                     }
    //                 }

    //             } catch (sshErr: any) {
    //                 baseResult.error = `SSH Error: ${sshErr.message}`;
    //             } finally {
    //                 ssh.dispose();
    //             }

    //             results.push(baseResult);
    //         }

    //         const statusRecord = results.map((result: any) => ({
    //             ...result,
    //             awsKeyId: keyId,
    //         }));

    //         await StatusRecordDao.addStatusRecord(statusRecord);

    //         return {
    //             success: true,
    //             operatingSystem,
    //             totalInstances: results.length,
    //             results
    //         };

    //     } catch (err) {
    //         console.error("Error fetching instance details or checking status:", err);
    //         return {
    //             success: false,
    //             error: (err as Error).message || "Unexpected error occurred",
    //         };
    //     }
    // }

    static async getAllInstanceDetailsWithNginxStatus(
        keyId: any,
        sshUsername: string,
        privateKeyRelativePath: string,
        operatingSystem: string,
        windowsPassword?: string
    ) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const ec2Client = new EC2Client(awsConfig);
            const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
            const instances = data.Reservations.flatMap((res: any) => res.Instances);

            const results: any[] = [];
            const privateKeyPath = await SSHKeyService.getSSHkeyById(privateKeyRelativePath);
            if (!privateKeyPath) {
                throw new Error("Private key not found");
            }

            const privateKey = privateKeyPath.sshkey;

            const filteredInstances = instances.filter((instance: any) => {
                const isRunning = instance.State?.Name === "running";
                const tags = instance.Tags || [];
                const osTag = tags.find((tag: any) => tag.Key === "Operating_System");

                return (
                    isRunning &&
                    osTag &&
                    osTag.Value.toLowerCase().includes(operatingSystem.toLowerCase())
                    // Removed Windows exclusion to support Windows servers
                );
            });

            if (filteredInstances.length === 0) {
                return {
                    message: `No running instance found with provided operating system ${operatingSystem}`,
                    operatingSystem,
                    error: true,
                    success: false
                };
            }

            for (const instance of filteredInstances) {
                const privateIp = instance.PrivateIpAddress;

                const instanceName = instance.Tags?.find((tag: any) => tag.Key === "Name")?.Value || "Unknown";
                const osTag = instance.Tags?.find((tag: any) => tag.Key === "Operating_System")?.Value || "Unknown";
                const platform = instance.PlatformDetails || "Unknown";
                const state = instance.State?.Name || "Unknown";
                const instanceId = instance.InstanceId;

                const baseResult: any = {
                    instanceName,
                    instanceId,
                    ip: privateIp || "N/A",
                    os: osTag,
                    platform,
                    state,
                    services: {
                        zabbixAgent: "error",
                        crowdStrike: "error",
                        qualys: "error",
                        cloudWatch: "error",
                        alloy: "error",
                    },
                    versions: {
                        zabbixAgent: "N/A",
                        crowdStrike: "N/A",
                        qualys: "N/A",
                        cloudWatch: "N/A",
                        alloy: "N/A"
                    },
                    error: null
                };

                if (!privateIp) {
                    baseResult.error = "No private IP";
                    results.push(baseResult);
                    continue;
                }

                const ssh = new NodeSSH();

                try {
                    // Detect if it's a Windows or Linux instance
                    const isWindows = instance.Platform === "windows" || osTag.toLowerCase().includes("windows");

                    // Add timeout to SSH connection to fail fast if unreachable
                    const sshConfig: any = {
                        host: privateIp,
                        username: sshUsername,
                        readyTimeout: 10000,  // 10 seconds timeout for connection ready
                        timeout: 15000,       // 15 seconds overall timeout
                    };

                    // Use password for Windows, private key for Linux
                    if (isWindows && windowsPassword) {
                        sshConfig.password = windowsPassword;
                        console.log(`🔐 Connecting to Windows instance ${privateIp} with password authentication`);
                    } else {
                        sshConfig.privateKey = privateKey;
                    }

                    await ssh.connect(sshConfig);

                    console.log(`✅ SSH connected to ${privateIp} (${instanceId})`);

                    let servicesToCheck: any[] = [];

                    if (isWindows) {
                        // Windows-specific service checks using PowerShell
                        servicesToCheck = [
                            {
                                service: "Zabbix Agent 2",
                                displayName: "zabbixAgent",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'Zabbix Agent 2' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { $path = 'C:\\Program Files\\Zabbix Agent 2\\zabbix_agent2.exe'; if (Test-Path $path) { & $path --version 2>$null | Select-Object -First 1 | ForEach-Object { if ($_ -match '([0-9]+\\.[0-9]+\\.[0-9]+)') { $matches[1] } else { 'N/A' } } } else { 'N/A' } } catch { 'N/A' }"`
                            },
                            {
                                service: "CSFalconService",
                                displayName: "crowdStrike",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'CSFalconService' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { $path = 'C:\\Program Files\\CrowdStrike\\CSFalconService.exe'; if (Test-Path $path) { (Get-ItemProperty $path).VersionInfo.FileVersion } else { 'N/A' } } catch { 'N/A' }"`
                            },
                            {
                                service: "QualysAgent",
                                displayName: "qualys",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'QualysAgent' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { $path = 'C:\\Program Files\\Qualys\\QualysAgent\\QualysAgent.exe'; if (Test-Path $path) { (Get-ItemProperty $path).VersionInfo.FileVersion } else { 'N/A' } } catch { 'N/A' }"`
                            },
                            {
                                service: "AmazonCloudWatchAgent",
                                displayName: "cloudWatch",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'AmazonCloudWatchAgent' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { & 'C:\\Program Files\\Amazon\\AmazonCloudWatchAgent\\amazon-cloudwatch-agent-ctl.ps1' -m ec2 -a query 2>$null | Select-String -Pattern 'version' | ForEach-Object { if ($_ -match '([0-9]+\\.[0-9]+\\.[0-9]+)') { $matches[1] } else { 'N/A' } } } catch { 'N/A' }"`
                            },
                            {
                                service: "Alloy",
                                displayName: "alloy",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'Alloy' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { $paths = @('C:\\Program Files\\GrafanaLabs\\Alloy\\alloy.exe', 'C:\\Program Files\\Alloy\\alloy.exe'); foreach ($path in $paths) { if (Test-Path $path) { & $path --version 2>$null | Select-Object -First 1 | ForEach-Object { if ($_ -match '([0-9]+\\.[0-9]+\\.[0-9]+)') { $matches[1] } else { 'N/A' } }; break } } if (-not $found) { 'N/A' } } catch { 'N/A' }"`
                            },
                        ];
                    } else {
                        // Linux-specific service checks
                        servicesToCheck = [
                            {
                                service: "zabbix-agent2",
                                displayName: "zabbixAgent",
                                statusCmd: `systemctl is-active zabbix-agent2`,
                                versionCmd: `(zabbix_agent2 --version 2>/dev/null || /usr/sbin/zabbix_agent2 --version 2>/dev/null || /usr/bin/zabbix_agent2 --version 2>/dev/null) | head -n1 | awk '{print $3}' || echo "N/A"`
                            },
                            {
                                service: "falcon-sensor",
                                displayName: "crowdStrike",
                                statusCmd: `systemctl is-active falcon-sensor`,
                                versionCmd: `sudo -n /opt/CrowdStrike/falconctl -g --version 2>/dev/null | awk -F'= ' '{print $2}' || echo "N/A"`
                            },
                            {
                                service: "qualys-cloud-agent",
                                displayName: "qualys",
                                statusCmd: `systemctl is-active qualys-cloud-agent`,
                                versionCmd: `sudo -n cat /var/log/qualys/qualys-cloud-agent.log 2>/dev/null | grep "Current Agent Version" | tail -n1 | sed -n 's/.*Current Agent Version : \\(.*\\) Available.*/\\1/p' || echo "N/A"`
                            },
                            {
                                service: "amazon-cloudwatch-agent",
                                displayName: "cloudWatch",
                                statusCmd: `systemctl is-active amazon-cloudwatch-agent`,
                                versionCmd: `/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status 2>/dev/null | grep -i version | awk -F'"' '{print $4}' || echo "N/A"`
                            },
                            {
                                service: "alloy",
                                displayName: "alloy",
                                statusCmd: `systemctl is-active alloy`,
                                versionCmd: `(alloy --version 2>/dev/null || /usr/bin/alloy --version 2>/dev/null || /usr/local/bin/alloy --version 2>/dev/null) | head -n1 | grep -oP 'v?\\d+\\.\\d+\\.\\d+' | head -n1 | sed 's/^v//' || echo "N/A"`
                            },
                        ];
                    }

                    for (const { service, displayName, statusCmd, versionCmd } of servicesToCheck) {
                        const statusResult = await ssh.execCommand(statusCmd || `systemctl is-active ${service}`);
                        const versionResult = await ssh.execCommand(versionCmd);

                        // Map Windows service status to standard format
                        let status = statusResult.stdout.trim() || statusResult.stderr.trim() || "Unknown";
                        if (isWindows) {
                            // Windows service status mapping: Running -> active, Stopped -> inactive
                            if (status === "Running") status = "active";
                            else if (status === "Stopped") status = "inactive";
                            else if (status === "NotFound") status = "inactive";
                        }
                        baseResult.services[displayName] = status;

                        const rawVersion = versionResult.stdout.trim() || versionResult.stderr.trim() || "Unknown";
                        if (rawVersion !== "Unknown" && !isNaN(parseFloat(rawVersion))) {
                            baseResult.versions[displayName] = parseFloat(rawVersion).toFixed(2);
                        } else {
                            baseResult.versions[displayName] = rawVersion !== "Unknown" ? rawVersion : "Unknown";
                        }
                    }

                } catch (sshErr: any) {
                    console.log(`❌ SSH failed for ${privateIp} (${instanceId}): ${sshErr.message}`);
                    baseResult.error = `SSH Error: ${sshErr.message}`;
                } finally {
                    ssh.dispose();
                }

                results.push(baseResult);
            }

            const statusRecord = results.map((result: any) => ({
                ...result,
                awsKeyId: keyId,
            }));

            await StatusRecordDao.addStatusRecord(statusRecord);

            return {
                success: true,
                operatingSystem,
                totalInstances: results.length,
                results
            };

        } catch (err) {
            console.error("Error fetching instance details or checking status:", err);
            return {
                success: false,
                message: (err as Error).message || "Unexpected error occurred",
            };
        }
    }

    static async getAllInstanceDetailsWithNginxStatusToSaveInS3(
        keyId: any,
        sshUsername: string,
        privateKeyRelativePath: string,
        operatingSystem: string,
        windowsPassword?: string
    ) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const ec2Client = new EC2Client(awsConfig);
            const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
            const instances = data.Reservations.flatMap((res: any) => res.Instances);

            const results: any[] = [];
            const privateKeyPath = await SSHKeyService.getSSHkeyById(privateKeyRelativePath);
            if (!privateKeyPath) {
                throw new Error("Private key not found");
            }

            const privateKey = privateKeyPath.sshkey;

            const filteredInstances = instances.filter((instance: any) => {
                const isRunning = instance.State?.Name === "running";
                const tags = instance.Tags || [];
                const osTag = tags.find((tag: any) => tag.Key === "Operating_System");

                return (
                    isRunning &&
                    osTag &&
                    osTag.Value.toLowerCase().includes(operatingSystem.toLowerCase())
                    // Removed Windows exclusion to support Windows servers
                );
            });

            if (filteredInstances.length === 0) {
                return {
                    message: `No running instance found with provided operating system ${operatingSystem}`,
                    operatingSystem,
                    error: true,
                    success: false
                };
            }

            for (const instance of filteredInstances) {
                const privateIp = instance.PrivateIpAddress;

                const instanceName = instance.Tags?.find((tag: any) => tag.Key === "Name")?.Value || "Unknown";
                const osTag = instance.Tags?.find((tag: any) => tag.Key === "Operating_System")?.Value || "Unknown";
                const platform = instance.PlatformDetails || "Unknown";
                const state = instance.State?.Name || "Unknown";
                const instanceId = instance.InstanceId;

                const baseResult: any = {
                    instanceName,
                    instanceId,
                    ip: privateIp || "N/A",
                    os: osTag,
                    platform,
                    state,
                    services: {
                        zabbixAgent: "error",
                        crowdStrike: "error",
                        qualys: "error",
                        cloudWatch: "error",
                        alloy: "error",
                    },
                    versions: {
                        zabbixAgent: "N/A",
                        crowdStrike: "N/A",
                        qualys: "N/A",
                        cloudWatch: "N/A",
                        alloy: "N/A"
                    },
                    error: null
                };

                if (!privateIp) {
                    baseResult.error = "No private IP";
                    results.push(baseResult);
                    continue;
                }

                const ssh = new NodeSSH();

                try {
                    // Detect if it's a Windows or Linux instance
                    const isWindows = instance.Platform === "windows" || osTag.toLowerCase().includes("windows");

                    // Add timeout to SSH connection to fail fast if unreachable
                    const sshConfig: any = {
                        host: privateIp,
                        username: sshUsername,
                        readyTimeout: 10000,  // 10 seconds timeout for connection ready
                        timeout: 15000,       // 15 seconds overall timeout
                    };

                    // Use password for Windows, private key for Linux
                    if (isWindows && windowsPassword) {
                        sshConfig.password = windowsPassword;
                        console.log(`🔐 Connecting to Windows instance ${privateIp} with password authentication`);
                    } else {
                        sshConfig.privateKey = privateKey;
                    }

                    await ssh.connect(sshConfig);

                    console.log(`✅ SSH connected to ${privateIp} (${instanceId})`);

                    let servicesToCheck: any[] = [];

                    if (isWindows) {
                        // Windows-specific service checks using PowerShell
                        servicesToCheck = [
                            {
                                service: "Zabbix Agent 2",
                                displayName: "zabbixAgent",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'Zabbix Agent 2' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { $path = 'C:\\Program Files\\Zabbix Agent 2\\zabbix_agent2.exe'; if (Test-Path $path) { & $path --version 2>$null | Select-Object -First 1 | ForEach-Object { if ($_ -match '([0-9]+\\.[0-9]+\\.[0-9]+)') { $matches[1] } else { 'N/A' } } } else { 'N/A' } } catch { 'N/A' }"`
                            },
                            {
                                service: "CSFalconService",
                                displayName: "crowdStrike",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'CSFalconService' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { $path = 'C:\\Program Files\\CrowdStrike\\CSFalconService.exe'; if (Test-Path $path) { (Get-ItemProperty $path).VersionInfo.FileVersion } else { 'N/A' } } catch { 'N/A' }"`
                            },
                            {
                                service: "QualysAgent",
                                displayName: "qualys",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'QualysAgent' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { $path = 'C:\\Program Files\\Qualys\\QualysAgent\\QualysAgent.exe'; if (Test-Path $path) { (Get-ItemProperty $path).VersionInfo.FileVersion } else { 'N/A' } } catch { 'N/A' }"`
                            },
                            {
                                service: "AmazonCloudWatchAgent",
                                displayName: "cloudWatch",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'AmazonCloudWatchAgent' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { & 'C:\\Program Files\\Amazon\\AmazonCloudWatchAgent\\amazon-cloudwatch-agent-ctl.ps1' -m ec2 -a query 2>$null | Select-String -Pattern 'version' | ForEach-Object { if ($_ -match '([0-9]+\\.[0-9]+\\.[0-9]+)') { $matches[1] } else { 'N/A' } } } catch { 'N/A' }"`
                            },
                            {
                                service: "Alloy",
                                displayName: "alloy",
                                statusCmd: `powershell -Command "try { $s = Get-Service 'Alloy' -ErrorAction Stop; $s.Status } catch { 'NotFound' }"`,
                                versionCmd: `powershell -Command "try { $paths = @('C:\\Program Files\\GrafanaLabs\\Alloy\\alloy.exe', 'C:\\Program Files\\Alloy\\alloy.exe'); foreach ($path in $paths) { if (Test-Path $path) { & $path --version 2>$null | Select-Object -First 1 | ForEach-Object { if ($_ -match '([0-9]+\\.[0-9]+\\.[0-9]+)') { $matches[1] } else { 'N/A' } }; break } } if (-not $found) { 'N/A' } } catch { 'N/A' }"`
                            },
                        ];
                    } else {
                        // Linux-specific service checks
                        servicesToCheck = [
                            {
                                service: "zabbix-agent2",
                                displayName: "zabbixAgent",
                                statusCmd: `systemctl is-active zabbix-agent2`,
                                versionCmd: `(zabbix_agent2 --version 2>/dev/null || /usr/sbin/zabbix_agent2 --version 2>/dev/null || /usr/bin/zabbix_agent2 --version 2>/dev/null) | head -n1 | awk '{print $3}' || echo "N/A"`
                            },
                            {
                                service: "falcon-sensor",
                                displayName: "crowdStrike",
                                statusCmd: `systemctl is-active falcon-sensor`,
                                versionCmd: `sudo -n /opt/CrowdStrike/falconctl -g --version 2>/dev/null | awk -F'= ' '{print $2}' || echo "N/A"`
                            },
                            {
                                service: "qualys-cloud-agent",
                                displayName: "qualys",
                                statusCmd: `systemctl is-active qualys-cloud-agent`,
                                versionCmd: `sudo -n cat /var/log/qualys/qualys-cloud-agent.log 2>/dev/null | grep "Current Agent Version" | tail -n1 | sed -n 's/.*Current Agent Version : \\(.*\\) Available.*/\\1/p' || echo "N/A"`
                            },
                            {
                                service: "amazon-cloudwatch-agent",
                                displayName: "cloudWatch",
                                statusCmd: `systemctl is-active amazon-cloudwatch-agent`,
                                versionCmd: `/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status 2>/dev/null | grep -i version | awk -F'"' '{print $4}' || echo "N/A"`
                            },
                            {
                                service: "alloy",
                                displayName: "alloy",
                                statusCmd: `systemctl is-active alloy`,
                                versionCmd: `(alloy --version 2>/dev/null || /usr/bin/alloy --version 2>/dev/null || /usr/local/bin/alloy --version 2>/dev/null) | head -n1 | grep -oP 'v?\\d+\\.\\d+\\.\\d+' | head -n1 | sed 's/^v//' || echo "N/A"`
                            },
                        ];
                    }

                    for (const { service, displayName, statusCmd, versionCmd } of servicesToCheck) {
                        const statusResult = await ssh.execCommand(statusCmd || `systemctl is-active ${service}`);
                        const versionResult = await ssh.execCommand(versionCmd);

                        // Map Windows service status to standard format
                        let status = statusResult.stdout.trim() || statusResult.stderr.trim() || "Unknown";
                        if (isWindows) {
                            // Windows service status mapping: Running -> active, Stopped -> inactive
                            if (status === "Running") status = "active";
                            else if (status === "Stopped") status = "inactive";
                            else if (status === "NotFound") status = "inactive";
                        }
                        baseResult.services[displayName] = status;

                        const rawVersion = versionResult.stdout.trim() || versionResult.stderr.trim() || "Unknown";
                        if (rawVersion !== "Unknown" && !isNaN(parseFloat(rawVersion))) {
                            baseResult.versions[displayName] = parseFloat(rawVersion).toFixed(2);
                        } else {
                            baseResult.versions[displayName] = rawVersion !== "Unknown" ? rawVersion : "Unknown";
                        }
                    }

                } catch (sshErr: any) {
                    console.log(`❌ SSH failed for ${privateIp} (${instanceId}): ${sshErr.message}`);
                    baseResult.error = `SSH Error: ${sshErr.message}`;
                } finally {
                    ssh.dispose();
                }

                results.push(baseResult);
            }

            // const statusRecord = results.map((result: any) => ({
            //     ...result,
            //     awsKeyId: keyId,
            // }));

            // await StatusRecordDao.addStatusRecord(statusRecord);

            return {
                success: true,
                data: results,
                operatingSystem,
                environment: awsConfig.enviroment,
                totalInstances: results.length,
                results
            };

        } catch (err) {
            console.error("Error fetching instance details or checking status:", err);
            return {
                success: false,
                message: (err as Error).message || "Unexpected error occurred",
            };
        }
    }

    /**
     * Get agent status dashboard with statistics
     * Fetches all latest agent status records from DB for a given AWS key
     * Supports optional date range filtering
     */
    static async getAgentStatusDashboard(keyId: string, startDate?: string, endDate?: string) {
        try {
            const dashboardData = await StatusRecordDao.getAgentStatusDashboardStats(keyId, startDate, endDate);
            return {
                success: true,
                data: dashboardData
            };
        } catch (err) {
            console.error("❌ Error fetching agent status dashboard:", err);
            return {
                success: false,
                message: (err as Error).message || "Failed to fetch agent status dashboard"
            };
        }
    }

    /**
     * Get live agent status directly from instances via SSH
     * Checks all SSH usernames and operating systems
     * Returns real-time status and saves to DB
     * @param keyId - AWS key ID
     * @param windowsUsername - Optional Windows username (overrides default "Administrator")
     * @param windowsPassword - Optional Windows password for authentication
     */
    static async getLiveAgentStatus(keyId: string, windowsUsername?: string, windowsPassword?: string) {
        try {
            console.log("🔄 Fetching live agent status for keyId:", keyId);
            const masterKey: any = CONFIG.masterKey;
            if (!masterKey) {
                throw new Error("Master key is not defined");
            }

            // Use provided Windows username or default to "Administrator"
            const winUser = windowsUsername || "Administrator";
            const sshUsernames = ["awx", "centos", "ec2-user", "ubuntu", winUser];
            const operatingSystems: any = {
                "awx": ["rocky"],
                "centos": ["centos"],
                "ec2-user": ["amazon", "suse"],  // Changed to "amazon" to match both "Amazon_Linux" and "Amazon Linux"
                "ubuntu": ["ubuntu"],
                [winUser]: ["windows"],  // Windows Server support with dynamic username
            };

            let allResults: any[] = [];

            for (let sshUsername of sshUsernames) {
                const osList = operatingSystems[sshUsername] || ["unknown"];
                for (let os of osList) {
                    try {
                        console.log(`🔍 Checking status for ${sshUsername} (${os})`);
                        const data: any = await this.getAllInstanceDetailsWithNginxStatus(
                            keyId,
                            sshUsername,
                            masterKey,
                            os,
                            windowsPassword  // Pass Windows password for Windows instances
                        );

                        if (data.success && data.results) {
                            allResults = allResults.concat(data.results);
                        }
                    } catch (err) {
                        console.error(`❌ Error checking status for ${sshUsername} (${os}):`, err);
                    }
                }
            }

            // Remove duplicates based on instanceId, keeping the one with most data
            const uniqueResults = Array.from(
                allResults.reduce((map, item) => {
                    const existing = map.get(item.instanceId);
                    if (!existing || (item.services && Object.keys(item.services).length > Object.keys(existing.services || {}).length)) {
                        map.set(item.instanceId, item);
                    }
                    return map;
                }, new Map()).values()
            );

            console.log(`✅ Fetched live status for ${uniqueResults.length} unique instances`);

            // Calculate stats
            const stats = {
                totalServers: uniqueResults.length,
                zabbixAgent: { active: 0, inactive: 0, total: 0 },
                crowdStrike: { active: 0, inactive: 0, total: 0 },
                qualys: { active: 0, inactive: 0, total: 0 },
                cloudWatch: { active: 0, inactive: 0, total: 0 },
                alloy: { active: 0, inactive: 0, total: 0 },
                byOS: {} as any,
                byState: {} as any
            };

            uniqueResults.forEach((record: any) => {
                // Count by agent status
                if (record.services?.zabbixAgent === "active") stats.zabbixAgent.active++;
                else stats.zabbixAgent.inactive++;
                stats.zabbixAgent.total++;

                if (record.services?.crowdStrike === "active") stats.crowdStrike.active++;
                else stats.crowdStrike.inactive++;
                stats.crowdStrike.total++;

                if (record.services?.qualys === "active") stats.qualys.active++;
                else stats.qualys.inactive++;
                stats.qualys.total++;

                if (record.services?.cloudWatch === "active") stats.cloudWatch.active++;
                else stats.cloudWatch.inactive++;
                stats.cloudWatch.total++;

                if (record.services?.alloy === "active") stats.alloy.active++;
                else stats.alloy.inactive++;
                stats.alloy.total++;

                // Count by OS
                const os = record.os || "Unknown";
                if (!stats.byOS[os]) stats.byOS[os] = 0;
                stats.byOS[os]++;

                // Count by state
                const state = record.state || "Unknown";
                if (!stats.byState[state]) stats.byState[state] = 0;
                stats.byState[state]++;
            });

            return {
                success: true,
                data: {
                    stats,
                    records: uniqueResults
                }
            };
        } catch (err) {
            console.error("❌ Error fetching live agent status:", err);
            return {
                success: false,
                message: (err as Error).message || "Failed to fetch live agent status"
            };
        }
    }

    /**
     * Get Zabbix status from DB (existing method, kept for compatibility)
     */
    static async getZabbixStatusFromDB(keyId: string, startDate: string, endDate: string, operatingSystem: string) {
        try {
            const records = await StatusRecordDao.getZabbixStatusFromDB(keyId, startDate, endDate, operatingSystem);
            return {
                success: true,
                data: records
            };
        } catch (err) {
            console.error("❌ Error fetching Zabbix status from DB:", err);
            return {
                success: false,
                message: (err as Error).message || "Failed to fetch Zabbix status"
            };
        }
    }

}

