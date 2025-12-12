import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } from "@aws-sdk/client-cost-explorer";
import { AWSKeyService } from "./awsKeyService";
import { DateTime } from "luxon";

export class AWSCostService {
    /**
     * Get cost and usage data grouped by service
     * @param keyId - AWS Key ID
     * @param startDate - Start date in YYYY-MM-DD format
     * @param endDate - End date in YYYY-MM-DD format
     * @param granularity - DAILY, MONTHLY, or HOURLY
     */
    static async getCostByService(keyId: string, startDate: string, endDate: string, granularity: string = "DAILY") {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const costExplorerClient = new CostExplorerClient(awsConfig);

            const command = new GetCostAndUsageCommand({
                TimePeriod: {
                    Start: startDate,
                    End: endDate,
                },
                Granularity: granularity as any,
                Metrics: ["UnblendedCost", "UsageQuantity"],
                GroupBy: [
                    {
                        Type: "DIMENSION",
                        Key: "SERVICE",
                    },
                ],
            });

            const response = await costExplorerClient.send(command);

            // Process and format the response
            const serviceMap = new Map<string, any>();

            response.ResultsByTime?.forEach((timeData) => {
                timeData.Groups?.forEach((group) => {
                    const serviceName = group.Keys?.[0] || "Unknown";
                    const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
                    const usage = parseFloat(group.Metrics?.UsageQuantity?.Amount || "0");

                    if (!serviceMap.has(serviceName)) {
                        serviceMap.set(serviceName, {
                            serviceName,
                            totalCost: 0,
                            totalUsage: 0,
                            currency: group.Metrics?.UnblendedCost?.Unit || "USD",
                            dailyBreakdown: [],
                        });
                    }

                    const serviceData = serviceMap.get(serviceName);
                    serviceData.totalCost += cost;
                    serviceData.totalUsage += usage;
                    serviceData.dailyBreakdown.push({
                        date: timeData.TimePeriod?.Start,
                        cost: cost.toFixed(2),
                        usage: usage.toFixed(2),
                    });
                });
            });

            // Convert map to array and sort by cost
            const servicesArray = Array.from(serviceMap.values())
                .map(service => ({
                    ...service,
                    totalCost: parseFloat(service.totalCost.toFixed(2)),
                    totalUsage: parseFloat(service.totalUsage.toFixed(2)),
                }))
                .sort((a, b) => b.totalCost - a.totalCost);

            return {
                services: servicesArray,
                totalCost: servicesArray.reduce((sum, service) => sum + service.totalCost, 0).toFixed(2),
                currency: servicesArray[0]?.currency || "USD",
                period: { startDate, endDate },
            };
        } catch (error: any) {
            console.error("Error fetching cost by service:", error);
            throw error;
        }
    }

    /**
     * Get cost data grouped by usage type (instance type, operation, etc.)
     * @param keyId - AWS Key ID
     * @param startDate - Start date in YYYY-MM-DD format
     * @param endDate - End date in YYYY-MM-DD format
     */
    static async getCostByResource(keyId: string, startDate: string, endDate: string) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const costExplorerClient = new CostExplorerClient(awsConfig);

            // Use USAGE_TYPE and INSTANCE_TYPE to get resource-level details
            const command = new GetCostAndUsageCommand({
                TimePeriod: {
                    Start: startDate,
                    End: endDate,
                },
                Granularity: "DAILY",
                Metrics: ["UnblendedCost", "UsageQuantity"],
                GroupBy: [
                    {
                        Type: "DIMENSION",
                        Key: "USAGE_TYPE",
                    },
                    {
                        Type: "DIMENSION",
                        Key: "INSTANCE_TYPE",
                    },
                ],
            });

            const response = await costExplorerClient.send(command);

            // Process and aggregate by usage type
            const resourceMap = new Map<string, any>();

            response.ResultsByTime?.forEach((timeData) => {
                timeData.Groups?.forEach((group) => {
                    const usageType = group.Keys?.[0] || "Unknown";
                    const instanceType = group.Keys?.[1] || "N/A";
                    const resourceKey = instanceType !== "N/A" ? `${instanceType} (${usageType})` : usageType;
                    const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
                    const usage = parseFloat(group.Metrics?.UsageQuantity?.Amount || "0");

                    if (!resourceMap.has(resourceKey)) {
                        resourceMap.set(resourceKey, {
                            resourceType: resourceKey,
                            usageType,
                            instanceType,
                            totalCost: 0,
                            totalUsage: 0,
                            currency: group.Metrics?.UnblendedCost?.Unit || "USD",
                            dailyCosts: [],
                        });
                    }

                    const resourceData = resourceMap.get(resourceKey);
                    resourceData.totalCost += cost;
                    resourceData.totalUsage += usage;
                    resourceData.dailyCosts.push({
                        date: timeData.TimePeriod?.Start,
                        cost: cost.toFixed(2),
                        usage: usage.toFixed(2),
                    });
                });
            });

            // Convert to array and sort by cost
            const resourcesArray = Array.from(resourceMap.values())
                .map(resource => ({
                    ...resource,
                    totalCost: parseFloat(resource.totalCost.toFixed(2)),
                    totalUsage: parseFloat(resource.totalUsage.toFixed(2)),
                }))
                .sort((a, b) => b.totalCost - a.totalCost);

            return {
                resources: resourcesArray,
                totalCost: resourcesArray.reduce((sum, resource) => sum + resource.totalCost, 0).toFixed(2),
                currency: resourcesArray[0]?.currency || "USD",
                period: { startDate, endDate },
            };
        } catch (error: any) {
            console.error("Error fetching cost by resource:", error);
            throw error;
        }
    }

    /**
     * Get EC2 instance costs grouped by instance type and usage type
     * @param keyId - AWS Key ID
     * @param startDate - Start date in YYYY-MM-DD format
     * @param endDate - End date in YYYY-MM-DD format
     */
    static async getEC2InstanceCosts(keyId: string, startDate: string, endDate: string) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const costExplorerClient = new CostExplorerClient(awsConfig);

            const command = new GetCostAndUsageCommand({
                TimePeriod: {
                    Start: startDate,
                    End: endDate,
                },
                Granularity: "DAILY",
                Metrics: ["UnblendedCost", "UsageQuantity"],
                Filter: {
                    Dimensions: {
                        Key: "SERVICE",
                        Values: ["Amazon Elastic Compute Cloud - Compute"],
                    },
                },
                GroupBy: [
                    {
                        Type: "DIMENSION",
                        Key: "INSTANCE_TYPE",
                    },
                    {
                        Type: "DIMENSION",
                        Key: "USAGE_TYPE",
                    },
                ],
            });

            const response = await costExplorerClient.send(command);

            // Process EC2 instances by instance type
            const instanceMap = new Map<string, any>();

            response.ResultsByTime?.forEach((timeData) => {
                timeData.Groups?.forEach((group) => {
                    const instanceType = group.Keys?.[0] || "Unknown";
                    const usageType = group.Keys?.[1] || "Unknown";
                    const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
                    const usage = parseFloat(group.Metrics?.UsageQuantity?.Amount || "0");

                    if (!instanceMap.has(instanceType)) {
                        instanceMap.set(instanceType, {
                            instanceType,
                            totalCost: 0,
                            totalUsageHours: 0,
                            currency: group.Metrics?.UnblendedCost?.Unit || "USD",
                            usageTypes: [],
                            dailyCosts: [],
                        });
                    }

                    const instanceData = instanceMap.get(instanceType);
                    instanceData.totalCost += cost;
                    instanceData.totalUsageHours += usage;

                    if (!instanceData.usageTypes.includes(usageType)) {
                        instanceData.usageTypes.push(usageType);
                    }

                    instanceData.dailyCosts.push({
                        date: timeData.TimePeriod?.Start,
                        cost: cost.toFixed(2),
                        usage: usage.toFixed(2),
                        usageType,
                    });
                });
            });

            const instancesArray = Array.from(instanceMap.values())
                .map(instance => ({
                    ...instance,
                    totalCost: parseFloat(instance.totalCost.toFixed(2)),
                    totalUsageHours: parseFloat(instance.totalUsageHours.toFixed(2)),
                    costPerHour: instance.totalUsageHours > 0
                        ? (instance.totalCost / instance.totalUsageHours).toFixed(4)
                        : "0.00",
                }))
                .sort((a, b) => b.totalCost - a.totalCost);

            return {
                instances: instancesArray,
                totalCost: instancesArray.reduce((sum, instance) => sum + instance.totalCost, 0).toFixed(2),
                totalInstanceTypes: instancesArray.length,
                currency: instancesArray[0]?.currency || "USD",
                period: { startDate, endDate },
            };
        } catch (error: any) {
            console.error("Error fetching EC2 instance costs:", error);
            throw error;
        }
    }

    /**
     * Get cost forecast for next 30 days
     * @param keyId - AWS Key ID
     */
    static async getCostForecast(keyId: string) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const costExplorerClient = new CostExplorerClient(awsConfig);

            const startDate = DateTime.now().toISODate();
            const endDate = DateTime.now().plus({ days: 30 }).toISODate();

            const command = new GetCostForecastCommand({
                TimePeriod: {
                    Start: startDate!,
                    End: endDate!,
                },
                Metric: "UNBLENDED_COST",
                Granularity: "DAILY",
            });

            const response = await costExplorerClient.send(command);

            return {
                forecast: response.ForecastResultsByTime?.map(item => ({
                    date: item.TimePeriod?.Start,
                    meanValue: parseFloat(item.MeanValue || "0").toFixed(2),
                })),
                total: parseFloat(response.Total?.Amount || "0").toFixed(2),
                currency: response.Total?.Unit || "USD",
                period: { startDate, endDate },
            };
        } catch (error: any) {
            console.error("Error fetching cost forecast:", error);
            throw error;
        }
    }

    /**
     * Get comprehensive cost dashboard data
     * @param keyId - AWS Key ID
     * @param days - Number of days to look back (default 30)
     */
    static async getCostDashboardData(keyId: string, days: number = 30) {
        try {
            const endDate = DateTime.now().toISODate();
            const startDate = DateTime.now().minus({ days }).toISODate();

            const [servicesCost, resourcesCost, ec2Costs, forecast] = await Promise.all([
                this.getCostByService(keyId, startDate!, endDate!, "DAILY"),
                this.getCostByResource(keyId, startDate!, endDate!),
                this.getEC2InstanceCosts(keyId, startDate!, endDate!),
                this.getCostForecast(keyId).catch(() => null), // Forecast may fail if not enough data
            ]);

            return {
                overview: {
                    totalCost: servicesCost.totalCost,
                    currency: servicesCost.currency,
                    period: servicesCost.period,
                },
                serviceBreakdown: servicesCost.services,
                topResources: resourcesCost.resources.slice(0, 20), // Top 20 resource types
                ec2Analysis: {
                    instanceTypes: ec2Costs.instances,
                    totalEC2Cost: ec2Costs.totalCost,
                    totalInstanceTypes: ec2Costs.totalInstanceTypes,
                },
                forecast: forecast || { message: "Forecast not available" },
            };
        } catch (error: any) {
            console.error("Error fetching dashboard data:", error);
            throw error;
        }
    }

    /**
     * Get AWS Bedrock model usage and costs
     * @param keyId - AWS Key ID
     * @param days - Number of days to look back (default 30)
     */
    static async getBedrockCosts(keyId: string, days: number = 30) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const costExplorerClient = new CostExplorerClient(awsConfig);

            const endDate = DateTime.now().toISODate();
            const startDate = DateTime.now().minus({ days }).toISODate();

            // Get Bedrock costs filtered by service
            const command = new GetCostAndUsageCommand({
                TimePeriod: {
                    Start: startDate!,
                    End: endDate!,
                },
                Granularity: "DAILY",
                Metrics: ["UnblendedCost", "UsageQuantity"],
                Filter: {
                    Dimensions: {
                        Key: "SERVICE",
                        Values: ["Amazon Bedrock"],
                    },
                },
                GroupBy: [
                    {
                        Type: "DIMENSION",
                        Key: "USAGE_TYPE",
                    },
                ],
            });

            const response = await costExplorerClient.send(command);

            // Process Bedrock costs by usage type (model)
            const modelMap = new Map<string, any>();
            const dailyCostsMap = new Map<string, number>();

            response.ResultsByTime?.forEach((timeData) => {
                const date = timeData.TimePeriod?.Start || "";
                let dailyTotal = 0;

                timeData.Groups?.forEach((group) => {
                    const usageType = group.Keys?.[0] || "Unknown";
                    const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
                    const usage = parseFloat(group.Metrics?.UsageQuantity?.Amount || "0");

                    dailyTotal += cost;

                    // Extract model information from usage type
                    // Bedrock usage types typically contain model identifiers
                    const modelInfo = this.extractBedrockModelInfo(usageType);

                    if (!modelMap.has(modelInfo.modelName)) {
                        modelMap.set(modelInfo.modelName, {
                            modelName: modelInfo.modelName,
                            provider: modelInfo.provider,
                            inputTokens: 0,
                            outputTokens: 0,
                            totalRequests: 0,
                            totalCost: 0,
                            currency: group.Metrics?.UnblendedCost?.Unit || "USD",
                            usageTypes: [],
                        });
                    }

                    const modelData = modelMap.get(modelInfo.modelName);
                    modelData.totalCost += cost;
                    modelData.totalRequests += usage;

                    // Parse token information from usage type if available
                    if (usageType.toLowerCase().includes("input")) {
                        modelData.inputTokens += usage;
                    } else if (usageType.toLowerCase().includes("output")) {
                        modelData.outputTokens += usage;
                    }

                    if (!modelData.usageTypes.includes(usageType)) {
                        modelData.usageTypes.push(usageType);
                    }
                });

                dailyCostsMap.set(date, (dailyCostsMap.get(date) || 0) + dailyTotal);
            });

            // Convert maps to arrays and sort
            const modelsArray = Array.from(modelMap.values())
                .map(model => ({
                    ...model,
                    totalCost: parseFloat(model.totalCost.toFixed(2)),
                    totalRequests: parseFloat(model.totalRequests.toFixed(2)),
                    inputTokens: parseFloat(model.inputTokens.toFixed(2)),
                    outputTokens: parseFloat(model.outputTokens.toFixed(2)),
                }))
                .sort((a, b) => b.totalCost - a.totalCost);

            const dailyCostsArray = Array.from(dailyCostsMap.entries())
                .map(([date, cost]) => ({
                    date,
                    cost: parseFloat(cost.toFixed(2)),
                }))
                .sort((a, b) => a.date.localeCompare(b.date));

            const totalCost = modelsArray.reduce((sum, model) => sum + model.totalCost, 0);
            const totalRequests = modelsArray.reduce((sum, model) => sum + model.totalRequests, 0);

            // Calculate estimated monthly cost based on daily average
            const avgDailyCost = totalCost / days;
            const estimatedMonthlyCost = (avgDailyCost * 30).toFixed(2);

            return {
                totalCost: totalCost.toFixed(2),
                estimatedMonthlyCost,
                totalRequests: totalRequests.toFixed(2),
                currency: modelsArray[0]?.currency || "USD",
                period: { startDate: startDate!, endDate: endDate! },
                models: modelsArray,
                dailyCosts: dailyCostsArray,
            };
        } catch (error: any) {
            console.error("Error fetching Bedrock costs:", error);
            throw error;
        }
    }

    /**
     * Extract model information from Bedrock usage type
     * @param usageType - AWS usage type string
     * @returns Object with modelName and provider
     */
    private static extractBedrockModelInfo(usageType: string): { modelName: string; provider: string } {
        // Common Bedrock model patterns in usage types
        const modelPatterns = [
            { pattern: /anthropic\.claude/i, provider: "Anthropic", name: "Claude" },
            { pattern: /anthropic/i, provider: "Anthropic", name: "Claude" },
            { pattern: /ai21/i, provider: "AI21 Labs", name: "Jurassic" },
            { pattern: /amazon\.titan/i, provider: "Amazon", name: "Titan" },
            { pattern: /cohere/i, provider: "Cohere", name: "Cohere" },
            { pattern: /meta\.llama/i, provider: "Meta", name: "Llama" },
            { pattern: /stability/i, provider: "Stability AI", name: "Stable Diffusion" },
        ];

        for (const { pattern, provider, name } of modelPatterns) {
            if (pattern.test(usageType)) {
                // Try to extract more specific model name from usage type
                const specificName = usageType.match(/\.([\w-]+)/)?.[1] || name;
                return {
                    modelName: specificName.charAt(0).toUpperCase() + specificName.slice(1).replace(/-/g, " "),
                    provider,
                };
            }
        }

        // Default fallback
        return {
            modelName: "Unknown Model",
            provider: "Unknown Provider",
        };
    }
}
