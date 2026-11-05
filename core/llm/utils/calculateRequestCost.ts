import { Usage } from "../..";

export interface CostBreakdown {
  cost: number;
  breakdown: string;
}

/**
 * Anthropic list prices, USD per million tokens (MTok). The Claude 4.x rows
 * were checked against platform.claude.com/docs/en/build-with-claude/prompt-caching
 * on 2026-11-02. The Claude 3.x rows (retired models) are carried over from the
 * previous table and were not rechecked, except Haiku 3.5, which is on that
 * page. Prices change, so the figures shown in the UI are estimates.
 *
 * Cache multipliers on the base input price: 5-minute write 1.25x, 1-hour
 * write 2x, read 0.1x.
 */
const CACHE_WRITE_5M_MULTIPLIER = 1.25;
const CACHE_WRITE_1H_MULTIPLIER = 2;

export interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number; // 5-minute write
  cacheWrite1h: number;
  cacheRead: number;
  /**
   * Prices for a request whose whole prompt (uncached input plus cache reads
   * and writes) is longer than `aboveTokens`. The higher prices apply to every
   * token of that request, not only the tokens above the limit.
   */
  longContext?: { aboveTokens: number; pricing: ModelPricing };
}

/** Cache reads cost 0.1x the input price, except on Opus 5.5 and Sonnet 5.5 (0.05x). */
function anthropicPricing(
  input: number,
  output: number,
  readMultiplier = 0.1,
): ModelPricing {
  return {
    input,
    output,
    cacheWrite: input * CACHE_WRITE_5M_MULTIPLIER,
    cacheWrite1h: input * CACHE_WRITE_1H_MULTIPLIER,
    cacheRead: input * readMultiplier,
  };
}

/**
 * Prices by model-family prefix of the normalized ID (see
 * `normalizeClaudeModelId`). The longest matching prefix wins. Entries are exact
 * versions rather than bare families (for example `claude-opus-4-1`, not
 * `claude-opus-4`) so a future version is left unpriced instead of getting an
 * older, different price.
 */
export const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  // Claude 5 and 5.5, list prices checked 2026-11-03 at
  // platform.claude.com/docs/en/about-claude/pricing. These are list prices;
  // `findAnthropicPricing` adds the Bedrock `us.` profile premium.
  "claude-opus-5-5": anthropicPricing(4, 20, 0.05),
  "claude-opus-5": anthropicPricing(5, 25),
  // Fable and Mythos: $10 / $50, 5m write 1.25x, 1h write 2x. Reads are 0.025x
  // on the 5.1 releases and 0.1x on 5 (pricing page, checked 2026-11-04).
  "claude-fable-5-1": anthropicPricing(10, 50, 0.025),
  "claude-fable-5": anthropicPricing(10, 50),
  "claude-mythos-5-1": anthropicPricing(10, 50, 0.025),
  "claude-mythos-5": anthropicPricing(10, 50),
  "claude-sonnet-5-5": anthropicPricing(2, 10, 0.05),
  "claude-sonnet-5": anthropicPricing(2, 10),
  "claude-haiku-5-5": {
    ...anthropicPricing(0.1, 0.5),
    longContext: { aboveTokens: 100_000, pricing: anthropicPricing(0.5, 2.5) },
  },
  "claude-sonnet-4-6": anthropicPricing(3, 15),
  "claude-sonnet-4-5": anthropicPricing(3, 15),
  "claude-sonnet-4-2025": anthropicPricing(3, 15), // claude-sonnet-4-20250514
  "claude-opus-4-8": anthropicPricing(5, 25),
  "claude-opus-4-7": anthropicPricing(5, 25),
  "claude-opus-4-6": anthropicPricing(5, 25),
  "claude-opus-4-5": anthropicPricing(5, 25),
  "claude-opus-4-1": anthropicPricing(15, 75),
  "claude-opus-4-2025": anthropicPricing(15, 75), // claude-opus-4-20250514
  "claude-haiku-4-5": anthropicPricing(1, 5),
  "claude-3-7-sonnet": anthropicPricing(3, 15),
  "claude-3-5-sonnet": anthropicPricing(3, 15),
  "claude-3-5-haiku": anthropicPricing(0.8, 4),
  "claude-3-sonnet": anthropicPricing(3, 15),
  "claude-3-opus": anthropicPricing(15, 75),
  // Legacy Claude 3 Haiku has its own cache prices, not the 1.25x/0.1x rule.
  "claude-3-haiku": {
    input: 0.25,
    output: 1.25,
    cacheWrite: 0.3,
    cacheWrite1h: 0.5,
    cacheRead: 0.03,
  },
};

