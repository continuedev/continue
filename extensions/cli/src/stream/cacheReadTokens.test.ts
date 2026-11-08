import { describe, expect, it } from "vitest";

import { cacheReadTokens } from "./streamChatResponse.helpers.js";

describe("cacheReadTokens", () => {
  it("reads the adapters' cache_read_tokens", () => {
    expect(
      cacheReadTokens({ cache_read_tokens: 900, cached_tokens: 900 }),
    ).toBe(900);
  });

  it("reads cached_tokens from OpenAI-style servers (OpenAI, Strata, llama.cpp)", () => {
    // Strata's usage on a repeated prefix: only cached_tokens is set
    expect(cacheReadTokens({ cached_tokens: 1251 })).toBe(1251);
  });

  it("is undefined without details", () => {
    expect(cacheReadTokens(undefined)).toBeUndefined();
    expect(cacheReadTokens({})).toBeUndefined();
  });
});
