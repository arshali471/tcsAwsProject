import { PricingClient, GetProductsCommand } from "@aws-sdk/client-pricing";
import { AWSKeyService } from "./awsKeyService";

/**
 * Bedrock Pricing Service
 * Fetches and caches Bedrock model pricing from AWS Pricing API
 * Similar to aws-samples/sample-bedrock-model-evaluation
 */

interface TokenPricing {
    input: number;
    output: number;
}

interface ModelPricing {
    [modelId: string]: TokenPricing;
}

interface RegionPricing {
    [region: string]: ModelPricing;
}

export class BedrockPricingService {
    private static pricingCache: RegionPricing | null = null;
    private static cacheTimestamp: number = 0;
    private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Get Bedrock pricing for all models in a specific region
     * @param keyId - AWS Key ID
     * @returns Pricing data organized by model
     */
    static async getBedrockPricing(keyId: string): Promise<ModelPricing> {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const region = awsConfig.region;

            // Check cache
            if (this.pricingCache &&
                this.pricingCache[region] &&
                Date.now() - this.cacheTimestamp < this.CACHE_DURATION) {
                return this.pricingCache[region];
            }

            // AWS Pricing API is only available in us-east-1
            const pricingClient = new PricingClient({
                region: "us-east-1",
                credentials: awsConfig.credentials
            });

            // Fetch all inference models with pagination
            let allPriceItems: any[] = [];
            let nextToken: string | undefined = undefined;

            do {
                const commandInput: any = {
                    ServiceCode: "AmazonBedrock",
                    Filters: [
                        {
                            Type: "TERM_MATCH",
                            Field: "regionCode",
                            Value: region,
                        },
                        {
                            Type: "TERM_MATCH",
                            Field: "productFamily",
                            Value: "Generative AI Inference",
                        },
                    ],
                    MaxResults: 100,
                };

                if (nextToken) {
                    commandInput.NextToken = nextToken;
                }

                const command = new GetProductsCommand(commandInput);
                const pricingResponse = await pricingClient.send(command);

                if (pricingResponse.PriceList) {
                    allPriceItems = allPriceItems.concat(pricingResponse.PriceList);
                }

                nextToken = (pricingResponse as any).NextToken;
            } while (nextToken);

            const modelPricing: ModelPricing = {};

            console.log(`[Bedrock Pricing] Fetched ${allPriceItems.length} pricing items for region ${region}`);

            // Process each pricing item
            allPriceItems.forEach((priceItem: any) => {
                const priceData = typeof priceItem === 'string' ? JSON.parse(priceItem) : priceItem;

                const product = priceData.product;
                const terms = priceData.terms?.OnDemand;

                if (!terms || !product) return;

                // Extract model information
                const modelId = product.attributes?.model || product.attributes?.usagetype || "Unknown";
                const inferenceType = product.attributes?.inferenceType || "";

                // Skip cache-related pricing
                if (inferenceType.toLowerCase().includes("cache")) return;

                // Determine if this is input or output token pricing
                const tokenType = this.determineTokenType(inferenceType, product.attributes);

                // Extract price per 1000 tokens
                const pricePerUnit = this.extractPricePerUnit(terms);

                if (pricePerUnit === null) return;

                // Initialize model pricing if not exists
                if (!modelPricing[modelId]) {
                    modelPricing[modelId] = {
                        input: 0,
                        output: 0,
                    };
                }

                // Assign price to correct token type
                if (tokenType === "input") {
                    modelPricing[modelId].input = pricePerUnit;
                } else if (tokenType === "output") {
                    modelPricing[modelId].output = pricePerUnit;
                }
            });

            // Update cache
            if (!this.pricingCache) {
                this.pricingCache = {};
            }
            this.pricingCache[region] = modelPricing;
            this.cacheTimestamp = Date.now();

            const modelCount = Object.keys(modelPricing).length;
            console.log(`[Bedrock Pricing] Processed ${modelCount} unique models for region ${region}`);

            return modelPricing;
        } catch (error: any) {
            console.error("Error fetching Bedrock pricing:", error);
            throw error;
        }
    }

    /**
     * Calculate cost for a specific model based on token usage
     * @param modelId - Bedrock model identifier
     * @param inputTokens - Number of input tokens used
     * @param outputTokens - Number of output tokens used
     * @param pricing - Pricing data for the model
     * @returns Total cost in USD
     */
    static calculateModelCost(
        modelId: string,
        inputTokens: number,
        outputTokens: number,
        pricing: TokenPricing
    ): number {
        // Pricing is per 1000 tokens
        const inputCost = (inputTokens / 1000) * pricing.input;
        const outputCost = (outputTokens / 1000) * pricing.output;

        return inputCost + outputCost;
    }

    /**
     * Get pricing for a specific model
     * @param keyId - AWS Key ID
     * @param modelId - Model identifier
     * @returns Token pricing for the model
     */
    static async getModelPricing(keyId: string, modelId: string): Promise<TokenPricing | null> {
        try {
            const allPricing = await this.getBedrockPricing(keyId);
            return allPricing[modelId] || null;
        } catch (error) {
            console.error(`Error getting pricing for model ${modelId}:`, error);
            return null;
        }
    }

    /**
     * Get formatted pricing summary for all models
     * @param keyId - AWS Key ID
     * @returns Array of models with pricing information
     */
    static async getPricingSummary(keyId: string) {
        try {
            const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
            const pricing = await this.getBedrockPricing(keyId);

            const models = Object.entries(pricing).map(([modelId, prices]) => ({
                modelId,
                provider: this.extractProvider(modelId),
                modelName: this.formatModelName(modelId),
                pricing: {
                    inputPer1kTokens: prices.input.toFixed(6),
                    outputPer1kTokens: prices.output.toFixed(6),
                    currency: "USD",
                },
                exampleCosts: {
                    _1kInputTokens: prices.input.toFixed(4),
                    _1kOutputTokens: prices.output.toFixed(4),
                    _10kInputTokens: (prices.input * 10).toFixed(4),
                    _10kOutputTokens: (prices.output * 10).toFixed(4),
                    _100kInputTokens: (prices.input * 100).toFixed(2),
                    _100kOutputTokens: (prices.output * 100).toFixed(2),
                },
            }));

            return {
                region: awsConfig.region,
                environment: awsConfig.enviroment,
                modelCount: models.length,
                models: models.sort((a, b) => a.modelName.localeCompare(b.modelName)),
                lastUpdated: new Date(this.cacheTimestamp).toISOString(),
            };
        } catch (error: any) {
            console.error("Error getting pricing summary:", error);
            throw error;
        }
    }

    /**
     * Determine if pricing is for input or output tokens
     * @param inferenceType - Inference type from product attributes
     * @param attributes - Product attributes
     * @returns "input", "output", or "unknown"
     */
    private static determineTokenType(inferenceType: string, attributes: any): string {
        const lowerInferenceType = inferenceType.toLowerCase();

        if (lowerInferenceType.includes("input")) {
            return "input";
        }

        if (lowerInferenceType.includes("output")) {
            return "output";
        }

        // Check other attributes
        const usageType = (attributes?.usagetype || "").toLowerCase();
        if (usageType.includes("input")) return "input";
        if (usageType.includes("output")) return "output";

        return "unknown";
    }

    /**
     * Extract price per unit from AWS Pricing terms
     * @param terms - OnDemand terms from pricing data
     * @returns Price per 1000 tokens or null
     */
    private static extractPricePerUnit(terms: any): number | null {
        try {
            // Navigate through the nested structure
            const termKey = Object.keys(terms)[0];
            if (!termKey) return null;

            const priceDimensions = terms[termKey]?.priceDimensions;
            if (!priceDimensions) return null;

            const dimensionKey = Object.keys(priceDimensions)[0];
            if (!dimensionKey) return null;

            const dimension = priceDimensions[dimensionKey];

            // Check if unit is "1K tokens"
            if (dimension.unit !== "1K tokens") return null;

            const pricePerUnit = parseFloat(dimension.pricePerUnit?.USD || "0");
            return pricePerUnit;
        } catch (error) {
            console.error("Error extracting price per unit:", error);
            return null;
        }
    }

    /**
     * Extract provider from model ID
     * @param modelId - Model identifier
     * @returns Provider name
     */
    private static extractProvider(modelId: string): string {
        const lower = modelId.toLowerCase();

        if (lower.includes("anthropic") || lower.includes("claude")) return "Anthropic";
        if (lower.includes("amazon") || lower.includes("titan")) return "Amazon";
        if (lower.includes("meta") || lower.includes("llama")) return "Meta";
        if (lower.includes("ai21") || lower.includes("jurassic")) return "AI21 Labs";
        if (lower.includes("cohere")) return "Cohere";
        if (lower.includes("stability") || lower.includes("stable")) return "Stability AI";
        if (lower.includes("mistral")) return "Mistral AI";

        return "AWS Bedrock";
    }

    /**
     * Format model ID into readable name
     * @param modelId - Model identifier
     * @returns Formatted model name
     */
    private static formatModelName(modelId: string): string {
        // Clean up common patterns
        return modelId
            .replace(/^[A-Z]{2,4}\d+-/i, '') // Remove region prefix
            .replace(/ModelInference-/gi, '')
            .replace(/-/g, ' ')
            .replace(/\./g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Clear pricing cache (useful for testing or forcing refresh)
     */
    static clearCache(): void {
        this.pricingCache = null;
        this.cacheTimestamp = 0;
    }

    /**
     * Get combined Bedrock cost analysis with usage and pricing
     * This combines actual usage data from Cost Explorer with pricing from Pricing API
     * @param keyId - AWS Key ID
     * @param days - Number of days to analyze (default 30)
     * @returns Combined usage and pricing data for models that have been used
     */
    static async getBedrockCostAnalysis(keyId: string, days: number = 30) {
        const { AWSCostService } = await import("./awsCostService");
        const awsConfig = await AWSKeyService.getAWSKeyById(keyId);

        // Fetch usage data from Cost Explorer
        const usageData = await AWSCostService.getBedrockCosts(keyId, days);

        // Fetch pricing data from Pricing API
        const pricingData = await this.getBedrockPricing(keyId);

        // Combine the data - only include models that have usage
        const combinedModels = usageData.models.map((usageModel: any) => {
            // Try to find matching pricing data
            // Match by model name or partial model ID
            let matchedPricing = null;
            let matchedModelId = null;

            // Try to find exact or partial match
            for (const [modelId, pricing] of Object.entries(pricingData)) {
                const normalizedModelName = usageModel.modelName.toLowerCase().replace(/\s+/g, "-");
                const normalizedModelId = modelId.toLowerCase();

                // Check if the usage model name is contained in the pricing model ID
                // or if they share common identifiers
                if (
                    normalizedModelId.includes(normalizedModelName) ||
                    normalizedModelName.includes(normalizedModelId.split(".")[1]?.split("-")[0] || "") ||
                    usageModel.provider.toLowerCase() === this.extractProvider(modelId).toLowerCase()
                ) {
                    matchedPricing = pricing;
                    matchedModelId = modelId;
                    break;
                }
            }

            return {
                modelName: usageModel.modelName,
                modelId: matchedModelId || usageModel.modelName,
                provider: usageModel.provider,
                usage: {
                    inputTokens: usageModel.inputTokens,
                    outputTokens: usageModel.outputTokens,
                    totalRequests: usageModel.totalRequests,
                    totalCost: usageModel.totalCost,
                    currency: usageModel.currency,
                },
                pricing: matchedPricing
                    ? {
                          inputPer1kTokens: matchedPricing.input.toFixed(6),
                          outputPer1kTokens: matchedPricing.output.toFixed(6),
                          currency: "USD",
                      }
                    : null,
                exampleCosts: matchedPricing
                    ? {
                          _1kInputTokens: matchedPricing.input.toFixed(4),
                          _1kOutputTokens: matchedPricing.output.toFixed(4),
                          _10kInputTokens: (matchedPricing.input * 10).toFixed(4),
                          _10kOutputTokens: (matchedPricing.output * 10).toFixed(4),
                          _100kInputTokens: (matchedPricing.input * 100).toFixed(2),
                          _100kOutputTokens: (matchedPricing.output * 100).toFixed(2),
                      }
                    : null,
            };
        });

        return {
            region: awsConfig.region,
            environment: awsConfig.enviroment,
            period: {
                days,
                startDate: usageData.period.startDate,
                endDate: usageData.period.endDate,
            },
            summary: {
                totalModelsUsed: combinedModels.length,
                totalCost: parseFloat(usageData.totalCost),
                totalInputTokens: usageData.models.reduce((sum: number, m: any) => sum + m.inputTokens, 0),
                totalOutputTokens: usageData.models.reduce((sum: number, m: any) => sum + m.outputTokens, 0),
                currency: "USD",
            },
            models: combinedModels.sort((a, b) => b.usage.totalCost - a.usage.totalCost),
            dailyCosts: usageData.dailyCosts,
        };
    }
}
