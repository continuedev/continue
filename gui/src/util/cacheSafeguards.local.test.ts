import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import { formatRereadCost } from "./cacheNotices";
import {
  detectCacheMiss,
  isSignificantLoss,
  expectedRoute,
  NOTICE_MIN_TOKENS_LOCAL,
  promptCacheKey,
  sameServedModel,
  switchKeepsCache,
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

describe("sameServedModel", () => {
  it("is true for variants of one model on one server, false otherwise", () => {
    const plan = { ...strata, title: "Qwen#plan" };
    const act = {
      ...strata,
      title: "Qwen#act",
      apiBase: "http://127.0.0.1:8083/v1",
    };
    expect(sameServedModel(plan, act)).toBe(true);
    expect(sameServedModel(plan, { ...act, model: "other" })).toBe(false);
    expect(
      sameServedModel(plan, { ...act, apiBase: "http://127.0.0.1:8086/v1/" }),
    ).toBe(false);
  });
});

describe("routes in the cache key", () => {
  const sonnet: ModelDescription = {
    title: "Claude Sonnet",
    provider: "bedrock",
    model: "us.anthropic.claude-sonnet-4-6",
    underlyingProviderName: "bedrock",
    routes: ["bedrock-us", "anthropic-work"],
  };

  it("a different route is a different model", () => {
    const a = promptCacheKey(sonnet, [], "sys", [], "bedrock-us");
    const b = promptCacheKey(sonnet, [], "sys", [], "anthropic-work");
    expect(a.model).not.toBe(b.model);
    expect(promptCacheKey(model("openai"), [], "sys").model).toBe(
      "openai/qwen3.8-flash-next-nvfp4-nvfp4",
    );
  });

  it("expects the route that answered last, else the first", () => {
    expect(expectedRoute(sonnet)).toBe("bedrock-us");
    const last = promptCacheKey(sonnet, [], "sys", [], "anthropic-work");
    expect(expectedRoute(sonnet, last)).toBe("anthropic-work");
    expect(expectedRoute(model("openai"), last)).toBeUndefined();
  });
});

describe("local re-read time", () => {
  it("estimates the time from the server's last read speed", () => {
    const loss = warmCacheLoss(
      strata,
      undefined,
      state({ lastInputTokens: 120_000, promptTokensPerSecond: 1000 }),
      t0 + 60_000,
    );
    expect(loss).toEqual({ tokens: 120_000, local: true, seconds: 120 });
    expect(formatRereadCost(loss!)).toBe(
      "120k tokens from scratch on the model server (about 2 min at its last speed)",
    );
  });
});

describe("detectCacheMiss on a local server", () => {
  const key = {
    model: "openai:qwen",
    tools: [],
    system: "s",
    messages: [],
  } as any;

  it("uses the local lifetime instead of a cache-control one", () => {
    const before = state({ lastInputTokens: 120_000, lastKey: key });
    const request = {
      before,
      key,
      requestAt: t0 + 10 * 60_000, // 10 minutes later: past 5m, within 15m
      readTokens: 0,
      totalInputTokens: 125_000,
    };
    expect(detectCacheMiss(request)).toBeUndefined();
    expect(
      detectCacheMiss({ ...request, lifetimeMs: LOCAL_CACHE_WARM_MS }),
    ).toMatchObject({ readTokens: 0, expectedTokens: 120_000 });
  });
});

describe("switchKeepsCache", () => {
  const effort = (e: string) => ({
    ...strata,
    requestOptions: { extraBodyProperties: { reasoning_effort: e } },
  });
  it("keeps the cache between variants that only change sampling", () => {
    const a = { ...effort("low"), completionOptions: { temperature: 0.2 } };
    const b = { ...effort("low"), completionOptions: { temperature: 1 } };
    expect(switchKeepsCache(a as any, b as any)).toBe(true);
  });
  it("not between variants with another reasoning effort", () => {
    expect(switchKeepsCache(effort("low"), effort("high"))).toBe(false);
  });
});
