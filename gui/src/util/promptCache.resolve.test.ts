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
      requests: 1,
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

describe("resolvePromptCache: Auto moves to 1 hour after 5 requests", () => {
  const auto = (state: PromptCacheSessionState, at: number, mode?: string) =>
    resolvePromptCache(sonnet, "auto", state, at, mode);

  /** Send n requests 10 seconds apart in a mode; return each request's lifetime. */
  function run(n: number, mode: string | undefined, setting: any = "auto") {
    let s: PromptCacheSessionState = { escalated: false };
    const ttls: (string | undefined)[] = [];
    for (let i = 0; i < n; i++) {
      const r = resolvePromptCache(sonnet, setting, s, t0 + i * 10_000, mode);
      ttls.push(r.options.promptCacheTtl);
      s = r.nextState;
    }
    return { ttls, state: s };
  }

  it("uses 5 minutes for requests 1 to 4 and 1 hour from request 5, in agent mode", () => {
    const { ttls, state } = run(7, "agent");
    expect(ttls).toEqual(["5m", "5m", "5m", "5m", "1h", "1h", "1h"]);
    expect(state.escalatedBy).toBe("requests");
    expect(state.requests).toBe(7);
  });

  it.each(["plan", "background"])("applies in %s mode too", (mode) => {
    expect(run(5, mode).ttls[4]).toBe("1h");
  });

  it("never counts up to 1 hour in chat mode or with no mode", () => {
    expect(new Set(run(12, "chat").ttls)).toEqual(new Set(["5m"]));
    expect(new Set(run(12, undefined).ttls)).toEqual(new Set(["5m"]));
  });

  it("ignores the count when the lifetime is fixed", () => {
    expect(new Set(run(9, "agent", "5m").ttls)).toEqual(new Set(["5m"]));
    expect(new Set(run(9, "agent", "1h").ttls)).toEqual(new Set(["1h"]));
  });

  it("the gap rule still wins when it fires first, and says why", () => {
    let s = auto({ escalated: false }, t0, "agent").nextState;
    const r = auto(s, t0 + 10 * MIN, "agent");
    expect(r.options.promptCacheTtl).toBe("1h");
    expect(r.nextState.escalatedBy).toBe("gap");
    // later requests keep the original reason
    const later = auto(r.nextState, t0 + 10 * MIN + 1000, "agent");
    expect(later.nextState.escalatedBy).toBe("gap");
  });

  it("does not count requests that send no cache settings of their own", () => {
    const off = resolvePromptCache(
      sonnet,
      "off",
      { escalated: false },
      t0,
      "agent",
    );
    expect(off.nextState.requests).toBeUndefined();
    const unsupported = resolvePromptCache(
      model("openai", "gpt-4o"),
      "auto",
      { escalated: false },
      t0,
      "agent",
    );
    expect(unsupported.nextState.requests).toBeUndefined();
  });

  it("does not claim 1 hour for a model that cannot take it", () => {
    let s: PromptCacheSessionState = { escalated: false };
    for (let i = 0; i < 6; i++) {
      s = resolvePromptCache(
        bedrockOld,
        "auto",
        s,
        t0 + i * 1000,
        "agent",
      ).nextState;
    }
    expect(s.lastTtl).toBe("5m");
  });

  it("follows a config ttl of auto, and ignores a fixed config ttl", () => {
    const cfg = (ttl: string) =>
      ({
        ...sonnet,
        completionOptions: { promptCaching: true },
        cacheBehavior: { ttl },
      }) as any;
    const count = (m: any) => {
      let s: PromptCacheSessionState = { escalated: false };
      let last: any;
      for (let i = 0; i < 6; i++) {
        last = resolvePromptCache(m, undefined, s, t0 + i * 1000, "agent");
        s = last.nextState;
      }
      return s;
    };
    expect(count(cfg("auto")).lastTtl).toBe("1h");
    expect(count(cfg("5m")).lastTtl).toBe("5m");
    expect(count(cfg("5m")).escalated).toBe(false);
  });

  it("a resumed conversation keeps counting from its saved total", () => {
    const r = auto({ escalated: false, requests: 4 }, t0, "agent");
    expect(r.options.promptCacheTtl).toBe("1h");
  });
});
