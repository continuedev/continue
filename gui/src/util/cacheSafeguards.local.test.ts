import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import { formatRereadCost } from "./cacheNotices";
import {
  isSignificantLoss,
  NOTICE_MIN_TOKENS_LOCAL,
  warmCacheLoss,
} from "./cacheSafeguards";
import {
  LOCAL_CACHE_WARM_MS,
  modelUsesLocalPrefixCache,
  type PromptCacheSessionState,
} from "./promptCache";

const t0 = 1_000_000_000;

function model(
  provider: string,
  apiBase?: string,
  id = "qwen3.8-flash-next-nvfp4-nvfp4",
): ModelDescription {
  return {
    title: id,
    provider,
    model: id,
    underlyingProviderName: provider,
    ...(apiBase ? { apiBase } : {}),
  };
}
const strata = model("openai", "http://127.0.0.1:8083/v1/");

const state = (
  extra: Partial<PromptCacheSessionState> = {},
): PromptCacheSessionState => ({
  escalated: false,
  lastRequestAt: t0,
  lastInputTokens: 120_000,
  ...extra,
});

describe("modelUsesLocalPrefixCache", () => {
  it("is true for an OpenAI-compatible server on this machine or the local network", () => {
    expect(modelUsesLocalPrefixCache(strata)).toBe(true);
    expect(
      modelUsesLocalPrefixCache(model("openai", "http://localhost:8080/v1")),
    ).toBe(true);
    expect(
      modelUsesLocalPrefixCache(model("vllm", "http://192.168.1.20:8000/v1")),
    ).toBe(true);
    expect(
      modelUsesLocalPrefixCache(model("openai", "http://[::1]:8080/v1")),
    ).toBe(true);
    expect(modelUsesLocalPrefixCache(model("ollama"))).toBe(true);
  });

  it("is false for cloud APIs and for models with their own cache control", () => {
    expect(
      modelUsesLocalPrefixCache(model("openai", undefined, "gpt-4o")),
    ).toBe(false);
    expect(
      modelUsesLocalPrefixCache(model("openai", "https://api.example.com/v1")),
    ).toBe(false);
    expect(
      modelUsesLocalPrefixCache(
        model("anthropic", "http://localhost:4000", "claude-sonnet-4-6"),
      ),
    ).toBe(false);
  });
});

describe("warmCacheLoss for a local server", () => {
  it("counts the last prompt as cached while the last request was recent", () => {
    const loss = warmCacheLoss(strata, undefined, state(), t0 + 60_000);
    expect(loss).toEqual({ tokens: 120_000, local: true });
    expect(isSignificantLoss(loss)).toBe(true);
  });

  it("is nothing once the guess at the server's cache lifetime has passed", () => {
    expect(
      warmCacheLoss(strata, undefined, state(), t0 + LOCAL_CACHE_WARM_MS + 1),
    ).toBeUndefined();
  });

  it("is nothing before a request has reported its size", () => {
    expect(
      warmCacheLoss(
        strata,
        undefined,
        state({ lastInputTokens: undefined }),
        t0,
      ),
    ).toBeUndefined();
  });

  it("matters from a smaller conversation than for unpriced cloud models", () => {
    expect(
      isSignificantLoss({ tokens: NOTICE_MIN_TOKENS_LOCAL, local: true }),
    ).toBe(true);
    expect(
      isSignificantLoss({ tokens: NOTICE_MIN_TOKENS_LOCAL - 1, local: true }),
    ).toBe(false);
  });
});

describe("formatRereadCost", () => {
  it("says time on the server for a local model, price for a cloud one", () => {
    expect(formatRereadCost({ tokens: 120_000, local: true })).toBe(
      "120k tokens from scratch on the model server",
    );
    expect(formatRereadCost({ tokens: 366_000, extraUsd: 1.1 })).toBe(
      "366k tokens at full price (about $1.10 more)",
    );
    expect(formatRereadCost({ tokens: 366_000 })).toBe(
      "366k tokens at full price",
    );
  });
});
