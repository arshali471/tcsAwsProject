import { 
    EKSClient, ListClustersCommand, DescribeClusterCommand, 
    ListNodegroupsCommand, DescribeNodegroupCommand 
} from "@aws-sdk/client-eks";
import { AWSKeyService } from "./awsKeyService";// Fetch AWS credentials
import { EksDashboardDao } from "../lib/dao/eksDashboard.dao";

export class AWSEKSService {
    static async getAllEKSClusterDetails(keyId: any) {
        try {
            // Fetch AWS credentials
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const eksClient = new EKSClient(awsConfig);

            // Get all EKS clusters
            const clustersData = await eksClient.send(new ListClustersCommand({}));
            const clusterNames = clustersData.clusters || [];

            // Fetch details for each cluster
            const clusterDetails = await Promise.all(clusterNames.map(async (clusterName) => {
                const clusterData = await eksClient.send(new DescribeClusterCommand({ name: clusterName }));
                const cluster: any = clusterData.cluster;

                // Fetch node groups
                const nodeGroupsData = await eksClient.send(new ListNodegroupsCommand({ clusterName }));
                const nodeGroups = nodeGroupsData.nodegroups || [];

                // Fetch details for each node group
                const nodesDetails = await Promise.all(nodeGroups.map(async (nodeGroupName) => {
                    const nodeGroupData = await eksClient.send(new DescribeNodegroupCommand({ 
                        clusterName, 
                        nodegroupName: nodeGroupName 
                    }));

                    return {
                        nodeGroupName,
                        instanceTypes: nodeGroupData.nodegroup?.instanceTypes || [],
                        desiredCapacity: nodeGroupData.nodegroup?.scalingConfig?.desiredSize || 0,
                        minSize: nodeGroupData.nodegroup?.scalingConfig?.minSize || 0,
                        maxSize: nodeGroupData.nodegroup?.scalingConfig?.maxSize || 0,
                        nodeRole: nodeGroupData.nodegroup?.nodeRole || "Self-managed"
                    };
                }));

                // Determine provider type
                let providerType = "EKS";
                if (nodesDetails.length === 0) {
                    providerType = "Fargate"; // No nodes, likely Fargate
                } else if (nodesDetails.every(node => node.nodeRole === "Self-managed")) {
                    providerType = "Self-managed";
                }

                const eksToken = await EksDashboardDao.getEKSToken(clusterName, keyId);

                return {
                    name: cluster.name,
                    arn: cluster.arn,
                    status: cluster.status,
                    version: cluster.version,
                    createdAt: cluster.createdAt,
                    provider: providerType, // EKS, Fargate, or Self-managed
                    endpoint: cluster.endpoint,
                    roleArn: cluster.roleArn,
                    vpcId: cluster.resourcesVpcConfig?.vpcId,
                    subnets: cluster.resourcesVpcConfig?.subnetIds,
                    securityGroups: cluster.resourcesVpcConfig?.securityGroupIds,
                    nodes: nodesDetails,
                    logging: cluster.logging?.clusterLogging || [],
                    encryption: cluster.encryptionConfig || [],
                    ymlFileContent: eksToken?.ymlFileContent || "",
                    hasConfig: eksToken ? true : false
                };
            }));

            return clusterDetails;
        } catch (err) {
            console.error("Error fetching EKS cluster details:", err);
            throw err;
        }
    }

    static async getAllEKSClusterName(keyId: any) {
        try {
            // Fetch AWS credentials
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const eksClient = new EKSClient(awsConfig);

            // Get all EKS clusters
            const clustersData = await eksClient.send(new ListClustersCommand({}));
            const clusterNames = clustersData.clusters || [];

            // Fetch details for each cluster
            const clusterDetails = await Promise.all(clusterNames.map(async (clusterName) => {
                const clusterData = await eksClient.send(new DescribeClusterCommand({ name: clusterName }));
                const cluster: any = clusterData.cluster;

                // Fetch node groups
                const nodeGroupsData = await eksClient.send(new ListNodegroupsCommand({ clusterName }));
                const nodeGroups = nodeGroupsData.nodegroups || [];

                // Fetch details for each node group
                const nodesDetails = await Promise.all(nodeGroups.map(async (nodeGroupName) => {
                    const nodeGroupData = await eksClient.send(new DescribeNodegroupCommand({ 
                        clusterName, 
                        nodegroupName: nodeGroupName 
                    }));

                    return {
                        nodeGroupName,
                        instanceTypes: nodeGroupData.nodegroup?.instanceTypes || [],
                        desiredCapacity: nodeGroupData.nodegroup?.scalingConfig?.desiredSize || 0,
                        minSize: nodeGroupData.nodegroup?.scalingConfig?.minSize || 0,
                        maxSize: nodeGroupData.nodegroup?.scalingConfig?.maxSize || 0,
                        nodeRole: nodeGroupData.nodegroup?.nodeRole || "Self-managed"
                    };
                }));

                // Determine provider type
                let providerType = "EKS";
                if (nodesDetails.length === 0) {
                    providerType = "Fargate"; // No nodes, likely Fargate
                } else if (nodesDetails.every(node => node.nodeRole === "Self-managed")) {
                    providerType = "Self-managed";
                }

                return {
                    name: cluster.name
                };
            }));

            return clusterDetails;
        } catch (err) {
            console.error("Error fetching EKS cluster details:", err);
            throw err;
        }
    }

    static async addEKSToken(data: any) {
        return await EksDashboardDao.createEksToken(data);
    }

    static async updateEKSToken(id: any, data: any) {
        return await EksDashboardDao.updateEKSToken(id, data);
    }

    static async deleteEKSToken(id: any) {
        return await EksDashboardDao.deleteEKSToken(id);
    }

    static async getEKSTokenById(id: any) {
        return await EksDashboardDao.getEKSTokenById(id);
    }

    static async getEKSTokenByAWSKey(keyId: any) {
        return await EksDashboardDao.getEKSTokenByAWSKey(keyId);
    }

    static async getAllEKSToken(search: any, skip: number, limit: number) {
        return await EksDashboardDao.getAllEKSToken(search, skip, limit);
    }
}