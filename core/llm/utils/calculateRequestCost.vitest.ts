import { allLlms } from "@continuedev/llm-info";
import { describe, expect, it } from "vitest";

import type { Usage } from "../..";

import {
  calculateRequestCost,
  CostBreakdown,
  findAnthropicPricing,
  normalizeClaudeModelId,
} from "./calculateRequestCost";

interface TestCase {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  expectedCost: number | null;
  description?: string;
}

describe("calculateRequestCost", () => {
  const testCases: TestCase[] = [
    // Anthropic Claude 3.5 Sonnet
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0105,
      description: "Claude 3.5 Sonnet basic usage",
    },
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      promptTokens: 1000,
      completionTokens: 500,
      cachedTokens: 2000,
      expectedCost: 0.0111,
      description: "Claude 3.5 Sonnet with cache reads",
    },
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      promptTokens: 1000,
      completionTokens: 500,
      cacheWriteTokens: 300,
      expectedCost: 0.011625,
      description: "Claude 3.5 Sonnet with cache writes",
    },
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20240620",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0105,
      description: "Claude 3.5 Sonnet (older version)",
    },

    // Anthropic Claude 3.5 Haiku
    {
      provider: "anthropic",
      model: "claude-3-5-haiku-20241022",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0028,
      description: "Claude 3.5 Haiku",
    },

    // Anthropic Claude 3 Haiku (legacy)
    {
      provider: "anthropic",
      model: "claude-3-haiku-20240307",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.000875,
      description: "Claude 3 Haiku legacy",
    },

    // Anthropic Claude 3 Opus
    {
      provider: "anthropic",
      model: "claude-3-opus-20240229",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0525,
      description: "Claude 3 Opus",
    },

    // Anthropic Claude Opus 4.5
    {
      provider: "anthropic",
      model: "claude-opus-4-5-20251101",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0175,
      description: "Claude Opus 4.5 basic usage",
    },
    {
      provider: "anthropic",
      model: "claude-opus-4-5-latest",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0175,
      description: "Claude Opus 4.5 latest (partial match)",
    },
    {
      provider: "anthropic",
      model: "claude-opus-4-5-20251101",
      promptTokens: 1000,
      completionTokens: 500,
      cachedTokens: 2000,
      expectedCost: 0.0185,
      description: "Claude Opus 4.5 with cache reads",
    },
    {
      provider: "anthropic",
      model: "claude-opus-4-5-20251101",
      promptTokens: 1000,
      completionTokens: 500,
      cacheWriteTokens: 300,
      expectedCost: 0.019375,
      description: "Claude Opus 4.5 with cache writes",
    },

    // OpenAI GPT-4
    {
      provider: "openai",
      model: "gpt-4",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.06,
      description: "GPT-4 basic usage",
    },
    {
      provider: "openai",
      model: "gpt-4-turbo",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.025,
      description: "GPT-4 Turbo",
    },
    {
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0075,
      description: "GPT-4o",
    },
    {
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.00045,
      description: "GPT-4o-mini",
    },

    // OpenAI GPT-3.5
    {
      provider: "openai",
      model: "gpt-3.5-turbo-0125",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.00125,
      description: "GPT-3.5 Turbo",
    },

    // Edge cases
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      promptTokens: 0,
      completionTokens: 0,
      expectedCost: 0,
      description: "Zero tokens",
    },
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      promptTokens: 1000,
      completionTokens: 0,
      expectedCost: 0.003,
      description: "Only input tokens",
    },
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      promptTokens: 0,
      completionTokens: 500,
      expectedCost: 0.0075,
      description: "Only output tokens",
    },

    // Case insensitivity
    {
      provider: "ANTHROPIC",
      model: "claude-3-5-sonnet-20241022",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0105,
      description: "Provider name case insensitive",
    },

    // Unknown models/providers
    {
      provider: "anthropic",
      model: "claude-unknown-model",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: null,
      description: "Unknown Anthropic model",
    },
    {
      provider: "google",
      model: "gemini-pro",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: null,
      description: "Unknown provider",
    },
  ];

  testCases.forEach(
    ({
      provider,
      model,
      promptTokens,
      completionTokens,
      cachedTokens,
      cacheWriteTokens,
      expectedCost,
      description,
    }) => {
      it(description || `${provider}/${model}`, () => {
        const usage: Usage = {
          promptTokens,
          completionTokens,
          promptTokensDetails:
            cachedTokens || cacheWriteTokens
              ? {
                  cachedTokens,
                  cacheWriteTokens,
                }
              : undefined,
        };

        const result = calculateRequestCost(provider, model, usage);

        if (expectedCost === null) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
          expect(result!.cost).toBeCloseTo(expectedCost, 6);
        }
      });
    },
  );
});

