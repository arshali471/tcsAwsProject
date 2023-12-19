import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { CONFIG } from "../config/environment";
import { AWSKeyService } from "./awsKeyService";



export class EC2InstanceService {
    static async getAllInstanceDetails(keyId: any) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId); 
            const ec2Client = new EC2Client(awsConfig);
            // Create an EC2 service object
            const data = await ec2Client.send(new DescribeInstancesCommand({}));
            return data;
        } catch (err) {
            console.error("Error fetching bucket details:", err);
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
}


