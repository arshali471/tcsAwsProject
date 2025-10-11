import { S3Client, ListBucketsCommand, GetBucketLocationCommand } from "@aws-sdk/client-s3";
import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";

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
                    startDate.setDate(startDate.getDate() - 7); // Set start date to 7 days before to ensure we have data

                    // Query multiple storage types to get complete bucket size
                    const storageTypes = ['StandardStorage', 'IntelligentTieringFAStorage', 'IntelligentTieringIAStorage', 'StandardIAStorage', 'OneZoneIAStorage', 'ReducedRedundancyStorage', 'GlacierInstantRetrievalStorage', 'GlacierStorage', 'DeepArchiveStorage'];

                    const metricQueries = storageTypes.map((storageType, index) => ({
                        Id: `bucketSize${index}`,
                        MetricStat: {
                            Metric: {
                                Namespace: 'AWS/S3',
                                MetricName: 'BucketSizeBytes',
                                Dimensions: [
                                    { Name: 'BucketName', Value: bucketName },
                                    { Name: 'StorageType', Value: storageType },
                                ],
                            },
                            Period: 86400, // One day in seconds
                            Stat: 'Average',
                        },
                    }));

                    const metricData = await cloudWatchClient.send(new GetMetricDataCommand({
                        StartTime: startDate,
                        EndTime: endDate,
                        MetricDataQueries: metricQueries,
                    }));

                    // Sum up sizes from all storage types, taking the most recent non-zero value
                    let totalSize = 0;
                    metricData.MetricDataResults?.forEach((result) => {
                        const values = result.Values || [];
                        // Get the latest non-zero value
                        const latestValue = values.find(v => v > 0) || 0;
                        totalSize += latestValue;
                    });

                    size = totalSize;
                } catch (error: any) {
                    console.error(`Error fetching size for bucket ${bucketName}:`, error.message);
                    size = 0; // Default to 0 instead of error object
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


