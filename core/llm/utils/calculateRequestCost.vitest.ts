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

    // Anthropic Claude 4.x models that are not Opus 4.5+
    {
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0105,
      description: "Claude Sonnet 4.5",
    },
    {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0105,
      description: "Claude Sonnet 4",
    },
    {
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      promptTokens: 1000,
      completionTokens: 500,
      cachedTokens: 2000,
      expectedCost: 0.0037,
      description: "Claude Haiku 4.5 with cache reads",
    },
    {
      provider: "anthropic",
      model: "claude-opus-4-1-20250805",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0525,
      description: "Claude Opus 4.1",
    },
    {
      provider: "anthropic",
      model: "claude-opus-4-20250514",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0525,
      description: "Claude Opus 4 (dated id)",
    },
    {
      provider: "anthropic",
      model: "claude-opus-4-6",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0175,
      description: "Claude Opus 4.6 is not priced as Opus 4",
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
    {
      provider: "openai",
      model: "gpt-3.5-turbo",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.00125,
      description: "GPT-3.5 Turbo bare alias (points to 0125)",
    },
    {
      provider: "openai",
      model: "gpt-3.5-turbo-instruct",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0025,
      description: "GPT-3.5 Turbo Instruct",
    },
    {
      provider: "openai",
      model: "gpt-3.5-turbo-16k-0613",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.005,
      description: "GPT-3.5 Turbo 16k",
    },

    // OpenAI models that used to fall through to base GPT-4 / GPT-4o
    {
      provider: "openai",
      model: "gpt-4.1",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.006,
      description: "GPT-4.1 is not priced as base GPT-4",
    },
    {
      provider: "openai",
      model: "gpt-4.1-mini-2025-04-14",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0012,
      description: "GPT-4.1 mini",
    },
    {
      provider: "openai",
      model: "gpt-4.1-nano",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0003,
      description: "GPT-4.1 nano",
    },
    {
      provider: "openai",
      model: "gpt-4-32k",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.12,
      description: "GPT-4 32k",
    },
    {
      provider: "openai",
      model: "gpt-4o-2024-05-13",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0125,
      description: "GPT-4o original snapshot",
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
