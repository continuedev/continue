import { describe, expect, it } from "vitest";

import { minCacheableTokens } from "./cacheMinimums";

describe("Gemini implicit caching minimums", () => {
  it("lists 2,048 for 2.5 Flash and Pro", () => {
    expect(minCacheableTokens("gemini-2.5-flash", "gemini")).toBe(2048);
    expect(minCacheableTokens("gemini-2.5-pro", "gemini")).toBe(2048);
    expect(minCacheableTokens("models/gemini-2.5-pro", "gemini")).toBe(2048);
    expect(
      minCacheableTokens("gemini-2.5-flash-preview-09-2025", "gemini"),
    ).toBe(2048);
  });

  it("lists 4,096 for the 3.x and 4 models in the table", () => {
    for (const id of [
      "gemini-3.1-pro-preview",
      "gemini-3.6-flash",
      "gemini-3.8-flash",
      "gemini-4-argon",
    ]) {
      expect(minCacheableTokens(id, "gemini")).toBe(4096);
    }
  });

  it("claims nothing for Flash-Lite or a model the table does not list", () => {
    expect(
      minCacheableTokens("gemini-2.5-flash-lite", "gemini"),
    ).toBeUndefined();
    expect(minCacheableTokens("gemini-2.0-flash", "gemini")).toBeUndefined();
    expect(minCacheableTokens("gemini-3.0-pro", "gemini")).toBeUndefined();
    expect(minCacheableTokens("gemini-40", "gemini")).toBeUndefined();
  });

  it("uses the table for the Gemini API only", () => {
    expect(minCacheableTokens("gemini-2.5-pro", "vertexai")).toBeUndefined();
    expect(minCacheableTokens("gemini-2.5-pro", "openrouter")).toBeUndefined();
  });

  it("leaves the Claude tables as they were", () => {
    expect(minCacheableTokens("claude-sonnet-4-6", "anthropic")).toBe(1024);
    expect(
      minCacheableTokens(
        "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        "bedrock",
      ),
    ).toBe(4096);
  });
});
