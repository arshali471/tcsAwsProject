import { EC2Client, DescribeVolumesCommand } from "@aws-sdk/client-ec2";
import { DateTime } from "luxon";
import { AWSKeyService } from "./awsKeyService";

export class AWSVolumesService {
    static async getAllEBSVolumes(keyId: any) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const ec2Client = new EC2Client(awsConfig);

            // Fetch all EBS volumes
            const volumesData = await ec2Client.send(new DescribeVolumesCommand({}));
            const allVolumes = volumesData.Volumes || [];

            // Format volume details
            // const formattedVolumes = allVolumes.map((volume: any) => ({
            //     volumeId: volume.VolumeId,
            //     state: volume.State,
            //     size: `${volume.Size} GB`,
            //     volumeType: volume.VolumeType,
            //     iops: volume.Iops || "N/A",
            //     throughput: volume.Throughput || "N/A",
            //     snapshotId: volume.SnapshotId || "N/A",
            //     availabilityZone: volume.AvailabilityZone,
            //     encrypted: volume.Encrypted ? "Yes" : "No",
            //     createdAt: volume.CreateTime ? DateTime.fromJSDate(volume.CreateTime).toISODate() : "Unknown",
            //     attachedInstances: volume.Attachments?.map((att: any) => att.InstanceId) || []
            // }));

            const formattedVolumes = allVolumes.map((volume: any) => ({
                volumeId: volume.VolumeId,
                state: volume.State,
                size: `${volume.Size} GB`,
                volumeType: volume.VolumeType,
                iops: volume.Iops || "N/A",
                throughput: volume.Throughput || "N/A",
                snapshotId: volume.SnapshotId || "N/A",
                availabilityZone: volume.AvailabilityZone,
                encrypted: volume.Encrypted ? "Yes" : "No",
                kmsKeyId: volume.KmsKeyId || "N/A",
                multiAttachEnabled: volume.MultiAttachEnabled ? "Yes" : "No",
                createdAt: volume.CreateTime ? DateTime.fromJSDate(volume.CreateTime).toISODate() : "Unknown",
            
                // Extracting Attached Instances
                attachedInstances: volume.Attachments?.map((att: any) => att.InstanceId) || [],
            
                // Extracting Tags
                name: volume.Tags?.find((tag: any) => tag.Key === "Name")?.Value || "N/A",
                application: volume.Tags?.find((tag: any) => tag.Key === "Application")?.Value || "N/A",
                environment: volume.Tags?.find((tag: any) => tag.Key === "Environment")?.Value || "N/A",
                operatingSystem: volume.Tags?.find((tag: any) => tag.Key === "Operating_System")?.Value || "N/A",
                businessOwner: volume.Tags?.find((tag: any) => tag.Key === "Business_Owner")?.Value || "N/A",
                itltOwner: volume.Tags?.find((tag: any) => tag.Key === "ITLT_Owner")?.Value || "N/A",
                l1TechnicalOwner: volume.Tags?.find((tag: any) => tag.Key === "L1_Technical_Owner")?.Value || "N/A",
                l2TechnicalOwner: volume.Tags?.find((tag: any) => tag.Key === "L2_Technical_Owner")?.Value || "N/A",
                l3ItOwner: volume.Tags?.find((tag: any) => tag.Key === "L3_IT_Owner")?.Value || "N/A",
                department: volume.Tags?.find((tag: any) => tag.Key === "Department")?.Value || "N/A",
                function: volume.Tags?.find((tag: any) => tag.Key === "Function")?.Value || "N/A",
                awsService: volume.Tags?.find((tag: any) => tag.Key === "AWS_Service")?.Value || "N/A",
                costCenter: volume.Tags?.find((tag: any) => tag.Key === "Cost_Center")?.Value || "N/A",
                drGrouping: volume.Tags?.find((tag: any) => tag.Key === "DR_Grouping")?.Value || "N/A",
                dateInService: volume.Tags?.find((tag: any) => tag.Key === "Date_in_Service")?.Value || "N/A",
                retentionDays: volume.Tags?.find((tag: any) => tag.Key === "Retention")?.Value || "N/A",
                shutDownSchedule: volume.Tags?.find((tag: any) => tag.Key === "Shut_Down")?.Value || "N/A",
                startUpSchedule: volume.Tags?.find((tag: any) => tag.Key === "Start_Up")?.Value || "N/A",
                backup: volume.Tags?.find((tag: any) => tag.Key === "Backup")?.Value || "N/A",
                projectId: volume.Tags?.find((tag: any) => tag.Key === "Project_ID")?.Value || "N/A",
                sid: volume.Tags?.find((tag: any) => tag.Key === "SID")?.Value || "N/A",
                snowRITM: volume.Tags?.find((tag: any) => tag.Key === "SNOW_RITM")?.Value || "N/A",
            
                // AWS EMR-related Tags
                emrJobFlowId: volume.Tags?.find((tag: any) => tag.Key === "aws:elasticmapreduce:job-flow-id")?.Value || "N/A",
                emrInstanceGroupRole: volume.Tags?.find((tag: any) => tag.Key === "aws:elasticmapreduce:instance-group-role")?.Value || "N/A",
            }));


            return formattedVolumes;
        } catch (err) {
            console.error("Error fetching EBS volumes:", err);
            throw err;
        }
    }
}

