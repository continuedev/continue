import { allLlms } from "@continuedev/llm-info";
import { describe, expect, it } from "vitest";

import type { Usage } from "../..";

import {
  bedrockRegionalPriceFactor,
  calculateRequestCost,
  CostBreakdown,
  findAnthropicPricing,
  normalizeClaudeModelId,
  findBedrockPricing,
  findNovaPricing,
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

  it("returns null for models those providers have no price for", () => {
    expect(
      calculateRequestCost(
        "bedrock",
        // Llama 3.3 has no row (Llama 4 does, in BEDROCK_PRICING)
        "meta.llama3-3-70b-instruct-v1:0",
        {
          promptTokens: 1000,
          completionTokens: 1000,
        },
      ),
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

describe("Claude 5 and 5.5 prices", () => {
  const usage = (n: number, extra: Partial<Usage> = {}): Usage => ({
    promptTokens: n,
    completionTokens: 0,
    ...extra,
  });

  it.each([
    // [model, input $/MTok, output $/MTok]
    ["claude-opus-5-5", 4, 20],
    ["claude-opus-5", 5, 25],
    ["claude-sonnet-5-5", 2, 10],
    ["claude-sonnet-5", 2, 10],
    ["claude-haiku-5-5", 0.1, 0.5],
  ])("prices %s", (id, input, output) => {
    // 90,000 tokens each way: under Haiku 5.5's 100,000-token long-prompt limit
    const r = calculateRequestCost("anthropic", id, {
      promptTokens: 90_000,
      completionTokens: 90_000,
    });
    expect(r!.cost).toBeCloseTo(((input + output) * 90_000) / 1_000_000, 6);
  });

  it("reads Opus 5.5 and Sonnet 5.5 cache hits at 0.05x, others at 0.1x", () => {
    const read = (id: string) =>
      calculateRequestCost(
        "anthropic",
        id,
        usage(0, { promptTokensDetails: { cachedTokens: 1_000_000 } }),
      )!.cost;
    expect(read("claude-opus-5-5")).toBeCloseTo(0.2, 6);
    expect(read("claude-sonnet-5-5")).toBeCloseTo(0.1, 6);
    expect(read("claude-opus-5")).toBeCloseTo(0.5, 6);
    expect(read("claude-sonnet-5")).toBeCloseTo(0.2, 6);
  });

  it("does not price a later minor version at an earlier one's price", () => {
    expect(findAnthropicPricing("claude-sonnet-5-6")).toBeNull();
    expect(findAnthropicPricing("claude-opus-5-6")).toBeNull();
    expect(findAnthropicPricing("claude-sonnet-5-5")).not.toBeNull();
    // A dated release of the same version still matches
    expect(findAnthropicPricing("claude-sonnet-5-20261001")).not.toBeNull();
  });

  describe("Haiku 5.5 long-context tier", () => {
    it("charges the higher prices for a prompt over 100,000 tokens", () => {
      const low = findAnthropicPricing("claude-haiku-5-5", 100_000)!;
      const high = findAnthropicPricing("claude-haiku-5-5", 100_001)!;
      expect(low.input).toBe(0.1);
      expect(high.input).toBe(0.5);
      expect(high.cacheRead).toBeCloseTo(0.05, 6);
      expect(high.cacheWrite1h).toBeCloseTo(1, 6);
      expect(high.output).toBe(2.5);
    });

    it("counts cache reads and writes toward the prompt length", () => {
      const r = calculateRequestCost(
        "anthropic",
        "claude-haiku-5-5",
        usage(10, {
          promptTokensDetails: { cachedTokens: 150_000, cacheWriteTokens: 0 },
        }),
      )!;
      // 150,010 tokens is a long prompt: read at $0.05/MTok, input at $0.50/MTok
      expect(r.cost).toBeCloseTo((150_000 / 1e6) * 0.05 + (10 / 1e6) * 0.5, 9);
    });

    it("keeps the lower prices when the prompt is short", () => {
      const r = calculateRequestCost(
        "anthropic",
        "claude-haiku-5-5",
        usage(10, { promptTokensDetails: { cachedTokens: 50_000 } }),
      )!;
      expect(r.cost).toBeCloseTo((50_000 / 1e6) * 0.01 + (10 / 1e6) * 0.1, 9);
    });
  });
});

describe("Bedrock regional endpoint price factor", () => {
  const MTOK = 1_000_000;

  it.each([
    // Geographic profiles carry the premium on Sonnet/Haiku/Opus 4.5 and later
    ["us.anthropic.claude-opus-5-5", 1.1],
    ["US.anthropic.claude-opus-5-5", 1.1],
    ["eu.anthropic.claude-opus-5-5", 1.1],
    ["apac.anthropic.claude-sonnet-5-5", 1.1],
    ["jp.anthropic.claude-haiku-5-5", 1.1],
    ["au.anthropic.claude-sonnet-4-6", 1.1],
    ["ca.anthropic.claude-opus-4-8", 1.1],
    ["us.anthropic.claude-haiku-4-5-20251001-v1:0", 1.1],
    ["us.anthropic.claude-sonnet-4-5-20250929-v1:0", 1.1],
    ["us.anthropic.claude-opus-4-5-20251101-v1:0", 1.1],
    ["us.anthropic.claude-fable-5", 1.1],
    // Global endpoints and bare IDs are list price
    ["global.anthropic.claude-opus-5-5", 1],
    ["anthropic.claude-opus-5-5", 1],
    ["claude-opus-5-5", 1],
    // GovCloud is priced separately
    ["us-gov.anthropic.claude-sonnet-4-6", 1],
    // Earlier models keep their existing pricing
    ["us.anthropic.claude-opus-4-1-20250805-v1:0", 1],
    ["us.anthropic.claude-sonnet-4-20250514-v1:0", 1],
    ["us.anthropic.claude-3-7-sonnet-20250219-v1:0", 1],
    ["us.anthropic.claude-3-5-haiku-20241022-v1:0", 1],
    // Not Claude
    ["us.openai.gpt-6.1-sol", 1],
  ])("%s has factor %s", (id, factor) => {
    expect(bedrockRegionalPriceFactor(id)).toBe(factor);
  });

  it.each([
    ["input", { promptTokens: MTOK, completionTokens: 0 }, 4],
    ["output", { promptTokens: 0, completionTokens: MTOK }, 20],
    [
      "cache read",
      {
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: { cachedTokens: MTOK },
      },
      0.2,
    ],
    [
      "5-minute write",
      {
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: { cacheWriteTokens: MTOK },
      },
      5,
    ],
    [
      "1-hour write",
      {
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: {
          cacheWriteTokens: MTOK,
          cacheWriteTokens5m: 0,
          cacheWriteTokens1h: MTOK,
        },
      },
      8,
    ],
  ] as [string, Usage, number][])(
    "scales %s by 1.10 on a us. profile",
    (_name, usage, listCost) => {
      const list = calculateRequestCost("bedrock", "claude-opus-5-5", usage)!;
      const us = calculateRequestCost(
        "bedrock",
        "us.anthropic.claude-opus-5-5",
        usage,
      )!;
      expect(list.cost).toBeCloseTo(listCost, 6);
      expect(us.cost).toBeCloseTo(listCost * 1.1, 6);
    },
  );

  it("leaves global. and bare IDs at list price", () => {
    const usage: Usage = { promptTokens: MTOK, completionTokens: 0 };
    for (const id of [
      "global.anthropic.claude-opus-5-5",
      "anthropic.claude-opus-5-5",
    ]) {
      expect(calculateRequestCost("bedrock", id, usage)!.cost).toBeCloseTo(
        4,
        6,
      );
    }
  });

  it("scales the Haiku 5.5 long-context tier too", () => {
    const low = findAnthropicPricing("us.anthropic.claude-haiku-5-5", 100_000)!;
    const high = findAnthropicPricing(
      "us.anthropic.claude-haiku-5-5",
      100_001,
    )!;
    expect(low.input).toBe(0.11);
    expect(high.input).toBe(0.55);
    expect(high.output).toBe(2.75);
    expect(high.cacheRead).toBeCloseTo(0.055, 6);
    expect(high.cacheWrite1h).toBeCloseTo(1.1, 6);
  });

  it("does not change the shared price table", () => {
    findAnthropicPricing("us.anthropic.claude-opus-5-5");
    expect(findAnthropicPricing("claude-opus-5-5")!.input).toBe(4);
  });

  it("says in the breakdown that the factor was applied", () => {
    const usage: Usage = { promptTokens: 1000, completionTokens: 1000 };
    const us = calculateRequestCost(
      "bedrock",
      "us.anthropic.claude-opus-5-5",
      usage,
    )!;
    const list = calculateRequestCost("bedrock", "claude-opus-5-5", usage)!;
    expect(us.breakdown).toContain("× 1.1");
    expect(list.breakdown).not.toContain("Anthropic list ×");
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

describe("Fable and Mythos prices", () => {
  const cost = (id: string, usage: Partial<Usage>) =>
    calculateRequestCost("anthropic", id, {
      promptTokens: 0,
      completionTokens: 0,
      ...usage,
    })!.cost;

  it.each([
    "claude-fable-5",
    "claude-fable-5-1",
    "claude-mythos-5",
    "claude-mythos-5-1",
    "us.anthropic.claude-fable-5-1",
    "global.anthropic.claude-mythos-5",
  ])("%s is priced", (id) => {
    expect(findAnthropicPricing(id)).not.toBeNull();
  });

  it("charges 10 in and 50 out per million tokens", () => {
    expect(
      cost("claude-fable-5-1", {
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
      }),
    ).toBeCloseTo(60, 6);
  });

  it("reads at 0.025x on the 5.1 releases and 0.1x on 5", () => {
    const read = (id: string) =>
      cost(id, { promptTokensDetails: { cachedTokens: 1_000_000 } });
    expect(read("claude-fable-5-1")).toBeCloseTo(0.25, 6);
    expect(read("claude-mythos-5-1")).toBeCloseTo(0.25, 6);
    expect(read("claude-fable-5")).toBeCloseTo(1, 6);
    expect(read("claude-mythos-5")).toBeCloseTo(1, 6);
  });

  it("writes at 1.25x for 5 minutes and 2x for 1 hour", () => {
    const write = (id: string, d: object) =>
      cost(id, { promptTokensDetails: { cacheWriteTokens: 1_000_000, ...d } });
    expect(write("claude-fable-5-1", {})).toBeCloseTo(12.5, 6);
    expect(
      write("claude-fable-5-1", {
        cacheWriteTokens5m: 0,
        cacheWriteTokens1h: 1_000_000,
      }),
    ).toBeCloseTo(20, 6);
  });

  it("does not price a later minor version at an earlier one's price", () => {
    expect(findAnthropicPricing("claude-fable-5-2")).toBeNull();
    expect(findAnthropicPricing("claude-mythos-5-2")).toBeNull();
  });

  it("adds the regional premium on a geographic profile, not on global", () => {
    const per = (id: string) =>
      calculateRequestCost("bedrock", id, {
        promptTokens: 1_000_000,
        completionTokens: 0,
      })!.cost;
    expect(per("global.anthropic.claude-fable-5-1")).toBeCloseTo(10, 6);
    expect(per("us.anthropic.claude-fable-5-1")).toBeCloseTo(11, 6);
  });
});

describe("Amazon Nova on Bedrock", () => {
  // AWS Price List, us-east-1 on-demand, read 2026-11-08: see NOVA_PRICING
  it.each([
    ["amazon.nova-2-lite-v1:0", 0.33, 2.75],
    ["us.amazon.nova-2-lite-v1:0", 0.33, 2.75],
    ["amazon.nova-pro-v1:0", 0.8, 3.2],
    ["eu.amazon.nova-lite-v1:0", 0.06, 0.24],
    ["apac.amazon.nova-micro-v1:0", 0.035, 0.14],
  ])("%s is $%s in, $%s out per MTok", (id, input, output) => {
    const pricing = findNovaPricing(id)!;
    expect(pricing).not.toBeNull();
    expect(pricing.input).toBe(input);
    expect(pricing.output).toBe(output);
    expect(pricing.cacheRead).toBeCloseTo(input * 0.25, 9);
    expect(pricing.cacheWrite).toBe(0);
  });

  it("prices reads at a quarter of the input rate and writes at nothing", () => {
    const result = calculateRequestCost("bedrock", "us.amazon.nova-pro-v1:0", {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      promptTokensDetails: {
        cachedTokens: 1_000_000,
        cacheWriteTokens: 1_000_000,
      },
    })!;
    expect(result).not.toBeNull();
    // 0.80 input + 3.20 output + 0.20 read + 0 write
    expect(result.cost).toBeCloseTo(4.2, 6);
    expect(result.breakdown).toContain("Cache Read");
    expect(result.breakdown).toContain(
      "Cache Write (5m): 1,000,000 tokens × $0/MTok",
    );
  });

  it("prices a request whose whole prompt was a cache write", () => {
    // Bedrock reports inputTokens 0 when everything went to the cache
    const result = calculateRequestCost(
      "bedrock",
      "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      {
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: { cachedTokens: 0, cacheWriteTokens: 1_000_000 },
      },
    )!;
    // $1 x 1.25 (5m write) x 1.10 (us. profile)
    expect(result.cost).toBeCloseTo(1.375, 6);
  });

  it("leaves Nova unpriced on providers other than Bedrock", () => {
    expect(
      calculateRequestCost("openrouter", "amazon/nova-pro-v1", {
        promptTokens: 10,
        completionTokens: 10,
      }),
    ).toBeNull();
  });
});

describe("other model families on Bedrock (AWS Price List, us-east-1, 2026-11-08)", () => {
  const usage = { promptTokens: 1_000_000, completionTokens: 1_000_000 };

  it.each([
    ["deepseek.v3.2", 0.62, 1.85],
    ["us.deepseek.v3.2", 0.62, 1.85],
    ["openai.gpt-oss-120b-1:0", 0.15, 0.6],
    ["us-gov.openai.gpt-oss-120b-1:0", 0.15, 0.6],
    ["openai.gpt-oss-20b-1:0", 0.07, 0.3],
    ["mistral.mistral-large-3-675b-instruct", 0.5, 1.5],
    ["us.meta.llama4-maverick-17b-instruct-v1:0", 0.24, 0.97],
    ["us.meta.llama4-scout-17b-instruct-v1:0", 0.17, 0.66],
    ["moonshotai.kimi-k2.5", 0.6, 3.0],
    ["qwen.qwen3-coder-next", 0.5, 1.2],
    ["qwen.qwen3-32b-v1:0", 0.15, 0.6],
    ["qwen.qwen3-coder-30b-a3b-v1:0", 0.15, 0.6],
    ["qwen.qwen3-vl-235b-a22b", 0.53, 2.66],
    ["zai.glm-5", 1.0, 3.2],
    ["minimax.minimax-m2.5", 0.3, 1.2],
    ["nvidia.nemotron-super-3-120b", 0.15, 0.65],
  ])("%s is $%s in / $%s out per MTok", (id, input, output) => {
    const pricing = findBedrockPricing(id)!;
    expect(pricing).toMatchObject({ input, output });
    expect(calculateRequestCost("bedrock", id, usage)!.cost).toBeCloseTo(
      input + output,
      6,
    );
  });

  it("matches the whole ID, so deepseek.v3.2 is not deepseek.v3.1 and the row ends at the tail", () => {
    expect(findBedrockPricing("deepseek.v3.1")).toBeNull();
    expect(findBedrockPricing("deepseek.v3.25")).toBeNull();
    expect(findBedrockPricing("qwen.qwen3-32b-v1:0")).not.toBeNull();
  });

  it("has no price for Nova Premier (retired) or Qwen3 Next 80B A3B (no standard row)", () => {
    expect(findBedrockPricing("us.amazon.nova-premier-v1:0")).toBeNull();
    expect(findBedrockPricing("qwen.qwen3-next-80b-a3b")).toBeNull();
    expect(
      calculateRequestCost("bedrock", "qwen.qwen3-next-80b-a3b", usage),
    ).toBeNull();
  });

  it("charges nothing for cache reads or writes: Bedrock does not cache these families", () => {
    const result = calculateRequestCost("bedrock", "qwen.qwen3-coder-next", {
      promptTokens: 1_000_000,
      completionTokens: 0,
      promptTokensDetails: {
        cachedTokens: 1_000_000,
        cacheWriteTokens: 1_000_000,
      },
    })!;
    expect(result.cost).toBeCloseTo(0.5, 6);
  });

  it("prices bedrock-mantle through the same table (the Mantle usage types carry the same rates)", () => {
    expect(
      calculateRequestCost("bedrock-mantle", "openai.gpt-oss-120b", usage)!
        .cost,
    ).toBeCloseTo(0.75, 6);
    expect(
      calculateRequestCost("bedrock-mantle", "qwen.qwen3-32b", usage)!.cost,
    ).toBeCloseTo(0.75, 6);
    // Claude on Mantle: Anthropic's list prices, as on Bedrock
    expect(
      calculateRequestCost(
        "bedrock-mantle",
        "anthropic.claude-haiku-4-5",
        usage,
      ),
    ).toEqual(
      calculateRequestCost("bedrock", "anthropic.claude-haiku-4-5", usage),
    );
  });

  it("still prices Nova by its own table and Claude by Anthropic's", () => {
    expect(findBedrockPricing("us.amazon.nova-pro-v1:0")).toBeNull();
    expect(
      calculateRequestCost("bedrock", "us.amazon.nova-pro-v1:0", usage)!.cost,
    ).toBeCloseTo(4.0, 6);
  });
});
