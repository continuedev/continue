import { Usage } from "../..";

export interface CostBreakdown {
  cost: number;
  breakdown: string;
}

function calculateAnthropicCost(
  model: string,
  usage: Usage,
): CostBreakdown | null {
  // Normalize model name to handle various formats
  const normalizedModel = model.toLowerCase();

  // Define pricing per million tokens (MTok)
  const pricing: Record<
    string,
    { input: number; output: number; cacheWrite: number; cacheRead: number }
  > = {
    // Claude Opus 4 (most intelligent model)
    "claude-3-opus": {
      input: 15,
      output: 75,
      cacheWrite: 18.75,
      cacheRead: 1.5,
    },
    "claude-3-opus-20240229": {
      input: 15,
      output: 75,
      cacheWrite: 18.75,
      cacheRead: 1.5,
    },

    // Claude Sonnet 4 (optimal balance)
    "claude-3-5-sonnet": {
      input: 3,
      output: 15,
      cacheWrite: 3.75,
      cacheRead: 0.3,
    },
    "claude-3-5-sonnet-20241022": {
      input: 3,
      output: 15,
      cacheWrite: 3.75,
      cacheRead: 0.3,
    },
    "claude-3-5-sonnet-20240620": {
      input: 3,
      output: 15,
      cacheWrite: 3.75,
      cacheRead: 0.3,
    },

    // Claude Haiku 3.5 (fastest, most cost-effective)
    "claude-3-5-haiku": {
      input: 0.8,
      output: 4,
      cacheWrite: 1,
      cacheRead: 0.08,
    },
    "claude-3-5-haiku-20241022": {
      input: 0.8,
      output: 4,
      cacheWrite: 1,
      cacheRead: 0.08,
    },

    // Legacy Claude 3 Haiku
    "claude-3-haiku": {
      input: 0.25,
      output: 1.25,
      cacheWrite: 0.3,
      cacheRead: 0.03,
    },
    "claude-3-haiku-20240307": {
      input: 0.25,
      output: 1.25,
      cacheWrite: 0.3,
      cacheRead: 0.03,
    },
  };

  // Find matching pricing model
  let modelPricing = pricing[normalizedModel];

  // If exact match not found, try to find by partial match
  if (!modelPricing) {
    for (const [key, value] of Object.entries(pricing)) {
      if (normalizedModel.includes(key) || key.includes(normalizedModel)) {
        modelPricing = value;
        break;
      }
    }
  }

  // If still no match, try common patterns
  if (!modelPricing) {
    if (normalizedModel.includes("opus")) {
      modelPricing = pricing["claude-3-opus"];
    } else if (normalizedModel.includes("sonnet")) {
      modelPricing = pricing["claude-3-5-sonnet"];
    } else if (normalizedModel.includes("haiku")) {
      modelPricing = pricing["claude-3-5-haiku"];
    }
  }

  if (!modelPricing) {
    return null; // Unknown model
  }

  // Calculate costs
  const inputCost = (usage.promptTokens / 1_000_000) * modelPricing.input;
  const outputCost = (usage.completionTokens / 1_000_000) * modelPricing.output;

  // Build breakdown components
  const breakdownParts: string[] = [];

  // Input tokens breakdown
  if (usage.promptTokens > 0) {
    breakdownParts.push(
      `Input: ${usage.promptTokens.toLocaleString()} tokens × $${modelPricing.input}/MTok = $${inputCost.toFixed(6)}`,
    );
  }

  // Output tokens breakdown
  if (usage.completionTokens > 0) {
    breakdownParts.push(
      `Output: ${usage.completionTokens.toLocaleString()} tokens × $${modelPricing.output}/MTok = $${outputCost.toFixed(6)}`,
    );
  }

  // Handle prompt caching costs if available
  let cacheCost = 0;
  if (usage.promptTokensDetails) {
    const { cachedTokens, cacheWriteTokens } = usage.promptTokensDetails;

    if (cacheWriteTokens && cacheWriteTokens > 0) {
      const cacheWriteCost =
        (cacheWriteTokens / 1_000_000) * modelPricing.cacheWrite;
      cacheCost += cacheWriteCost;
      breakdownParts.push(
        `Cache Write: ${cacheWriteTokens.toLocaleString()} tokens × $${modelPricing.cacheWrite}/MTok = $${cacheWriteCost.toFixed(6)}`,
      );
    }

    if (cachedTokens && cachedTokens > 0) {
      const cacheReadCost = (cachedTokens / 1_000_000) * modelPricing.cacheRead;
      cacheCost += cacheReadCost;
      breakdownParts.push(
        `Cache Read: ${cachedTokens.toLocaleString()} tokens × $${modelPricing.cacheRead}/MTok = $${cacheReadCost.toFixed(6)}`,
      );
    }
  }

  const totalCost = inputCost + outputCost + cacheCost;

  // Build final breakdown string
  let breakdown = `Model: ${model}\n`;
  breakdown += breakdownParts.join("\n");
  if (breakdownParts.length > 1) {
    breakdown += `\nTotal: $${totalCost.toFixed(6)}`;
  }

  return {
    cost: totalCost,
    breakdown,
  };
}

export function calculateRequestCost(
  provider: string,
  model: string,
  usage: Usage,
): CostBreakdown | null {
  switch (provider) {
    case "anthropic":
      return calculateAnthropicCost(model, usage);
    default:
      return null;
  }
}
