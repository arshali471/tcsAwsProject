import { S3Client, ListBucketsCommand, GetBucketLocationCommand } from "@aws-sdk/client-s3";
import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";

import { CONFIG } from "../config/environment";
import { AWSKeyService } from "./awsKeyService";

export class S3BucketService {
    static async getBucketDetails(keyId: any) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);

            // Initialize the S3 and CloudWatch clients
            const s3Client = new S3Client(awsConfig);
            const cloudWatchClient = new CloudWatchClient(awsConfig);
            const bucketsData = await s3Client.send(new ListBucketsCommand({}));
            const buckets: any = bucketsData.Buckets;

            const bucketDetailsPromises = buckets.map(async (bucket: any) => {
                const bucketName = bucket.Name;
                let location, creationDate, size;

                try {
                    const locationData = await s3Client.send(new GetBucketLocationCommand({ Bucket: bucketName }));
                    location = locationData.LocationConstraint || 'us-east-1'; // Default to us-east-1 if LocationConstraint is empty
                    creationDate = bucket.CreationDate;
                } catch (error: any) {
                    location = { error: error.message };
                }

                try {
                    const endDate = new Date();
                    const startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 1); // Set start date to 1 day before the current date

                    const metricData = await cloudWatchClient.send(new GetMetricDataCommand({
                        StartTime: startDate,
                        EndTime: endDate,
                        MetricDataQueries: [
                            {
                                Id: 'bucketSizeBytes',
                                MetricStat: {
                                    Metric: {
                                        Namespace: 'AWS/S3',
                                        MetricName: 'BucketSizeBytes',
                                        Dimensions: [
                                            { Name: 'BucketName', Value: bucketName },
                                            { Name: 'StorageType', Value: 'StandardStorage' },
                                        ],
                                    },
                                    Period: 86400, // One day in seconds
                                    Stat: 'Average',
                                },
                            },
                        ],
                    }));

                    size = metricData.MetricDataResults?.[0]?.Values?.[0] || 0; // Size in bytes
                } catch (error: any) {
                    size = { error: error.message };
                }

                return { bucketName, creationDate, location, size };
            });

            return await Promise.all(bucketDetailsPromises);
        } catch (err) {
            console.error("Error fetching bucket details:", err);
            throw err;
        }
    }
}


