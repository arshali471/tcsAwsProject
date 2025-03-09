import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { DateTime } from "luxon";
import { AWSKeyService } from "./awsKeyService";

export class AWSRDSService {
    static async getRDSInstances(keyId: any) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const rdsClient = new RDSClient(awsConfig);

            // Fetch all RDS instances
            const rdsData = await rdsClient.send(new DescribeDBInstancesCommand({}));
            const instances = rdsData.DBInstances || [];

            // Format details
            const formattedInstances = instances.map((instance: any) => ({
                instanceId: instance.DBInstanceIdentifier,
                status: instance.DBInstanceStatus,
                engine: instance.Engine,
                engineVersion: instance.EngineVersion,
                storage: `${instance.AllocatedStorage} GB`, // Storage in GB
                instanceClass: instance.DBInstanceClass,
                vpcId: instance.DBSubnetGroup?.VpcId || "N/A",
                subnetGroup: instance.DBSubnetGroup?.DBSubnetGroupName || "N/A",
                availabilityZone: instance.AvailabilityZone,
                createdAt: instance.InstanceCreateTime ? DateTime.fromJSDate(instance.InstanceCreateTime).toISODate() : "Unknown",
                endpoint: instance.Endpoint?.Address || "N/A",
                securityGroups: instance.VpcSecurityGroups?.map((sg: any) => sg.VpcSecurityGroupId) || []
            }));

            return formattedInstances
        } catch (err) {
            console.error("Error fetching EKS cluster details:", err);
            throw err;
        }
    }
}
