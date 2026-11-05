import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import {
  coldResume,
  detectCacheMiss,
  isSignificantLoss,
  missExtraUsd,
  NOTICE_MIN_EXTRA_USD,
  promptCacheKey,
  warmCacheLoss,
} from "./cacheSafeguards";
import type { PromptCacheSessionState } from "./promptCache";

const MIN = 60 * 1000;
const t0 = 1_000_000_000;

function model(provider: string, id: string): ModelDescription {
  return { title: id, provider, model: id, underlyingProviderName: provider };
}
const sonnet = model("anthropic", "claude-sonnet-4-6"); // $3 in
const haiku = model("anthropic", "claude-haiku-4-5-20251001"); // $1 in
const unpriced = model("bedrock", "us.anthropic.claude-sonnet-9-9-v1:0");
const gpt = model("openai", "gpt-4o");

const state = (
  extra: Partial<PromptCacheSessionState> = {},
): PromptCacheSessionState => ({
  escalated: false,
  lastRequestAt: t0,
  lastTtl: "5m",
  lastInputTokens: 366_000,
  ...extra,
});

describe("coldResume", () => {
  it("reports the cost once the 5-minute cache has expired", () => {
    const r = coldResume(sonnet, "auto", state(), t0 + 12 * MIN)!;
    expect(r.tokens).toBe(366_000);
    expect(r.idleMs).toBe(12 * MIN);
    // 366,000 tokens * $3/MTok * (1.25 - 0.1), but Auto moves to 1 hour on
    // this request after a 12 minute pause: (2 - 0.1)
    expect(r.extraUsd).toBeCloseTo(2.0862, 4);
  });

  it("uses the 5-minute write price when the setting is fixed at 5 minutes", () => {
    const r = coldResume(sonnet, "5m", state(), t0 + 12 * MIN)!;
    expect(r.extraUsd).toBeCloseTo(1.2627, 4);
  });

  it("is undefined while the cache is warm", () => {
    expect(coldResume(sonnet, "auto", state(), t0 + 2 * MIN)).toBeUndefined();
  });

  it("is undefined with caching off", () => {
    expect(coldResume(sonnet, "off", state(), t0 + 12 * MIN)).toBeUndefined();
  });

  it("is undefined before any request or before a size is known", () => {
    expect(
      coldResume(sonnet, "auto", { escalated: false }, t0 + 12 * MIN),
    ).toBeUndefined();
    expect(
      coldResume(
        sonnet,
        "auto",
        state({ lastInputTokens: undefined }),
        t0 + 12 * MIN,
      ),
    ).toBeUndefined();
  });

  it("stays quiet when the amount is small", () => {
    // 20,000 tokens on Haiku 4.5 is about two cents
    expect(
      coldResume(
        haiku,
        "5m",
        state({ lastInputTokens: 20_000 }),
        t0 + 12 * MIN,
      ),
    ).toBeUndefined();
  });

  it("falls back to a token threshold for an unpriced model", () => {
    const big = coldResume(
      unpriced,
      "5m",
      state({ lastInputTokens: 150_000 }),
      t0 + 12 * MIN,
    )!;
    expect(big.extraUsd).toBeUndefined();
    expect(
      coldResume(
        unpriced,
        "5m",
        state({ lastInputTokens: 60_000 }),
        t0 + 12 * MIN,
      ),
    ).toBeUndefined();
  });

  it("is undefined for a provider that ignores the setting", () => {
    expect(coldResume(gpt, "auto", state(), t0 + 12 * MIN)).toBeUndefined();
  });

  it("does not assume 1 hour after a pause too long for it to have helped", () => {
    const r = coldResume(sonnet, "auto", state(), t0 + 3 * 60 * MIN)!;
    expect(r.extraUsd).toBeCloseTo(1.2627, 4);
  });
});

describe("warmCacheLoss", () => {
  it("prices a switch while the cache is warm", () => {
    const l = warmCacheLoss(sonnet, "auto", state(), t0 + MIN)!;
    expect(l.tokens).toBe(366_000);
    expect(l.extraUsd).toBeCloseTo(1.2627, 4);
  });

  it("is undefined once the cache has expired", () => {
    expect(
      warmCacheLoss(sonnet, "auto", state(), t0 + 6 * MIN),
    ).toBeUndefined();
  });
});

