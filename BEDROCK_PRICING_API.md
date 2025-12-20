# AWS Bedrock Pricing API Documentation

This document describes the Bedrock pricing implementation based on the AWS sample repository: [sample-bedrock-model-evaluation](https://github.com/aws-samples/sample-bedrock-model-evaluation)

## Overview

The Bedrock pricing system retrieves and caches real-time pricing data from the **AWS Pricing API** for all Bedrock models available in a specific region. This provides accurate per-token pricing (input and output tokens separately) that can be used to calculate costs before making API calls.

## Key Features

- ✅ **Real-time Pricing**: Fetches current pricing from AWS Pricing API
- ✅ **Separate Token Pricing**: Input and output tokens priced independently
- ✅ **Per 1000 Tokens**: All pricing is per 1000 tokens (AWS standard)
- ✅ **24-hour Caching**: Reduces API calls and improves performance
- ✅ **Multi-Model Support**: Supports all Bedrock providers (Anthropic, Amazon, Meta, AI21, Cohere, Stability AI, Mistral)
- ✅ **Cost Calculator**: Calculate costs based on token usage

## API Endpoints

### 1. Get Bedrock Pricing (All Models)

Retrieves pricing for all Bedrock models in the region.

```http
GET /api/v1/aws/cost/bedrock-pricing/:keyId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "region": "us-east-1",
    "environment": "production",
    "modelCount": 15,
    "models": [
      {
        "modelId": "anthropic.claude-3-sonnet-20240229-v1:0",
        "provider": "Anthropic",
        "modelName": "Claude 3 Sonnet",
        "pricing": {
          "inputPer1kTokens": "0.003000",
          "outputPer1kTokens": "0.015000",
          "currency": "USD"
        },
        "exampleCosts": {
          "_1kInputTokens": "0.0030",
          "_1kOutputTokens": "0.0150",
          "_10kInputTokens": "0.0300",
          "_10kOutputTokens": "0.1500",
          "_100kInputTokens": "0.30",
          "_100kOutputTokens": "1.50"
        }
      }
    ],
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Calculate Bedrock Cost

Calculate cost for specific token usage.

```http
POST /api/v1/aws/cost/bedrock-calculate/:keyId
Content-Type: application/json

{
  "modelId": "anthropic.claude-3-sonnet-20240229-v1:0",
  "inputTokens": 5000,
  "outputTokens": 2000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modelId": "anthropic.claude-3-sonnet-20240229-v1:0",
    "inputTokens": 5000,
    "outputTokens": 2000,
    "pricing": {
      "inputPer1kTokens": "0.003000",
      "outputPer1kTokens": "0.015000",
      "currency": "USD"
    },
    "costs": {
      "inputCost": "0.015000",
      "outputCost": "0.030000",
      "totalCost": "0.045000",
      "currency": "USD"
    }
  }
}
```

### 3. Get Bedrock Usage Costs (Historical)

Get actual usage and costs from AWS Cost Explorer.

```http
GET /api/v1/aws/cost/bedrock/:keyId?days=30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCost": "45.67",
    "estimatedMonthlyCost": "1370.10",
    "totalRequests": "125000",
    "currency": "USD",
    "period": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-30"
    },
    "models": [
      {
        "modelName": "Claude 3 Sonnet",
        "provider": "Anthropic",
        "inputTokens": 1500000,
        "outputTokens": 750000,
        "totalRequests": 5000,
        "totalCost": 25.50,
        "currency": "USD"
      }
    ],
    "dailyCosts": [
      { "date": "2024-01-01", "cost": 1.52 },
      { "date": "2024-01-02", "cost": 1.48 }
    ]
  }
}
```

### 4. Clear Pricing Cache (Admin Only)

Force refresh of pricing data.

```http
POST /api/v1/aws/cost/bedrock-pricing/clear-cache
```

**Response:**
```json
{
  "success": true,
  "message": "Bedrock pricing cache cleared successfully"
}
```

## Pricing Calculation Formula

```
Total Cost = (Input Tokens / 1000) × Input Price + (Output Tokens / 1000) × Output Price
```

**Example:**
- Model: Claude 3 Sonnet
- Input Price: $0.003 per 1K tokens
- Output Price: $0.015 per 1K tokens
- Usage: 5,000 input tokens, 2,000 output tokens

```
Input Cost  = (5000 / 1000) × 0.003 = $0.015
Output Cost = (2000 / 1000) × 0.015 = $0.030
Total Cost  = $0.015 + $0.030 = $0.045
```

## Supported Models

The system automatically detects and supports all Bedrock models, including:

### Anthropic
- Claude 3.5 Sonnet
- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku
- Claude 2
- Claude Instant

### Amazon
- Titan Text Express
- Titan Text Lite
- Titan Embeddings
- Titan Image Generator
- Titan Multimodal Embeddings

### Meta
- Llama 3.1 (70B, 8B)
- Llama 3 (70B, 8B)
- Llama 2 (70B, 13B, 7B)

### AI21 Labs
- Jurassic-2 Ultra
- Jurassic-2 Mid

### Cohere
- Command
- Embed

### Stability AI
- Stable Diffusion XL
- Stable Diffusion 3

### Mistral AI
- Mistral 7B
- Mixtral 8x7B

## Required IAM Permissions

### For Pricing API (Read Prices)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "pricing:GetProducts"
      ],
      "Resource": "*"
    }
  ]
}
```

