import { Usage } from "../..";
import { calculateRequestCost } from "./calculateRequestCost";

describe("calculateRequestCost", () => {
  const usage = (
    promptTokens: number,
    completionTokens: number,
    promptTokensDetails?: Usage["promptTokensDetails"],
  ): Usage => ({
    promptTokens,
    completionTokens,
    promptTokensDetails,
  });

  it("returns null for an unknown provider", () => {
    expect(
      calculateRequestCost(
        "unknown-provider",
        "claude-sonnet-4-6",
        usage(1000, 500),
      ),
    ).toBeNull();
  });

  it("returns null for an unknown model", () => {
    expect(
      calculateRequestCost("anthropic", "not-a-real-model", usage(1000, 500)),
    ).toBeNull();
  });

  it("returns null for a model that only matches a known provider of another family", () => {
    expect(
      calculateRequestCost("openai", "claude-sonnet-4-6", usage(1000, 500)),
    ).toBeNull();
  });

  it("calculates input and output costs for a known Anthropic model", () => {
    const result = calculateRequestCost(
      "anthropic",
      "claude-sonnet-4-6",
      usage(1_000_000, 1_000_000),
    );
    expect(result).not.toBeNull();
    // $3/MTok input + $15/MTok output
    expect(result!.cost).toBeCloseTo(3 + 15, 6);
  });

  it("calculates input and output costs for a known OpenAI model", () => {
    const result = calculateRequestCost(
      "openai",
      "gpt-4o-mini",
      usage(1_000_000, 1_000_000),
    );
    expect(result).not.toBeNull();
    // $0.15/MTok input + $0.6/MTok output
    expect(result!.cost).toBeCloseTo(0.15 + 0.6, 6);
  });

  it("uses models.dev pricing for gpt-3.5-turbo", () => {
    const result = calculateRequestCost(
      "openai",
      "gpt-3.5-turbo",
      usage(1_000_000, 1_000_000),
    );
    expect(result).not.toBeNull();
    // $0.5/MTok input + $1.5/MTok output (per models.dev, same source as OpenCode)
    expect(result!.cost).toBeCloseTo(0.5 + 1.5, 6);
  });

  it("calculates input and output costs for a known DeepSeek model", () => {
    const result = calculateRequestCost(
      "deepseek",
      "deepseek-chat",
      usage(1_000_000, 1_000_000),
    );
    expect(result).not.toBeNull();
    expect(result!.cost).toBeCloseTo(0.14 + 0.28, 6);
  });

  it("calculates input and output costs for a known Gemini model", () => {
    const result = calculateRequestCost(
      "gemini",
      "gemini-2.5-pro",
      usage(1_000_000, 1_000_000),
    );
    expect(result).not.toBeNull();
    expect(result!.cost).toBeCloseTo(1.25 + 10, 6);
  });

  it("calculates input and output costs for a known Mistral model", () => {
    const result = calculateRequestCost(
      "mistral",
      "mistral-large-latest",
      usage(1_000_000, 1_000_000),
    );
    expect(result).not.toBeNull();
    expect(result!.cost).toBeCloseTo(0.5 + 1.5, 6);
  });

  it("matches model-family prefixes case-insensitively", () => {
    const result = calculateRequestCost(
      "anthropic",
      "CLAUDE-SONNET-4-6",
      usage(1_000_000, 0),
    );
    expect(result).not.toBeNull();
    expect(result!.cost).toBeCloseTo(3, 6);
  });

  it("matches model variants by prefix", () => {
    const result = calculateRequestCost(
      "anthropic",
      "claude-sonnet-4-6-20260217",
      usage(1_000_000, 0),
    );
    expect(result).not.toBeNull();
    expect(result!.cost).toBeCloseTo(3, 6);
  });

  it("returns a cost of zero when there are no tokens", () => {
    const result = calculateRequestCost(
      "anthropic",
      "claude-sonnet-4-6",
      usage(0, 0),
    );
    expect(result).not.toBeNull();
    expect(result!.cost).toBe(0);
  });

  it("computes fractional costs from partial token counts", () => {
    const result = calculateRequestCost(
      "anthropic",
      "claude-sonnet-4-6",
      usage(12_000, 4_000),
    );
    expect(result).not.toBeNull();
    // 12_000 / 1M * $3 = $0.036 ; 4_000 / 1M * $15 = $0.06
    expect(result!.cost).toBeCloseTo(0.036 + 0.06, 6);
  });

  it("includes cache write and cache read costs when reported", () => {
    const result = calculateRequestCost(
      "anthropic",
      "claude-sonnet-4-6",
      usage(10_000, 2_000, {
        cachedTokens: 8_000,
        cacheWriteTokens: 5_000,
      }),
    );
    expect(result).not.toBeNull();
    // Input: 10_000/1M * 3 = 0.03 ; Output: 2_000/1M * 15 = 0.03
    // Cache write: 5_000/1M * 3.75 = 0.01875 ; Cache read: 8_000/1M * 0.3 = 0.0024
    expect(result!.cost).toBeCloseTo(0.03 + 0.03 + 0.01875 + 0.0024, 6);
  });

  it("includes cache read cost for providers that only charge for reads", () => {
    const result = calculateRequestCost(
      "openai",
      "gpt-4o",
      usage(10_000, 2_000, { cachedTokens: 8_000 }),
    );
    expect(result).not.toBeNull();
    // Input: 10_000/1M * 2.5 = 0.025 ; Output: 2_000/1M * 10 = 0.02
    // Cache read: 8_000/1M * 1.25 = 0.01
    expect(result!.cost).toBeCloseTo(0.025 + 0.02 + 0.01, 6);
  });

  it("ignores cache write tokens for providers that do not price cache writes", () => {
    const result = calculateRequestCost(
      "openai",
      "gpt-4o",
      usage(10_000, 0, { cachedTokens: 0, cacheWriteTokens: 5_000 }),
    );
    expect(result).not.toBeNull();
    // Only input cost; cache write tokens must not be charged
    expect(result!.cost).toBeCloseTo(0.025, 6);
  });

  it("builds a human-readable breakdown", () => {
    const result = calculateRequestCost(
      "anthropic",
      "claude-sonnet-4-6",
      usage(12_000, 4_000),
    );
    expect(result!.breakdown).toContain("Model: claude-sonnet-4-6");
    expect(result!.breakdown).toContain("Input: 12,000 tokens");
    expect(result!.breakdown).toContain("Output: 4,000 tokens");
    expect(result!.breakdown).toContain("Total: $0.096000");
  });
});
