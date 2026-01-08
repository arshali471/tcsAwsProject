/**
 * Fallback Bedrock Pricing Data
 * Source: AWS Bedrock official pricing (as of January 2025)
 * This is used when AWS Pricing API doesn't return results
 */

interface TokenPricing {
    input: number;
    output: number;
}

interface ModelPricing {
    [modelId: string]: TokenPricing;
}

/**
 * Hardcoded Bedrock pricing for major inference models
 * Prices are per 1000 tokens in USD
 * Updated January 2025
 */
export const BEDROCK_PRICING_FALLBACK: ModelPricing = {
    // Anthropic Claude Models
    "anthropic.claude-3-5-sonnet-20241022-v2:0": {
        input: 0.003,
        output: 0.015,
    },
    "anthropic.claude-3-5-sonnet-20240620-v1:0": {
        input: 0.003,
        output: 0.015,
    },
    "anthropic.claude-3-opus-20240229-v1:0": {
        input: 0.015,
        output: 0.075,
    },
    "anthropic.claude-3-sonnet-20240229-v1:0": {
        input: 0.003,
        output: 0.015,
    },
    "anthropic.claude-3-haiku-20240307-v1:0": {
        input: 0.00025,
        output: 0.00125,
    },
    "anthropic.claude-v2:1": {
        input: 0.008,
        output: 0.024,
    },
    "anthropic.claude-v2": {
        input: 0.008,
        output: 0.024,
    },
    "anthropic.claude-instant-v1": {
        input: 0.0008,
        output: 0.0024,
    },

    // Amazon Titan Models
    "amazon.titan-text-premier-v1:0": {
        input: 0.0005,
        output: 0.0015,
    },
    "amazon.titan-text-express-v1": {
        input: 0.0002,
        output: 0.0006,
    },
    "amazon.titan-text-lite-v1": {
        input: 0.00015,
        output: 0.0002,
    },
    "amazon.titan-embed-text-v1": {
        input: 0.0001,
        output: 0.0001,
    },
    "amazon.titan-embed-text-v2:0": {
        input: 0.00002,
        output: 0.00002,
    },

    // Meta Llama Models
    "meta.llama3-1-405b-instruct-v1:0": {
        input: 0.00532,
        output: 0.016,
    },
    "meta.llama3-1-70b-instruct-v1:0": {
        input: 0.00099,
        output: 0.00099,
    },
    "meta.llama3-1-8b-instruct-v1:0": {
        input: 0.0003,
        output: 0.0006,
    },
    "meta.llama3-70b-instruct-v1:0": {
        input: 0.00099,
        output: 0.00099,
    },
    "meta.llama3-8b-instruct-v1:0": {
        input: 0.0003,
        output: 0.0006,
    },
    "meta.llama2-70b-chat-v1": {
        input: 0.00195,
        output: 0.00256,
    },
    "meta.llama2-13b-chat-v1": {
        input: 0.00075,
        output: 0.001,
    },

    // Cohere Models
    "cohere.command-r-plus-v1:0": {
        input: 0.003,
        output: 0.015,
    },
    "cohere.command-r-v1:0": {
        input: 0.0005,
        output: 0.0015,
    },
    "cohere.command-text-v14": {
        input: 0.0015,
        output: 0.002,
    },
    "cohere.command-light-text-v14": {
        input: 0.0003,
        output: 0.0006,
    },
    "cohere.embed-english-v3": {
        input: 0.0001,
        output: 0.0001,
    },
    "cohere.embed-multilingual-v3": {
        input: 0.0001,
        output: 0.0001,
    },

    // AI21 Labs Models
    "ai21.jamba-1-5-large-v1:0": {
        input: 0.002,
        output: 0.008,
    },
    "ai21.jamba-1-5-mini-v1:0": {
        input: 0.0002,
        output: 0.0004,
    },
    "ai21.j2-ultra-v1": {
        input: 0.0188,
        output: 0.0188,
    },
    "ai21.j2-mid-v1": {
        input: 0.0125,
        output: 0.0125,
    },

    // Mistral AI Models
    "mistral.mistral-large-2402-v1:0": {
        input: 0.008,
        output: 0.024,
    },
    "mistral.mistral-large-2407-v1:0": {
        input: 0.003,
        output: 0.009,
    },
    "mistral.mistral-small-2402-v1:0": {
        input: 0.002,
        output: 0.006,
    },
    "mistral.mixtral-8x7b-instruct-v0:1": {
        input: 0.00045,
        output: 0.0007,
    },
    "mistral.mistral-7b-instruct-v0:2": {
        input: 0.00015,
        output: 0.0002,
    },
};

/**
 * Extract provider from model ID
 */
export function extractProvider(modelId: string): string {
    const lower = modelId.toLowerCase();

    if (lower.includes("anthropic") || lower.includes("claude")) return "Anthropic";
    if (lower.includes("amazon") || lower.includes("titan")) return "Amazon";
    if (lower.includes("meta") || lower.includes("llama")) return "Meta";
    if (lower.includes("ai21") || lower.includes("jamba") || lower.includes("jurassic")) return "AI21 Labs";
    if (lower.includes("cohere")) return "Cohere";
    if (lower.includes("mistral") || lower.includes("mixtral")) return "Mistral AI";

    return "AWS Bedrock";
}

/**
 * Format model ID into readable name
 */
export function formatModelName(modelId: string): string {
    // Clean up common patterns
    return modelId
        .replace(/^[A-Z]{2,4}\d+-/i, '') // Remove region prefix
        .replace(/ModelInference-/gi, '')
        .replace(/-/g, ' ')
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