### For Cost Explorer (Historical Usage)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetDimensionValues"
      ],
      "Resource": "*"
    }
  ]
}
```

## Implementation Details

### Caching Strategy
- **Cache Duration**: 24 hours
- **Cache Key**: Region-specific
- **Cache Storage**: In-memory
- **Cache Invalidation**: Automatic after 24 hours or manual via clear-cache endpoint

### Data Structure

```typescript
interface TokenPricing {
    input: number;   // Price per 1K input tokens
    output: number;  // Price per 1K output tokens
}

interface ModelPricing {
    [modelId: string]: TokenPricing;
}

interface RegionPricing {
    [region: string]: ModelPricing;
}
```

### Error Handling

The system handles various error scenarios:

1. **Missing Pricing Data**: Returns null if model pricing not found
2. **IAM Permission Errors**: Provides detailed permission requirements
3. **Invalid Model ID**: Returns 404 with helpful hint
4. **API Failures**: Logs error and returns graceful error response

## Usage Examples

### Frontend Integration

```typescript
// 1. Get all pricing for cost estimation
const pricingResponse = await fetch(`/api/v1/aws/cost/bedrock-pricing/${keyId}`);
const { data: pricing } = await pricingResponse.json();

// Display pricing table
pricing.models.forEach(model => {
  console.log(`${model.modelName}:`);
  console.log(`  Input: $${model.pricing.inputPer1kTokens} per 1K tokens`);
  console.log(`  Output: $${model.pricing.outputPer1kTokens} per 1K tokens`);
});

// 2. Calculate cost before API call
const costResponse = await fetch(`/api/v1/aws/cost/bedrock-calculate/${keyId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    inputTokens: 5000,
    outputTokens: 2000
  })
});

const { data: cost } = await costResponse.json();
console.log(`Estimated cost: $${cost.costs.totalCost}`);

// 3. Get historical usage and costs
const historyResponse = await fetch(`/api/v1/aws/cost/bedrock/${keyId}?days=30`);
const { data: history } = await historyResponse.json();

console.log(`Total cost (last 30 days): $${history.totalCost}`);
console.log(`Estimated monthly: $${history.estimatedMonthlyCost}`);
```

## Differences from Cost Explorer API

| Feature | Pricing API | Cost Explorer API |
|---------|------------|-------------------|
| **Purpose** | Get pricing rates | Get actual usage costs |
| **Data** | Current prices per 1K tokens | Historical usage and costs |
| **Timing** | Real-time pricing | Past usage (24-48h delay) |
| **Tokens** | Input/Output separated | May be aggregated |
| **Use Case** | Cost estimation | Cost analysis & reporting |
| **Caching** | 24 hours | No caching (real-time query) |

## Best Practices

1. **Use Pricing API for estimation** before making Bedrock calls
2. **Use Cost Explorer API for reporting** historical usage
3. **Cache pricing data** to reduce API calls
4. **Display both input and output pricing** separately for transparency
5. **Show example costs** for common token counts (1K, 10K, 100K)
6. **Update pricing daily** to ensure accuracy
7. **Handle missing pricing gracefully** (some models may not have pricing available)

## Troubleshooting

### Pricing Not Available
- **Cause**: Model not available in region or pricing not published
- **Solution**: Check model availability in AWS Bedrock console

### Permission Denied
- **Cause**: Missing `pricing:GetProducts` permission
- **Solution**: Add IAM policy for Pricing API access

### Stale Pricing
- **Cause**: Cache not refreshed
- **Solution**: Call clear-cache endpoint or wait 24 hours

### Wrong Region
- **Cause**: Pricing API always uses us-east-1
- **Solution**: Service automatically handles this - pricing is region-specific in results

## Reference

- AWS Sample Repository: https://github.com/aws-samples/sample-bedrock-model-evaluation
- AWS Pricing API Documentation: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/price-changes.html
- AWS Bedrock Pricing: https://aws.amazon.com/bedrock/pricing/
