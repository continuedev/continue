import { describe, expect, it } from "vitest";

import type { Usage } from "../..";

import { promptTokensExcludeCache, totalInputTokens } from "./cacheStats";

describe("promptTokensExcludeCache", () => {
  it.each([
    ["anthropic", "claude-sonnet-4-6", true],
    ["bedrock", "us.anthropic.claude-sonnet-4-5-20250929-v1:0", true],
    ["vertexai", "claude-sonnet-4-5@20250929", true],
    ["vertexai", "gemini-2.5-pro", false],
    ["bedrock", "amazon.nova-pro-v1:0", false],
    ["openai", "gpt-4o", false],
    ["openrouter", "anthropic/claude-sonnet-4.5", false],
  ])("%s %s -> %s", (provider, model, expected) => {
    expect(promptTokensExcludeCache(provider, model)).toBe(expected);
  });
});

describe("totalInputTokens", () => {
  const usage: Usage = {
    promptTokens: 100,
    completionTokens: 10,
    promptTokensDetails: { cachedTokens: 8000, cacheWriteTokens: 300 },
  };

  it("adds cache reads and writes for Claude providers", () => {
    expect(totalInputTokens("anthropic", "claude-sonnet-4-6", usage)).toBe(
      8400,
    );
  });

  it("does not add them for providers whose prompt tokens include the cache", () => {
    expect(totalInputTokens("openai", "gpt-4o", usage)).toBe(100);
  });

  it("works without cache details", () => {
    expect(
      totalInputTokens("anthropic", "claude-sonnet-4-6", {
        promptTokens: 50,
        completionTokens: 1,
      }),
    ).toBe(50);
  });
});
