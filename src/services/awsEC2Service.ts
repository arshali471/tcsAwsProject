import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { CONFIG } from "../config/environment";
import { AWSKeyService } from "./awsKeyService";
import { EC2Dao } from "../lib/dao/ec2.dao";
import { AWSKeyDao } from "../lib/dao/awsKey.dao";



export class EC2InstanceService {
    static async getAllInstanceDetails(keyId: any) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const environment = String(awsConfig.enviroment);
            const ec2Client = new EC2Client(awsConfig);
            const data: any = await ec2Client.send(new DescribeInstancesCommand({}));

            const instances: any = [];
            if (data.Reservations) {
                for (const reservation of data.Reservations) {
                    if (reservation.Instances) {
                        reservation.Instances.forEach((instance: any) => {
                            instances.push({ ...instance, environment });
                        });
                    }
                }
            }

            return instances;
        } catch (err) {
            console.error("Error fetching instance details:", err);
            throw err;
        }
    }

    static async getAllInstancesFromAllRegions() {
        try {
            // Get all AWS keys WITH credentials (different environments/regions)
            const allKeys = await AWSKeyDao.getAllAWSKeyWithCredentials();

            const allInstances: any = [];
            const errors: any = [];

            // Fetch instances from each AWS account/region
            for (const key of allKeys) {
                try {
                    const awsConfig = {
                        region: key.region,
                        credentials: {
                            accessKeyId: key.accessKeyId,
                            secretAccessKey: key.secretAccessKey
                        }
                    };

                    const environment = String(key.enviroment);
                    const ec2Client = new EC2Client(awsConfig);
                    const data: any = await ec2Client.send(new DescribeInstancesCommand({}));

                    if (data.Reservations) {
                        for (const reservation of data.Reservations) {
                            if (reservation.Instances) {
                                reservation.Instances.forEach((instance: any) => {
                                    // Get instance name from tags
                                    const nameTag = instance.Tags?.find((tag: any) => tag.Key === 'Name');
                                    const instanceName = nameTag ? nameTag.Value : 'N/A';

                                    allInstances.push({
                                        InstanceId: instance.InstanceId,
                                        InstanceName: instanceName,
                                        InstanceType: instance.InstanceType,
                                        State: instance.State?.Name || 'unknown',
                                        PrivateIpAddress: instance.PrivateIpAddress || 'N/A',
                                        PublicIpAddress: instance.PublicIpAddress || 'N/A',
                                        AvailabilityZone: instance.Placement?.AvailabilityZone || 'N/A',
                                        LaunchTime: instance.LaunchTime,
                                        Platform: instance.Platform || 'Linux/UNIX',
                                        VpcId: instance.VpcId || 'N/A',
                                        SubnetId: instance.SubnetId || 'N/A',
                                        KeyName: instance.KeyName || 'N/A',
                                        Environment: environment,
                                        Region: key.region,
                                        Tags: instance.Tags || []
                                    });
                                });
                            }
                        }
                    }
                } catch (err: any) {
                    console.error(`Error fetching instances from ${key.region} (${key.enviroment}):`, err.message);
                    errors.push({
                        region: key.region,
                        environment: key.enviroment,
                        error: err.message
                    });
                }
            }

            return {
                instances: allInstances,
                totalCount: allInstances.length,
                runningCount: allInstances.filter((i: any) => i.State === 'running').length,
                stoppedCount: allInstances.filter((i: any) => i.State === 'stopped').length,
                errors: errors.length > 0 ? errors : null
            };
        } catch (err) {
            console.error("Error fetching instances from all regions:", err);
            throw err;
        }
    }

    static async getInstanceDetailsByInstanceId(instanceId: any, keyId: any) {
        try {
            const params = {
                InstanceIds: [instanceId]
            };
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const ec2Client = new EC2Client(awsConfig);
            const command = new DescribeInstancesCommand(params);
            const response: any = await ec2Client.send(command);
            return response.Reservations.length > 0 ? response.Reservations[0].Instances[0] : null;
        } catch (err) {
            console.error("Error fetching EC2 instance details:", err);
            throw err;
        }
    }

    static async saveInstanceDetails(data: any, environment: any) {
        return await EC2Dao.saveInstanceDetails(data, environment);
    }

    static async getInstancesByDate(date: string, environment: string) {
        return await EC2Dao.getInstancesByDate(date, environment);
    }

    /**
     * Get all EC2 instances that are part of EKS clusters from all regions
     * EKS instances are identified by tags like:
     * - kubernetes.io/cluster/<cluster-name> = owned
     * - eks:cluster-name = <cluster-name>
     * - eks:nodegroup-name = <nodegroup-name>
     */
    static async getAllEKSEC2InstancesFromAllRegions() {
        try {
            // Get all AWS keys WITH credentials (different environments/regions)
            const allKeys = await AWSKeyDao.getAllAWSKeyWithCredentials();

            const allEKSInstances: any = [];
            const errors: any = [];

            // Fetch EKS EC2 instances from each AWS account/region
            for (const key of allKeys) {
                try {
                    const awsConfig = {
                        region: key.region,
                        credentials: {
                            accessKeyId: key.accessKeyId,
                            secretAccessKey: key.secretAccessKey
                        }
                    };

                    const environment = String(key.enviroment);
                    const ec2Client = new EC2Client(awsConfig);

                    // Fetch all instances
                    const data: any = await ec2Client.send(new DescribeInstancesCommand({}));

                    if (data.Reservations) {
                        for (const reservation of data.Reservations) {
                            if (reservation.Instances) {
                                reservation.Instances.forEach((instance: any) => {
                                    // Check if instance is part of an EKS cluster
                                    const tags = instance.Tags || [];
                                    const isEKSInstance = tags.some((tag: any) =>
                                        tag.Key?.startsWith('kubernetes.io/cluster/') ||
                                        tag.Key === 'eks:cluster-name' ||
                                        tag.Key === 'alpha.eksctl.io/cluster-name'
                                    );

                                    if (isEKSInstance) {
                                        // Extract EKS-specific information from tags
                                        const clusterNameTag = tags.find((tag: any) =>
                                            tag.Key === 'eks:cluster-name' ||
                                            tag.Key === 'alpha.eksctl.io/cluster-name'
                                        );
                                        const nodeGroupTag = tags.find((tag: any) =>
                                            tag.Key === 'eks:nodegroup-name' ||
                                            tag.Key === 'alpha.eksctl.io/nodegroup-name'
                                        );
                                        const k8sClusterTag = tags.find((tag: any) =>
                                            tag.Key?.startsWith('kubernetes.io/cluster/')
                                        );

                                        const clusterName = clusterNameTag?.Value ||
                                                          (k8sClusterTag ? k8sClusterTag.Key.replace('kubernetes.io/cluster/', '') : 'N/A');
                                        const nodeGroupName = nodeGroupTag?.Value || 'N/A';

                                        // Get instance name from tags
                                        const nameTag = tags.find((tag: any) => tag.Key === 'Name');
                                        const instanceName = nameTag?.Value || 'N/A';

                                        allEKSInstances.push({
                                            InstanceId: instance.InstanceId,
                                            InstanceName: instanceName,
                                            ClusterName: clusterName,
                                            NodeGroupName: nodeGroupName,
                                            InstanceType: instance.InstanceType,
                                            State: instance.State?.Name || 'unknown',
                                            PrivateIpAddress: instance.PrivateIpAddress || 'N/A',
                                            PublicIpAddress: instance.PublicIpAddress || 'N/A',
                                            AvailabilityZone: instance.Placement?.AvailabilityZone || 'N/A',
                                            LaunchTime: instance.LaunchTime,
                                            Platform: instance.Platform || 'Linux/UNIX',
                                            VpcId: instance.VpcId || 'N/A',
                                            SubnetId: instance.SubnetId || 'N/A',
                                            KeyName: instance.KeyName || 'N/A',
                                            Environment: environment,
                                            Region: key.region,
                                            Tags: tags
                                        });
                                    }
                                });
                            }
                        }
                    }
                } catch (err: any) {
                    console.error(`Error fetching EKS instances from ${key.region} (${key.enviroment}):`, err.message);
                    errors.push({
                        region: key.region,
                        environment: key.enviroment,
                        error: err.message
                    });
                }
            }

            // Count unique clusters
            const uniqueClusters = new Set(allEKSInstances.map((i: any) => i.ClusterName));

            return {
                instances: allEKSInstances,
                totalCount: allEKSInstances.length,
                runningCount: allEKSInstances.filter((i: any) => i.State === 'running').length,
                stoppedCount: allEKSInstances.filter((i: any) => i.State === 'stopped').length,
                clusterCount: uniqueClusters.size,
                errors: errors.length > 0 ? errors : null
            };
        } catch (err) {
            console.error("Error fetching EKS EC2 instances from all regions:", err);
            throw err;
        }
    }
}