/**
 * Reduce the model ID formats of Anthropic, Bedrock (`us.anthropic.claude-...-v1:0`),
 * Vertex (`claude-...@20250929`) and dotted names (`claude-sonnet-4.5`) to the
 * dash form used by `ANTHROPIC_PRICING`. Returns undefined for non-Claude IDs.
 */
export function normalizeClaudeModelId(model: string): string | undefined {
  let id = model.toLowerCase();
  const claudeAt = id.indexOf("claude");
  if (claudeAt === -1) return undefined;
  id = id.slice(claudeAt);
  id = id.replace(/@.*$/, "").replace(/-v\d+(:\d+)?$/, "");
  id = id.replace(/(\d)\.(\d)/g, "$1-$2");
  return id;
}

/**
 * Bare names without a date that mean one specific release (the original
 * Claude 4 models). Matched exactly, never as a prefix, so a later
 * `claude-opus-4-9` is not priced as Opus 4.
 */
const EXACT_ALIASES: Record<string, string> = {
  "claude-sonnet-4": "claude-sonnet-4-2025",
  "claude-opus-4": "claude-opus-4-2025",
};

/**
 * True when what follows a matched prefix is a further minor version (`-6` in
 * `claude-sonnet-5-6`) rather than a date (`-20250929`) or a suffix. A
 * `claude-sonnet-5` entry must not price a later `claude-sonnet-5-6`.
 */
function continuesWithMinorVersion(rest: string): boolean {
  return /^-\d{1,2}(?:-|$)/.test(rest);
}

/**
 * Anthropic: "Regional and multi-region endpoints include a 10 percent premium
 * over global endpoints", for Claude Sonnet 4.5, Haiku 4.5, Opus 4.5 and all
 * later models; "earlier models retain their existing pricing"
 * (platform.claude.com/docs/en/about-claude/pricing, checked 2026-11-04).
 * Measured on one week of Bedrock invocation logs: a `us.` profile billed 1.10
 * times list on every component (input, output, cache reads, both write
 * lifetimes).
 *
 * On Bedrock the endpoint type is the prefix of the model ID: the geographic
 * ones (`us.`, `eu.`, `apac.`, `jp.`, `au.`, `ca.`) carry the premium and
 * `global.` does not. `us-gov.` is GovCloud, which is priced separately, so it
 * is left at list. A bare ID with `crossRegionInference` set is prefixed later,
 * at request time, so it cannot be seen here and stays at list.
 *
 * Only `us.` was seen in billing data; the other prefixes follow the vendor's
 * statement and are not measured.
 */
const BEDROCK_GEO_PROFILE_FACTOR = 1.1;
const BEDROCK_GEO_PREFIX = /^(us|eu|apac|jp|au|ca)\.anthropic\./i;
/** Normalized IDs of the models the premium applies to: 4.5 and later. */
const REGIONAL_PREMIUM_MODELS =
  /^claude-(?:(?:opus|sonnet|haiku)-(?:4-[5-9]|[5-9])|fable|mythos)/;

/** The multiplier to apply to list prices for this model ID. */
export function bedrockRegionalPriceFactor(model: string): number {
  if (!BEDROCK_GEO_PREFIX.test(model)) return 1;
  const id = normalizeClaudeModelId(model);
  return id && REGIONAL_PREMIUM_MODELS.test(id)
    ? BEDROCK_GEO_PROFILE_FACTOR
    : 1;
}

/** Scale a price and drop the floating-point tail (3 * 1.1 is 3.3000000000000003). */
function scalePrice(price: number, factor: number): number {
  return Math.round(price * factor * 1e6) / 1e6;
}

