import { describe, expect, it } from "vitest";

import type { Usage } from "../..";

import { calculateRequestCost, CostBreakdown } from "./calculateRequestCost";

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

    // OpenAI prompt caching (promptTokens includes cachedTokens)
    {
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 1000,
      completionTokens: 500,
      cachedTokens: 800,
      expectedCost: 0.0065,
      description: "GPT-4o with cache reads",
    },
    {
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 1000,
      completionTokens: 500,
      cachedTokens: 1000,
      expectedCost: 0.000375,
      description: "GPT-4o-mini fully cached input",
    },
    {
      provider: "openai",
      model: "gpt-4-turbo",
      promptTokens: 1000,
      completionTokens: 500,
      cachedTokens: 400,
      expectedCost: 0.025,
      description: "GPT-4 Turbo cache reads bill at the input rate",
    },
    {
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 500,
      completionTokens: 0,
      cachedTokens: 1000,
      expectedCost: 0.000625,
      description: "GPT-4o cached tokens exceeding prompt tokens",
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

  it("excludes cached tokens from the OpenAI input breakdown", () => {
    const result = calculateRequestCost("openai", "gpt-4o", {
      promptTokens: 1000,
      completionTokens: 500,
      promptTokensDetails: { cachedTokens: 800 },
    });

    expect(result!.breakdown).toContain(
      "Input: 200 tokens × $2.5/MTok = $0.000500",
    );
    expect(result!.breakdown).toContain(
      "Cache Read: 800 tokens × $1.25/MTok = $0.001000",
    );
  });
});
