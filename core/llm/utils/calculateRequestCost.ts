import modelPricing from "./modelPricing.json";
import { Usage } from "../..";

export interface CostBreakdown {
  cost: number;
  breakdown: string;
}

export interface ModelPricing {
  /** USD per 1M tokens */
  input: number;
  /** USD per 1M tokens */
  output: number;
  /** USD per 1M tokens. Only providers that charge for cache writes set this. */
  cacheWrite?: number;
  /** USD per 1M tokens. Only providers that charge for cache reads set this. */
  cacheRead?: number;
}

export type PricingTable = Record<string, ModelPricing>;

interface PricingFile {
  source: string;
  providers: Record<string, PricingTable>;
}

const pricingFile = modelPricing as PricingFile;

function getPricing(pricing: PricingTable, model: string): ModelPricing | null {
  // Normalize model name to handle various formats
  const normalizedModel = model.toLowerCase();

  // Sort keys by length (longest first) to match most specific patterns first
  const sortedKeys = Object.keys(pricing).sort((a, b) => b.length - a.length);

  for (const prefix of sortedKeys) {
    if (normalizedModel.startsWith(prefix)) {
      return pricing[prefix];
    }
  }

  return null; // Unknown model
}

function calculateCost(
  model: string,
  usage: Usage,
  modelPricing: ModelPricing,
): CostBreakdown {
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

    if (
      cacheWriteTokens &&
      cacheWriteTokens > 0 &&
      modelPricing.cacheWrite !== undefined
    ) {
      const cacheWriteCost =
        (cacheWriteTokens / 1_000_000) * modelPricing.cacheWrite;
      cacheCost += cacheWriteCost;
      breakdownParts.push(
        `Cache Write: ${cacheWriteTokens.toLocaleString()} tokens × $${modelPricing.cacheWrite}/MTok = $${cacheWriteCost.toFixed(6)}`,
      );
    }

    if (
      cachedTokens &&
      cachedTokens > 0 &&
      modelPricing.cacheRead !== undefined
    ) {
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
  const pricing = pricingFile.providers[provider.toLowerCase()];
  if (!pricing) {
    return null; // Unknown provider
  }

  const modelPrice = getPricing(pricing, model);
  if (!modelPrice) {
    return null; // Unknown model
  }

  return calculateCost(model, usage, modelPrice);
}