describe("calculateRequestCost cache lifetimes and providers", () => {
  // Sonnet 4.6: $3 in, $15 out, 5m write $3.75, 1h write $6, read $0.30 per MTok.
  it("prices 1-hour writes at 2x the input price", () => {
    const result = calculateRequestCost("anthropic", "claude-sonnet-4-6", {
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: {
        cacheWriteTokens: 1_000_000,
        cacheWriteTokens5m: 0,
        cacheWriteTokens1h: 1_000_000,
      },
    });
    expect(result!.cost).toBeCloseTo(6, 6);
    expect(result!.breakdown).toContain("Cache Write (1h)");
  });

  it("prices a mixed write at each lifetime's rate", () => {
    const result = calculateRequestCost("anthropic", "claude-sonnet-4-6", {
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: {
        cacheWriteTokens: 1_000_000,
        cacheWriteTokens5m: 400_000,
        cacheWriteTokens1h: 600_000,
      },
    });
    // 0.4 * 3.75 + 0.6 * 6 = 5.1
    expect(result!.cost).toBeCloseTo(5.1, 6);
  });

  it("prices all writes as 5-minute when no split is reported", () => {
    const result = calculateRequestCost("anthropic", "claude-sonnet-4-6", {
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: { cacheWriteTokens: 1_000_000 },
    });
    expect(result!.cost).toBeCloseTo(3.75, 6);
  });

  it("does not price more 1-hour tokens than the total written", () => {
    const result = calculateRequestCost("anthropic", "claude-sonnet-4-6", {
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: {
        cacheWriteTokens: 1_000_000,
        cacheWriteTokens1h: 5_000_000,
      },
    });
    expect(result!.cost).toBeCloseTo(6, 6);
  });

  it.each([
    // [model, input $/MTok, output $/MTok]
    ["claude-haiku-4-5-20251001", 1, 5],
    ["claude-sonnet-4-5-20250929", 3, 15],
    ["claude-sonnet-4-20250514", 3, 15],
    ["claude-opus-4-8", 5, 25],
    ["claude-opus-4-7", 5, 25],
    ["claude-opus-4-1-20250805", 15, 75],
    ["claude-opus-4-20250514", 15, 75],
  ])("has a price for %s", (model, input, output) => {
    const result = calculateRequestCost("anthropic", model, {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    expect(result).not.toBeNull();
    expect(result!.cost).toBeCloseTo(input + output, 6);
  });

  it("does not price a future Opus 4 version at an older version's price", () => {
    expect(
      calculateRequestCost("anthropic", "claude-opus-4-9", {
        promptTokens: 1000,
        completionTokens: 1000,
      }),
    ).toBeNull();
  });

  it.each([
    ["bedrock", "us.anthropic.claude-sonnet-4-5-20250929-v1:0"],
    ["bedrock", "anthropic.claude-opus-4-6-v1"],
    ["vertexai", "claude-sonnet-4-5@20250929"],
    ["openrouter", "anthropic/claude-sonnet-4.5"],
  ])("prices Claude on %s as %s", (provider, model) => {
    const result = calculateRequestCost(provider, model, {
      promptTokens: 1_000_000,
      completionTokens: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.cost).toBeGreaterThan(0);
  });

  it("returns null for non-Claude models on those providers", () => {
    expect(
      calculateRequestCost("bedrock", "amazon.nova-pro-v1:0", {
        promptTokens: 1000,
        completionTokens: 1000,
      }),
    ).toBeNull();
    expect(
      calculateRequestCost("openrouter", "openai/gpt-4o", {
        promptTokens: 1000,
        completionTokens: 1000,
      }),
    ).toBeNull();
  });
});

describe("normalizeClaudeModelId", () => {
  it.each([
    ["claude-sonnet-4-6", "claude-sonnet-4-6"],
    [
      "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "claude-sonnet-4-5-20250929",
    ],
    ["anthropic.claude-opus-4-6-v1", "claude-opus-4-6"],
    ["claude-sonnet-4-5@20250929", "claude-sonnet-4-5"],
    ["anthropic/claude-sonnet-4.5", "claude-sonnet-4-5"],
    ["gpt-4o", undefined],
  ])("%s -> %s", (model, expected) => {
    expect(normalizeClaudeModelId(model)).toBe(expected);
  });
});

describe("every Claude model in llm-info has a price", () => {
  const claudeIds = allLlms
    .filter((m) => m.provider === "anthropic" || m.provider === "bedrock")
    .map((m) => m.model)
    .filter((id) => normalizeClaudeModelId(id) !== undefined)
    // llm-info keeps entries for retired Claude 2 models and a bare alias; the
    // cost table only covers Claude 3 and later.
    .filter((id) => !/claude-(2|instant)/.test(id));

  it.each(claudeIds)("%s", (id) => {
    expect(findAnthropicPricing(id)).not.toBeNull();
  });
});
