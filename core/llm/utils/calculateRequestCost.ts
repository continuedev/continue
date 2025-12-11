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

  // Define pricing per million tokens (MTok) by model family prefix
  const pricing: Record<
    string,
    { input: number; output: number; cacheWrite: number; cacheRead: number }
  > = {
    // Claude Opus 4.5 (most intelligent model)
    "claude-opus-4-5": {
      input: 5,
      output: 25,
      cacheWrite: 6.25,
      cacheRead: 0.5,
    },

    // Claude Opus 4 (legacy)
    "claude-3-opus": {
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

    // Claude Haiku 3.5 (fastest, most cost-effective)
    "claude-3-5-haiku": {
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
  };

  // Sort keys by length (longest first) to match most specific patterns first
  const sortedKeys = Object.keys(pricing).sort((a, b) => b.length - a.length);

  let modelPricing = null;
  for (const prefix of sortedKeys) {
    if (normalizedModel.startsWith(prefix)) {
      modelPricing = pricing[prefix];
      break;
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

function calculateOpenAICost(
  model: string,
  usage: Usage,
): CostBreakdown | null {
  // Normalize model name
  const normalizedModel = model.toLowerCase();

  // Define pricing per million tokens (MTok) by model family prefix
  const pricing: Record<string, { input: number; output: number }> = {
    // GPT-4o models (most specific first)
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4o": { input: 2.5, output: 10 },

    // GPT-4 Turbo models
    "gpt-4-turbo": { input: 10, output: 30 },

    // GPT-3.5 Turbo models (most specific first)
    "gpt-3.5-turbo-0125": { input: 0.5, output: 1.5 },
    "gpt-3.5-turbo-1106": { input: 1, output: 2 },
    "gpt-3.5-turbo": { input: 1.5, output: 2 },

    // Base GPT-4 (fallback for other gpt-4 variants)
    "gpt-4": { input: 30, output: 60 },
  };

  // Sort keys by length (longest first) to match most specific patterns first
  const sortedKeys = Object.keys(pricing).sort((a, b) => b.length - a.length);

  let modelPricing = null;
  for (const prefix of sortedKeys) {
    if (normalizedModel.startsWith(prefix)) {
      modelPricing = pricing[prefix];
      break;
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

  if (usage.promptTokens > 0) {
    breakdownParts.push(
      `Input: ${usage.promptTokens.toLocaleString()} tokens × $${modelPricing.input}/MTok = $${inputCost.toFixed(6)}`,
    );
  }

  if (usage.completionTokens > 0) {
    breakdownParts.push(
      `Output: ${usage.completionTokens.toLocaleString()} tokens × $${modelPricing.output}/MTok = $${outputCost.toFixed(6)}`,
    );
  }

  const totalCost = inputCost + outputCost;

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
  switch (provider.toLowerCase()) {
    case "anthropic":
      return calculateAnthropicCost(model, usage);
    case "openai":
      return calculateOpenAICost(model, usage);
    default:
      return null;
  }
}
