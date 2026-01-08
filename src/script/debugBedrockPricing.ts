import { PricingClient, GetProductsCommand } from "@aws-sdk/client-pricing";
import { AWSKeyService } from "../services/awsKeyService";

/**
 * Debug script to test AWS Pricing API and understand what's available
 */
async function debugBedrockPricing() {
    try {
        // Use the first available AWS key
        const keyId = "677a59e40c69baedcbeb50aa"; // Replace with actual keyId from your DB

        const awsConfig = await AWSKeyService.getAWSKeyById(keyId);
        const region = awsConfig.region;

        console.log(`\n[Debug] Testing AWS Pricing API for region: ${region}`);
        console.log(`[Debug] AWS Credentials configured: ${!!awsConfig.credentials}\n`);

        // AWS Pricing API is only available in us-east-1
        const pricingClient = new PricingClient({
            region: "us-east-1",
            credentials: awsConfig.credentials
        });

        // Test 1: Fetch ALL Bedrock products without productFamily filter
        console.log("=== TEST 1: All Bedrock Products ===");
        const allBedrockCommand = new GetProductsCommand({
            ServiceCode: "AmazonBedrock",
            Filters: [
                {
                    Type: "TERM_MATCH",
                    Field: "regionCode",
                    Value: region,
                },
            ],
            MaxResults: 100,
        });

        const allBedrockResponse = await pricingClient.send(allBedrockCommand);
        console.log(`Total Bedrock products found: ${allBedrockResponse.PriceList?.length || 0}`);

        if (allBedrockResponse.PriceList && allBedrockResponse.PriceList.length > 0) {
            // Show unique product families
            const productFamilies = new Set<string>();
            allBedrockResponse.PriceList.forEach((item: any) => {
                const priceData = typeof item === 'string' ? JSON.parse(item) : item;
                const family = priceData.product?.attributes?.productFamily;
                if (family) productFamilies.add(family);
            });
            console.log(`Product families found: ${Array.from(productFamilies).join(", ")}`);

            // Show first product sample
            const sample = typeof allBedrockResponse.PriceList[0] === 'string'
                ? JSON.parse(allBedrockResponse.PriceList[0])
                : allBedrockResponse.PriceList[0];
            console.log("\nSample product attributes:");
            console.log(JSON.stringify(sample.product?.attributes, null, 2));
        }

        // Test 2: Try "Generative AI Inference" filter
        console.log("\n=== TEST 2: Generative AI Inference ===");
        const inferenceCommand = new GetProductsCommand({
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
        });

        const inferenceResponse = await pricingClient.send(inferenceCommand);
        console.log(`Inference products found: ${inferenceResponse.PriceList?.length || 0}`);

        // Test 3: Try without region filter (just service code)
        console.log("\n=== TEST 3: Bedrock without region filter ===");
        const noRegionCommand = new GetProductsCommand({
            ServiceCode: "AmazonBedrock",
            MaxResults: 100,
        });

        const noRegionResponse = await pricingClient.send(noRegionCommand);
        console.log(`Products without region filter: ${noRegionResponse.PriceList?.length || 0}`);

        if (noRegionResponse.PriceList && noRegionResponse.PriceList.length > 0) {
            // Show which regions are available
            const regions = new Set<string>();
            noRegionResponse.PriceList.forEach((item: any) => {
                const priceData = typeof item === 'string' ? JSON.parse(item) : item;
                const reg = priceData.product?.attributes?.regionCode;
                if (reg) regions.add(reg);
            });
            console.log(`Regions found: ${Array.from(regions).join(", ")}`);
        }

        // Test 4: Check if Bedrock is even available
        console.log("\n=== TEST 4: Check service availability ===");
        const anyBedrockCommand = new GetProductsCommand({
            ServiceCode: "AmazonBedrock",
            MaxResults: 10,
        });

        const anyBedrockResponse = await pricingClient.send(anyBedrockCommand);
        console.log(`Any Bedrock products at all: ${anyBedrockResponse.PriceList?.length || 0}`);

        if (anyBedrockResponse.PriceList && anyBedrockResponse.PriceList.length > 0) {
            console.log("\nFirst 3 products found:");
            anyBedrockResponse.PriceList.slice(0, 3).forEach((item: any, index: number) => {
                const priceData = typeof item === 'string' ? JSON.parse(item) : item;
                console.log(`\n--- Product ${index + 1} ---`);
                console.log(`Model: ${priceData.product?.attributes?.model || 'N/A'}`);
                console.log(`Product Family: ${priceData.product?.attributes?.productFamily || 'N/A'}`);
                console.log(`Region: ${priceData.product?.attributes?.regionCode || 'N/A'}`);
                console.log(`Inference Type: ${priceData.product?.attributes?.inferenceType || 'N/A'}`);
            });
        }

        console.log("\n[Debug] Testing complete!");
        process.exit(0);
    } catch (error: any) {
        console.error("\n[Debug Error]:", error.message);
        console.error("Stack:", error.stack);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    console.log("Starting Bedrock Pricing API debug...\n");
    debugBedrockPricing();
}
