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

type PricingTable = Record<string, ModelPricing>;

// Prices are in USD per 1M tokens and come from models.dev
// (https://models.dev, the same open-source pricing database used by OpenCode),
// retrieved on 2026-08-08.
//
// Keys are model-family prefixes, matched longest-first. Display-only, not
// billing-authoritative: providers may change prices at any time.

const ANTHROPIC_PRICING: PricingTable = {
  // Claude Sonnet 4.6
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },

  // Claude Opus 4.6
  "claude-opus-4-6": {
    input: 5,
    output: 25,
    cacheWrite: 6.25,
    cacheRead: 0.5,
  },

  // Claude Opus 4.5 (previous generation)
  "claude-opus-4-5": {
    input: 5,
    output: 25,
    cacheWrite: 6.25,
    cacheRead: 0.5,
  },

  // Claude Sonnet 4.5 (previous generation)
  "claude-sonnet-4-5": {
    input: 3,
    output: 15,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },

  // Claude Haiku 4.5
  "claude-haiku-4-5": {
    input: 1,
    output: 5,
    cacheWrite: 1.25,
    cacheRead: 0.1,
  },

  // Claude Opus 4 (legacy)
  "claude-3-opus": {
    input: 15,
    output: 75,
    cacheWrite: 18.75,
    cacheRead: 1.5,
  },

  // Claude Sonnet 4 (legacy)
  "claude-3-5-sonnet": {
    input: 3,
    output: 15,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },

  // Claude Haiku 3.5 (legacy)
  "claude-3-5-haiku": {
    input: 0.8,
    output: 4,
    cacheWrite: 1,
    cacheRead: 0.08,
  },

  // Claude 3 Haiku (legacy)
  "claude-3-haiku": {
    input: 0.25,
    output: 1.25,
    cacheWrite: 0.3,
    cacheRead: 0.03,
  },
};

const OPENAI_PRICING: PricingTable = {
  // GPT-4o models (most specific first)
  "gpt-4o-mini": {
    input: 0.15,
    output: 0.6,
    cacheRead: 0.075,
  },
  "gpt-4o": {
    input: 2.5,
    output: 10,
    cacheRead: 1.25,
  },

  // GPT-4 Turbo models
  "gpt-4-turbo": { input: 10, output: 30 },

  // GPT-3.5 Turbo models (most specific first)
  "gpt-3.5-turbo-0125": { input: 0.5, output: 1.5 },
  "gpt-3.5-turbo-1106": { input: 1, output: 2 },
  "gpt-3.5-turbo": { input: 1.5, output: 2 },

  // Base GPT-4 (fallback for other gpt-4 variants)
  "gpt-4": { input: 30, output: 60 },
};

const DEEPSEEK_PRICING: PricingTable = {
  "deepseek-reasoner": {
    input: 0.14,
    output: 0.28,
    cacheRead: 0.0028,
  },
  "deepseek-chat": {
    input: 0.14,
    output: 0.28,
    cacheRead: 0.0028,
  },
};

const GEMINI_PRICING: PricingTable = {
  // Gemini 2.5 Pro
  "gemini-2.5-pro": {
    input: 1.25,
    output: 10,
    cacheRead: 0.125,
  },

  // Gemini 2.5 Flash
  "gemini-2.5-flash": {
    input: 0.3,
    output: 2.5,
    cacheRead: 0.03,
  },

  // Gemini 2.0 Flash
  "gemini-2.0-flash": {
    input: 0.1,
    output: 0.4,
    cacheRead: 0.025,
  },
};

const MISTRAL_PRICING: PricingTable = {
  "mistral-large-latest": { input: 0.5, output: 1.5 },
  "mistral-small-latest": { input: 0.15, output: 0.6 },
};

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
  let pricing: PricingTable | null = null;
  switch (provider.toLowerCase()) {
    case "anthropic":
      pricing = ANTHROPIC_PRICING;
      break;
    case "openai":
      pricing = OPENAI_PRICING;
      break;
    case "deepseek":
      pricing = DEEPSEEK_PRICING;
      break;
    case "gemini":
      pricing = GEMINI_PRICING;
      break;
    case "mistral":
      pricing = MISTRAL_PRICING;
      break;
    default:
      return null;
  }

  const modelPricing = getPricing(pricing, model);
  if (!modelPricing) {
    return null; // Unknown model
  }

  return calculateCost(model, usage, modelPricing);
}