function scalePricing(pricing: ModelPricing, factor: number): ModelPricing {
  if (factor === 1) return pricing;
  const scaled: ModelPricing = {
    input: scalePrice(pricing.input, factor),
    output: scalePrice(pricing.output, factor),
    cacheWrite: scalePrice(pricing.cacheWrite, factor),
    cacheWrite1h: scalePrice(pricing.cacheWrite1h, factor),
    cacheRead: scalePrice(pricing.cacheRead, factor),
  };
  if (pricing.longContext) {
    scaled.longContext = {
      aboveTokens: pricing.longContext.aboveTokens,
      pricing: scalePricing(pricing.longContext.pricing, factor),
    };
  }
  return scaled;
}

/**
 * @param inputTokens The request's whole prompt. When the model has a
 * long-context tier and the prompt is over its limit, the tier's prices are
 * returned.
 */
export function findAnthropicPricing(
  model: string,
  inputTokens?: number,
): ModelPricing | null {
  const pricing = findListPricing(model, inputTokens);
  return pricing && scalePricing(pricing, bedrockRegionalPriceFactor(model));
}

function findListPricing(
  model: string,
  inputTokens?: number,
): ModelPricing | null {
  let id = normalizeClaudeModelId(model);
  if (!id) return null;
  id = EXACT_ALIASES[id] ?? id;
  const sortedKeys = Object.keys(ANTHROPIC_PRICING).sort(
    (a, b) => b.length - a.length,
  );
  for (const prefix of sortedKeys) {
    if (
      id.startsWith(prefix) &&
      !continuesWithMinorVersion(id.slice(prefix.length))
    ) {
      const pricing = ANTHROPIC_PRICING[prefix];
      const tier = pricing.longContext;
      if (tier && inputTokens !== undefined && inputTokens > tier.aboveTokens) {
        return tier.pricing;
      }
      return pricing;
    }
  }
  return null;
}

function calculateAnthropicCost(
  model: string,
  usage: Usage,
): CostBreakdown | null {
  // The whole prompt decides the price tier. For Claude, `promptTokens` leaves
  // out the cache reads and writes, so add them back.
  const wholePrompt =
    usage.promptTokens +
    (usage.promptTokensDetails?.cachedTokens ?? 0) +
    (usage.promptTokensDetails?.cacheWriteTokens ?? 0);
  const modelPricing = findAnthropicPricing(model, wholePrompt);
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
    const {
      cachedTokens,
      cacheWriteTokens,
      cacheWriteTokens5m,
      cacheWriteTokens1h,
    } = usage.promptTokensDetails;

    // Writes are split by lifetime when the provider reports it. Anything not
    // attributed to the 1-hour lifetime is priced as a 5-minute write.
    const writes1h = Math.min(cacheWriteTokens1h ?? 0, cacheWriteTokens ?? 0);
    const writes5m =
      cacheWriteTokens5m !== undefined && cacheWriteTokens1h !== undefined
        ? cacheWriteTokens5m
        : (cacheWriteTokens ?? 0) - writes1h;

    if (writes5m > 0) {
      const cost5m = (writes5m / 1_000_000) * modelPricing.cacheWrite;
      cacheCost += cost5m;
      breakdownParts.push(
        `Cache Write (5m): ${writes5m.toLocaleString()} tokens × $${modelPricing.cacheWrite}/MTok = $${cost5m.toFixed(6)}`,
      );
    }

    if (writes1h > 0) {
      const cost1h = (writes1h / 1_000_000) * modelPricing.cacheWrite1h;
      cacheCost += cost1h;
      breakdownParts.push(
        `Cache Write (1h): ${writes1h.toLocaleString()} tokens × $${modelPricing.cacheWrite1h}/MTok = $${cost1h.toFixed(6)}`,
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
  const regionalFactor = bedrockRegionalPriceFactor(model);
  if (regionalFactor !== 1) {
    breakdown += `Prices: Anthropic list × ${regionalFactor} (Bedrock regional endpoint)\n`;
  }
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
    // Claude models served by other providers use the same list prices as an
    // estimate. Regional pricing, data residency and reseller margins can differ.
    case "bedrock":
    case "vertexai":
    case "openrouter":
      return calculateAnthropicCost(model, usage);
    case "openai":
      return calculateOpenAICost(model, usage);
    default:
      return null;
  }
}