describe("detectCacheMiss", () => {
  const key = promptCacheKey(sonnet, ["read_file", "edit"], "system A");
  const before = (extra: Partial<PromptCacheSessionState> = {}) =>
    state({ lastKey: key, ...extra });
  const base = {
    key,
    requestAt: t0 + 30 * 1000,
    readTokens: 0,
    totalInputTokens: 370_000,
  };

  it("reports a request that read almost nothing of a warm, big prompt", () => {
    const m = detectCacheMiss({ before: before(), ...base })!;
    expect(m.readTokens).toBe(0);
    expect(m.expectedTokens).toBe(366_000);
    expect(m.causes).toEqual([]);
  });

  it("is quiet when the cache was read", () => {
    expect(
      detectCacheMiss({ before: before(), ...base, readTokens: 365_000 }),
    ).toBeUndefined();
    // exactly half is not a miss; under half is
    expect(
      detectCacheMiss({ before: before(), ...base, readTokens: 183_000 }),
    ).toBeUndefined();
    expect(
      detectCacheMiss({ before: before(), ...base, readTokens: 182_999 }),
    ).toBeDefined();
  });

  it("is quiet when the previous cache had expired", () => {
    expect(
      detectCacheMiss({ before: before(), ...base, requestAt: t0 + 6 * MIN }),
    ).toBeUndefined();
  });

  it("uses the 1-hour lifetime the last request was written with", () => {
    expect(
      detectCacheMiss({
        before: before({ lastTtl: "1h" }),
        ...base,
        requestAt: t0 + 30 * MIN,
      }),
    ).toBeDefined();
  });

  it("is quiet when the prompt got shorter (compaction or truncation)", () => {
    expect(
      detectCacheMiss({ before: before(), ...base, totalInputTokens: 40_000 }),
    ).toBeUndefined();
  });

  it("is quiet for small prompts", () => {
    expect(
      detectCacheMiss({
        before: before({ lastInputTokens: 20_000 }),
        ...base,
        totalInputTokens: 22_000,
      }),
    ).toBeUndefined();
  });

  it("is quiet before any request", () => {
    expect(
      detectCacheMiss({ before: { escalated: false }, ...base }),
    ).toBeUndefined();
  });

  it("names what changed: the tools and the system prompt", () => {
    const changed = promptCacheKey(sonnet, ["read_file"], "system B");
    const m = detectCacheMiss({
      before: before(),
      ...base,
      key: changed,
    })!;
    expect(m.causes).toEqual([
      "the tools changed",
      "the system prompt changed (a rule or a summary)",
    ]);
  });

  it("names only the part that changed", () => {
    const m = detectCacheMiss({
      before: before(),
      ...base,
      key: promptCacheKey(sonnet, ["read_file", "edit", "grep"], "system A"),
    })!;
    expect(m.causes).toEqual(["the tools changed"]);
  });

  it("notices a rule that started to match, because it changes the system prompt", () => {
    const withRule = promptCacheKey(
      sonnet,
      ["read_file", "edit"],
      "system A\n\nAlways use tabs.",
    );
    const m = detectCacheMiss({ before: before(), ...base, key: withRule })!;
    expect(m.causes).toEqual([
      "the system prompt changed (a rule or a summary)",
    ]);
  });

  it("does not report a model switch on its own: the user chose it and was told", () => {
    const other = model("anthropic", "claude-opus-4-8");
    expect(
      detectCacheMiss({
        before: before(),
        ...base,
        key: promptCacheKey(other, ["read_file", "edit"], "system A"),
      }),
    ).toBeUndefined();
  });

  it("still reports a model switch that came with another change", () => {
    const other = model("anthropic", "claude-opus-4-8");
    const m = detectCacheMiss({
      before: before(),
      ...base,
      key: promptCacheKey(other, ["read_file"], "system A"),
    })!;
    expect(m.causes).toEqual(["the model changed", "the tools changed"]);
  });

  it("says when the oldest messages were dropped to fit the window", () => {
    const m = detectCacheMiss({ before: before(), ...base, pruned: true })!;
    expect(m.causes).toEqual(["the oldest messages were dropped to fit"]);
  });

  it("adds pruning to a known cause", () => {
    const m = detectCacheMiss({
      before: before(),
      ...base,
      pruned: true,
      key: promptCacheKey(sonnet, ["read_file"], "system A"),
    })!;
    expect(m.causes).toEqual([
      "the tools changed",
      "the oldest messages were dropped to fit",
    ]);
  });
});

describe("promptCacheKey", () => {
  it("is the same for the same inputs and differs when any part changes", () => {
    const a = promptCacheKey(sonnet, ["a", "b"], "s");
    expect(promptCacheKey(sonnet, ["a", "b"], "s")).toEqual(a);
    expect(promptCacheKey(sonnet, ["b", "a"], "s").tools).not.toBe(a.tools);
    expect(promptCacheKey(sonnet, ["a", "b"], "t").system).not.toBe(a.system);
    expect(promptCacheKey(gpt, ["a", "b"], "s").model).not.toBe(a.model);
  });
});

describe("isSignificantLoss", () => {
  it("compares the dollar amount with the bar", () => {
    expect(
      isSignificantLoss({ tokens: 1, extraUsd: NOTICE_MIN_EXTRA_USD }),
    ).toBe(true);
    expect(isSignificantLoss({ tokens: 1, extraUsd: 0.1 })).toBe(false);
  });

  it("compares tokens when there is no price", () => {
    expect(isSignificantLoss({ tokens: 100_000 })).toBe(true);
    expect(isSignificantLoss({ tokens: 99_999 })).toBe(false);
    expect(isSignificantLoss(undefined)).toBe(false);
  });
});

describe("missExtraUsd", () => {
  it("is write minus read per token", () => {
    const pricing = {
      input: 3,
      output: 15,
      cacheWrite: 3.75,
      cacheWrite1h: 6,
      cacheRead: 0.3,
    };
    expect(missExtraUsd(pricing, 1_000_000, "5m")).toBeCloseTo(3.45, 6);
    expect(missExtraUsd(pricing, 1_000_000, "1h")).toBeCloseTo(5.7, 6);
  });
});
