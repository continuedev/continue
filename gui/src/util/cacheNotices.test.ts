import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import {
  contextMeterTokens,
  formatIdle,
  formatTokens,
  formatUsd,
  longContextNote,
  perMessageCost,
} from "./cacheNotices";
import { CONTEXT_METER_TOKENS } from "./cacheSafeguards";

function model(provider: string, id: string): ModelDescription {
  return { title: id, provider, model: id, underlyingProviderName: provider };
}
const sonnet = model("anthropic", "claude-sonnet-4-6");
const haiku55 = model("bedrock", "us.anthropic.claude-haiku-5-5");

describe("formatIdle", () => {
  it.each([
    [20 * 1000, "1 min"],
    [12 * 60 * 1000, "12 min"],
    [90 * 60 * 1000, "2 h"],
    [5 * 3600 * 1000, "5 h"],
    [3 * 24 * 3600 * 1000, "3 days"],
  ])("%i ms -> %s", (ms, expected) => {
    expect(formatIdle(ms)).toBe(expected);
  });
});

describe("formatUsd and formatTokens", () => {
  it("rounds to cents and names tiny amounts", () => {
    expect(formatUsd(1.004)).toBe("$1.00");
    expect(formatUsd(0.004)).toBe("under $0.01");
    expect(formatTokens(366_400)).toBe("366k");
    expect(formatTokens(800)).toBe("800");
  });
});

describe("contextMeterTokens", () => {
  it("is a fixed size for most models", () => {
    expect(contextMeterTokens(sonnet)).toBe(CONTEXT_METER_TOKENS);
    expect(contextMeterTokens(undefined)).toBe(CONTEXT_METER_TOKENS);
  });

  it("is 80% of the limit for a model with a long-context price tier", () => {
    expect(contextMeterTokens(haiku55)).toBe(80_000);
  });
});

describe("perMessageCost", () => {
  it("prices one more message with the cache warm and expired", () => {
    const c = perMessageCost(sonnet, 200_000)!;
    // 200,000 tokens * $0.30/MTok read, * $3.75/MTok write
    expect(c.warmUsd).toBeCloseTo(0.06, 6);
    expect(c.coldUsd).toBeCloseTo(0.75, 6);
  });

  it("uses the 1-hour write price when asked", () => {
    expect(perMessageCost(sonnet, 200_000, "1h")!.coldUsd).toBeCloseTo(1.2, 6);
  });

  it("is undefined for an unpriced model", () => {
    expect(perMessageCost(model("openai", "gpt-4o"), 200_000)).toBeUndefined();
  });

  it("uses the higher tier for a long prompt on Haiku 5.5", () => {
    // Bare ID, so list price. Over 100,000 tokens: $0.05/MTok read, $0.625/MTok write
    const c = perMessageCost(
      model("bedrock", "anthropic.claude-haiku-5-5"),
      200_000,
    )!;
    expect(c.warmUsd).toBeCloseTo(0.01, 6);
    expect(c.coldUsd).toBeCloseTo(0.125, 6);
  });

  it("adds the Bedrock us. profile premium (1.10x) to the same prompt", () => {
    const c = perMessageCost(haiku55, 200_000)!;
    expect(c.warmUsd).toBeCloseTo(0.011, 6);
    expect(c.coldUsd).toBeCloseTo(0.1375, 6);
  });
});

describe("longContextNote", () => {
  it("is undefined for models without a tier", () => {
    expect(longContextNote(sonnet, 500_000)).toBeUndefined();
  });

  it("warns when near the limit", () => {
    expect(longContextNote(haiku55, 85_000)).toContain("5x per token");
    expect(longContextNote(haiku55, 85_000)).toContain("100k");
  });

  it("says the limit has been passed", () => {
    expect(longContextNote(haiku55, 150_000)).toContain("this one is 150k");
  });

  it("is undefined well below the limit", () => {
    expect(longContextNote(haiku55, 50_000)).toBeUndefined();
  });
});
