import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { CONFIG } from "../config/environment";
import { AWSKeyService } from "./awsKeyService";
import { EC2Dao } from "../lib/dao/ec2.dao";



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
}


