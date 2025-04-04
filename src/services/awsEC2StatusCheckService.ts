import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { SSMClient, SendCommandCommand, GetCommandInvocationCommand, DescribeInstanceInformationCommand } from "@aws-sdk/client-ssm";
import { AWSKeyService } from "./awsKeyService";
import { NodeSSH } from "node-ssh";
import fs from "fs";
import path from "path";
import { CONFIG } from "../config/environment";

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


    static async getAllInstanceDetailsWithNginxStatus(
        keyId: any,
        sshUsername: string,
        privateKeyRelativePath: string
      ) {
        try {
          const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
          const ec2Client = new EC2Client(awsConfig);
          const data: any = await ec2Client.send(new DescribeInstancesCommand({}));
          const instances = data.Reservations.flatMap((res: any) => res.Instances);
    
          const ssh = new NodeSSH();
          const results: any[] = [];
    
          const privateKeyPath = path.resolve(CONFIG.sshKeyFolderPath, privateKeyRelativePath);
          console.log("Using private key path:", privateKeyPath);
          const privateKey = fs.readFileSync(privateKeyPath, "utf8");
    
          const TARGET_IP = "10.35.58.225";
    
          for (const instance of instances) {
            const privateIp = instance.PrivateIpAddress;
    
            if (privateIp !== TARGET_IP) {
                console.log(`Skipping instance ${instance.InstanceId} with IP ${privateIp}`);
              continue; // Skip all other instances
            }
    
            if (!privateIp) {
              results.push({ instanceId: instance.InstanceId, status: "No private IP" });
              continue;
            }
    
            try {
              await ssh.connect({
                host: privateIp,
                username: sshUsername,
                privateKey: privateKey,
              });
    
              console.log(`✅ SSH connected to ${privateIp} (${instance.InstanceId})`);
    
              const result = await ssh.execCommand("systemctl is-active nginx");
    
              results.push({
                instanceId: instance.InstanceId,
                ip: privateIp,
                nginxStatus: result.stdout.trim() || result.stderr.trim(),
              });
    
              ssh.dispose();
            } catch (sshErr: any) {
              results.push({
                instanceId: instance.InstanceId,
                ip: privateIp,
                nginxStatus: `SSH Error: ${sshErr.message}`,
              });
            }
          }
    
          return results;
        } catch (err) {
          console.error("Error fetching instance details or nginx status:", err);
          throw err;
        }
    }

}

