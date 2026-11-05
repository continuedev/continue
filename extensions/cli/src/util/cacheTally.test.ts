import { afterEach, describe, expect, it } from "vitest";

import {
  formatCacheTally,
  getCacheTally,
  recordCacheTally,
  resetCacheTally,
} from "./cacheTally.js";

afterEach(() => resetCacheTally());

const claude = (prompt: number, read: number, write: number) => ({
  promptTokens: prompt,
  completionTokens: 10,
  promptTokensDetails: { cachedTokens: read, cacheWriteTokens: write },
});

describe("cache tally", () => {
  it("adds a Claude request's cache counts to its prompt tokens", () => {
    // promptTokens leaves out the cache for Claude: 5 + 900 + 100 = 1,005
    recordCacheTally("anthropic", "claude-sonnet-4-6", claude(5, 900, 100));
    expect(getCacheTally()).toMatchObject({
      requests: 1,
      inputTokens: 1005,
      readTokens: 900,
      writeTokens: 100,
    });
  });

  it("takes a GPT request's prompt tokens as the whole input", () => {
    recordCacheTally("openai", "gpt-5.5", claude(1000, 800, 0));
    expect(getCacheTally().inputTokens).toBe(1000);
    expect(getCacheTally().readTokens).toBe(800);
  });

  it("keeps a mixed session right, request by request", () => {
    recordCacheTally("anthropic", "claude-sonnet-4-6", claude(5, 900, 100));
    recordCacheTally("openai", "gpt-5.5", claude(1000, 800, 0));
    expect(getCacheTally()).toMatchObject({
      requests: 2,
      inputTokens: 2005,
      readTokens: 1700,
      writeTokens: 100,
    });
  });

  it("works for Bedrock Claude IDs", () => {
    recordCacheTally(
      "anthropic",
      "us.anthropic.claude-sonnet-4-6",
      claude(5, 900, 100),
    );
    expect(getCacheTally().inputTokens).toBe(1005);
  });

  it("ignores a request with no input and a missing details block", () => {
    recordCacheTally("anthropic", "claude-sonnet-4-6", {
      promptTokens: 0,
      completionTokens: 0,
    });
    expect(getCacheTally().requests).toBe(0);
    recordCacheTally("anthropic", "claude-sonnet-4-6", {
      promptTokens: 500,
      completionTokens: 5,
    });
    // 500 tokens is under Sonnet 4.6's 1,024-token minimum, which is counted
    expect(getCacheTally()).toMatchObject({
      requests: 1,
      inputTokens: 500,
      readTokens: 0,
      writeTokens: 0,
      belowMinimum: 1,
    });
  });
});

describe("formatCacheTally", () => {
  it("says nothing when the cache was never used", () => {
    expect(formatCacheTally()).toBeUndefined();
    // long enough to be cached, and it was not: nothing to say
    recordCacheTally("anthropic", "claude-sonnet-4-6", claude(5000, 0, 0));
    expect(formatCacheTally()).toBeUndefined();
  });

  it("gives requests, hit share, and tokens read and written", () => {
    recordCacheTally("anthropic", "claude-sonnet-4-6", claude(5, 0, 1000));
    recordCacheTally("anthropic", "claude-sonnet-4-6", claude(5, 1000, 200));
    expect(formatCacheTally()).toBe(
      "Prompt cache: 2 requests, 45% of input read from the cache " +
        "(1,000 of 2,210 tokens), 1,200 tokens written",
    );
  });

  it("uses the singular for one request", () => {
    recordCacheTally("anthropic", "claude-sonnet-4-6", claude(5, 0, 1000));
    expect(formatCacheTally()).toContain("1 request,");
    expect(formatCacheTally()).toContain("0% of input");
  });

  it("does not claim anything about misses", () => {
    recordCacheTally("anthropic", "claude-sonnet-4-6", claude(5, 100, 100));
    expect(formatCacheTally()?.toLowerCase()).not.toContain("miss");
  });
});

describe("requests under the model's cache minimum", () => {
  // Bedrock lists 4,096 tokens for Haiku 4.5 and 1,024 for Sonnet 4.6.
  const haiku = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
  const sonnet = "us.anthropic.claude-sonnet-4-6";

  it("counts a short request that neither read nor wrote the cache", () => {
    recordCacheTally("anthropic", haiku, claude(2000, 0, 0), "bedrock");
    expect(getCacheTally()).toMatchObject({ belowMinimum: 1, minimum: 4096 });
  });

  it("does not count a short request that wrote the cache anyway", () => {
    recordCacheTally("anthropic", haiku, claude(5, 0, 2000), "bedrock");
    expect(getCacheTally().belowMinimum).toBe(0);
  });

  it("does not count a request at or over the minimum", () => {
    recordCacheTally("anthropic", sonnet, claude(1024, 0, 0), "bedrock");
    recordCacheTally("anthropic", sonnet, claude(5000, 0, 0), "bedrock");
    expect(getCacheTally().belowMinimum).toBe(0);
  });

  it("uses the provider's own figure where the vendors differ (Opus 4.7)", () => {
    const opus = "claude-opus-4-7";
    recordCacheTally("anthropic", opus, claude(3000, 0, 0), "bedrock");
    expect(getCacheTally().belowMinimum).toBe(1); // Bedrock: 4,096
    resetCacheTally();
    recordCacheTally("anthropic", opus, claude(3000, 0, 0), "anthropic");
    expect(getCacheTally().belowMinimum).toBe(0); // Anthropic: 2,048
  });

  it("claims nothing for a model that is not in the vendors' tables", () => {
    recordCacheTally("openai", "gpt-5.5", claude(50, 0, 0));
    expect(getCacheTally().belowMinimum).toBe(0);
  });

  it("says why, when every request was too short to be cached", () => {
    recordCacheTally("anthropic", haiku, claude(2000, 0, 0), "bedrock");
    recordCacheTally("anthropic", haiku, claude(3000, 0, 0), "bedrock");
    expect(formatCacheTally()).toBe(
      "Prompt cache: 2 requests, all under the model's 4,096-token minimum, so none could be cached",
    );
  });

  it("says so for one request among several that were not cached", () => {
    recordCacheTally("anthropic", haiku, claude(2000, 0, 0), "bedrock");
    recordCacheTally("anthropic", haiku, claude(9000, 0, 0), "bedrock");
    expect(formatCacheTally()).toBe(
      "Prompt cache: 2 requests, 1 of them was under the model's 4,096-token minimum, so could not be cached",
    );
  });

  it("adds it to the usual line when the cache was used as well", () => {
    recordCacheTally("anthropic", haiku, claude(2000, 0, 0), "bedrock");
    recordCacheTally("anthropic", haiku, claude(5, 6000, 100), "bedrock");
    const line = formatCacheTally()!;
    expect(line).toContain("of input read from the cache");
    expect(line).toContain(
      "; 1 of them was under the model's 4,096-token minimum, so could not be cached",
    );
  });

  it("stays silent when nothing used the cache and nothing was too short", () => {
    recordCacheTally("anthropic", sonnet, claude(5000, 0, 0), "bedrock");
    expect(formatCacheTally()).toBeUndefined();
  });
});
