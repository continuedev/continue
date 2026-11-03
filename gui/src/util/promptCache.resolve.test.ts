import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import {
  AUTO_ESCALATE_MAX_GAP_MS,
  AUTO_ESCALATE_MIN_GAP_MS,
  INITIAL_PROMPT_CACHE_STATE,
  resolvePromptCache,
  type PromptCacheSessionState,
} from "./promptCache";

const MIN = 60 * 1000;
const t0 = 1_000_000_000;

function model(provider: string, id: string): ModelDescription {
  return { title: id, provider, model: id, underlyingProviderName: provider };
}

const sonnet = model("anthropic", "claude-sonnet-4-6");
const bedrockOld = model(
  "bedrock",
  "anthropic.claude-3-7-sonnet-20250219-v1:0",
);

describe("resolvePromptCache", () => {
  it("sends nothing and tracks nothing for unsupported models", () => {
    const state = { ...INITIAL_PROMPT_CACHE_STATE };
    const r = resolvePromptCache(model("openai", "gpt-4o"), "auto", state, t0);
    expect(r.options).toEqual({});
    expect(r.nextState).toBe(state);
  });

  it("leaves the request alone when the setting follows a config with caching off", () => {
    const state = { ...INITIAL_PROMPT_CACHE_STATE };
    const r = resolvePromptCache(sonnet, undefined, state, t0);
    expect(r.options).toEqual({});
    expect(r.nextState).toBe(state);
  });

  it("leaves the request alone when config has caching on", () => {
    const on = { ...sonnet, completionOptions: { promptCaching: true } };
    const r = resolvePromptCache(on, undefined, { escalated: false }, t0);
    expect(r.options).toEqual({});
    expect(r.nextState.lastRequestAt).toBe(t0);
  });

  it("turns caching off explicitly", () => {
    const state = { ...INITIAL_PROMPT_CACHE_STATE };
    const r = resolvePromptCache(sonnet, "off", state, t0);
    expect(r.options).toEqual({ promptCaching: false });
    expect(r.nextState).toBe(state);
  });

  it("sends the chosen fixed lifetime", () => {
    expect(
      resolvePromptCache(sonnet, "5m", { escalated: false }, t0).options,
    ).toEqual({ promptCaching: true, promptCacheTtl: "5m" });
    expect(
      resolvePromptCache(sonnet, "1h", { escalated: false }, t0).options,
    ).toEqual({ promptCaching: true, promptCacheTtl: "1h" });
  });
});

describe("resolvePromptCache in auto", () => {
  function step(state: PromptCacheSessionState, at: number) {
    return resolvePromptCache(sonnet, "auto", state, at);
  }

  it("starts at 5 minutes", () => {
    const r = step({ escalated: false }, t0);
    expect(r.options).toEqual({ promptCaching: true, promptCacheTtl: "5m" });
    expect(r.nextState).toEqual({
      lastRequestAt: t0,
      escalated: false,
      lastTtl: "5m",
      lastInputTokens: undefined,
    });
  });

  it("carries the last request's size into the next state", () => {
    const r = step(
      { escalated: false, lastRequestAt: t0, lastInputTokens: 84_000 },
      t0 + 30 * 1000,
    );
    expect(r.nextState.lastInputTokens).toBe(84_000);
  });

  it("stays at 5 minutes while requests keep coming", () => {
    let s = step({ escalated: false }, t0).nextState;
    for (let i = 1; i <= 10; i++) {
      const r = step(s, t0 + i * 30 * 1000);
      expect(r.options.promptCacheTtl).toBe("5m");
      s = r.nextState;
    }
    expect(s.escalated).toBe(false);
  });

  it("moves to 1 hour after a pause 1 hour would have covered", () => {
    const first = step({ escalated: false }, t0).nextState;
    const r = step(first, t0 + 11 * MIN);
    expect(r.options.promptCacheTtl).toBe("1h");
    expect(r.nextState.escalated).toBe(true);
  });

  it("stays on 1 hour for the rest of the session", () => {
    const first = step({ escalated: false }, t0).nextState;
    const second = step(first, t0 + 11 * MIN).nextState;
    const third = step(second, t0 + 11 * MIN + 10 * 1000);
    expect(third.options.promptCacheTtl).toBe("1h");
  });

  it("does not move on a gap of exactly 5 minutes", () => {
    const first = step({ escalated: false }, t0).nextState;
    const r = step(first, t0 + AUTO_ESCALATE_MIN_GAP_MS);
    expect(r.options.promptCacheTtl).toBe("5m");
  });

  it("does not move on a gap too long for 1 hour to have helped", () => {
    const first = step({ escalated: false }, t0).nextState;
    const r = step(first, t0 + AUTO_ESCALATE_MAX_GAP_MS + 1);
    expect(r.options.promptCacheTtl).toBe("5m");
    expect(r.nextState.escalated).toBe(false);
  });

  it("moves on a gap of exactly the upper bound", () => {
    const first = step({ escalated: false }, t0).nextState;
    const r = step(first, t0 + AUTO_ESCALATE_MAX_GAP_MS);
    expect(r.options.promptCacheTtl).toBe("1h");
  });

  it("records 5 minutes when Bedrock cannot take 1 hour", () => {
    const first = resolvePromptCache(
      bedrockOld,
      "auto",
      { escalated: false },
      t0,
    ).nextState;
    const r = resolvePromptCache(bedrockOld, "auto", first, t0 + 11 * MIN);
    expect(r.options.promptCacheTtl).toBe("1h");
    expect(r.nextState.lastTtl).toBe("5m");
  });
});
