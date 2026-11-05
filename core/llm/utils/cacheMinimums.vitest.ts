import { describe, expect, it } from "vitest";

import { minCacheableTokens } from "./cacheMinimums";

describe("minCacheableTokens", () => {
  // Every Claude row of the AWS Bedrock table (2026-11-04), as Bedrock IDs.
  it.each([
    ["anthropic.claude-haiku-5-5", 512],
    ["anthropic.claude-sonnet-5-5", 512],
    ["anthropic.claude-opus-5-5", 512],
    ["anthropic.claude-fable-5-1", 512],
    ["anthropic.claude-mythos-5-1", 512],
    ["anthropic.claude-fable-5", 512],
    ["anthropic.claude-mythos-5", 512],
    ["anthropic.claude-opus-5", 512],
    ["anthropic.claude-opus-4-8", 1024],
    ["anthropic.claude-opus-4-7", 4096],
    ["anthropic.claude-opus-4-6-v1", 4096],
    ["anthropic.claude-opus-4-5-20251101-v1:0", 4096],
    ["anthropic.claude-sonnet-5", 1024],
    ["anthropic.claude-sonnet-4-6", 1024],
    ["anthropic.claude-haiku-4-5-20251001-v1:0", 4096],
  ])("Bedrock %s -> %s", (id, expected) => {
    expect(minCacheableTokens(id, "bedrock")).toBe(expected);
    // geographic and global profile prefixes make no difference
    expect(minCacheableTokens(`us.${id}`, "bedrock")).toBe(expected);
    expect(minCacheableTokens(`global.${id}`, "bedrock")).toBe(expected);
  });

  it("uses Anthropic's own number for Opus 4.7 on the anthropic provider", () => {
    expect(minCacheableTokens("claude-opus-4-7", "anthropic")).toBe(2048);
    expect(minCacheableTokens("claude-opus-4-7", "bedrock")).toBe(4096);
  });

  it.each([
    ["claude-sonnet-4-5-20250929", 1024],
    ["claude-opus-4-1-20250805", 1024],
    ["claude-sonnet-4-20250514", 1024],
    ["claude-opus-4-20250514", 1024],
  ])("older models in Anthropic's table: %s -> %s", (id, expected) => {
    expect(minCacheableTokens(id, "anthropic")).toBe(expected);
  });

  it("claims nothing for models the tables do not list", () => {
    expect(minCacheableTokens("claude-sonnet-5-6", "bedrock")).toBeUndefined();
    expect(minCacheableTokens("claude-opus-4-9", "bedrock")).toBeUndefined();
    expect(
      minCacheableTokens("claude-3-7-sonnet-20250219", "anthropic"),
    ).toBeUndefined();
    expect(minCacheableTokens("gpt-4o", "openai")).toBeUndefined();
    expect(
      minCacheableTokens("amazon.nova-pro-v1:0", "bedrock"),
    ).toBeUndefined();
  });

  it("does not price Sonnet 5 as Sonnet 5.5, or the reverse", () => {
    expect(minCacheableTokens("claude-sonnet-5", "bedrock")).toBe(1024);
    expect(minCacheableTokens("claude-sonnet-5-5", "bedrock")).toBe(512);
    expect(minCacheableTokens("claude-sonnet-5-20261001", "bedrock")).toBe(
      1024,
    );
  });
});
