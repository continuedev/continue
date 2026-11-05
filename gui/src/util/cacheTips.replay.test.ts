import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import { entry, MIN, t0, MODEL } from "./cacheLedger.testUtils";
import type { CacheLedgerEntry } from "./cacheLedger";
import {
  cacheTips,
  REPLAY_FIDELITY_BAND,
  REPLAY_MIN_REQUESTS,
} from "./cacheTips";

const sonnet: ModelDescription = {
  title: "Sonnet",
  provider: "anthropic",
  model: MODEL,
  underlyingProviderName: "anthropic",
};

const replayTip = (ledger: CacheLedgerEntry[]) =>
  cacheTips(sonnet, "5m", ledger).find((t) => t.id.startsWith("replay-best-"));

/**
 * What really happens under a 5-minute cache for requests `gapMs` apart: each
 * prompt 100k larger than the last, reading the previous prompt while its
 * entry is alive and writing the rest.
 */
function recorded5m(n: number, gapMs: number): CacheLedgerEntry[] {
  return Array.from({ length: n }, (_, i) => {
    const total = (i + 1) * 100_000;
    const prev = i * 100_000;
    const alive = i > 0 && gapMs <= 5 * MIN;
    const read = alive ? prev : 0;
    return entry({
      at: t0 + i * gapMs,
      read,
      write5m: total - read,
    });
  });
}

describe("session replay tip", () => {
  it("suggests the 1-hour cache when long pauses keep expiring a 5-minute entry", () => {
    const tip = replayTip(recorded5m(8, 10 * MIN))!;
    expect(tip).toBeDefined();
    expect(tip.id).toBe("replay-best-1h");
    expect(tip.severity).toBe("info");
    expect(tip.title).toMatch(
      /^The 1-hour cache would have cost about \d+% less here$/,
    );
    expect(tip.body).toContain("8 requests");
    expect(tip.body).toContain("Choose the 1-hour cache in the cache menu.");
    expect(tip.body).toContain("estimate");
  });

  it("states the dollar figures from the recorded tokens", () => {
    const tip = replayTip(recorded5m(8, 10 * MIN))!;
    // 8 requests, every one a full rewrite at $3.75/M: 100k..800k = 3.6M tokens
    expect(tip.body).toContain("$13.50");
  });

  it("says nothing when the current choice is already the cheapest", () => {
    // steady 1-minute requests: the 5-minute cache is best
    expect(replayTip(recorded5m(10, 1 * MIN))).toBeUndefined();
  });

  it("says nothing under the minimum number of requests", () => {
    const few = recorded5m(REPLAY_MIN_REQUESTS - 1, 10 * MIN);
    expect(replayTip(few)).toBeUndefined();
    expect(replayTip(recorded5m(REPLAY_MIN_REQUESTS, 10 * MIN))).toBeDefined();
  });

  it("says nothing when there is no ledger", () => {
    expect(replayTip([])).toBeUndefined();
    expect(cacheTips(sonnet, "5m", undefined)).toEqual([]);
  });

  it("says nothing for an unpriced model", () => {
    const ledger = recorded5m(8, 10 * MIN).map((e) => ({
      ...e,
      model: "gpt-4o",
      provider: "openai",
    }));
    expect(replayTip(ledger)).toBeUndefined();
  });

  it("says nothing when the saving is too small to quote", () => {
    // 7 tiny requests at 2k tokens: the whole bill is a fraction of a cent
    const tiny = Array.from({ length: 7 }, (_, i) =>
      entry({ at: t0 + i * 10 * MIN, write5m: 2_000 + i * 100 }),
    );
    expect(replayTip(tiny)).toBeUndefined();
  });

  it("says nothing when the replay cannot reproduce what was recorded", () => {
    // Recorded as clean reads across 30-minute gaps, which cannot be
    const odd = Array.from({ length: 8 }, (_, i) =>
      entry({
        at: t0 + i * 30 * MIN,
        read: i * 100_000,
        write5m: 100_000,
      }),
    );
    expect(replayTip(odd)).toBeUndefined();
    expect(REPLAY_FIDELITY_BAND).toBeLessThan(0.5);
  });

  it("suggests turning caching off when every write goes unread", () => {
    // One-shot requests an hour apart, each with a fresh unrelated prompt:
    // nothing is ever read, so the writes are wasted
    const oneShots = Array.from({ length: 8 }, (_, i) =>
      entry({
        at: t0 + i * 90 * MIN,
        write5m: 200_000,
        model: MODEL,
        pruned: true,
      }),
    );
    const tip = replayTip(oneShots)!;
    expect(tip.id).toBe("replay-best-off");
    expect(tip.body).toContain("Turn caching off");
  });

  it("is a tip alongside the others, not instead of them", () => {
    const bedrock: ModelDescription = {
      ...sonnet,
      provider: "bedrock",
      model: "us.anthropic.claude-sonnet-4-6",
    };
    const ids = cacheTips(bedrock, "5m", recorded5m(8, 10 * MIN)).map(
      (t) => t.id,
    );
    expect(ids).toEqual(["regional-premium", "replay-best-1h"]);
  });
});

describe("session replay tip on work that is already cheap", () => {
  it("says nothing when the session already used the cheapest lifetime", () => {
    // The same 8 requests, 10 minutes apart, recorded as what really happens
    // under the 1-hour cache: each reads the previous prompt and writes 100k.
    const done = Array.from({ length: 8 }, (_, i) =>
      entry({
        at: t0 + i * 10 * MIN,
        ttl: "1h",
        read: i * 100_000,
        write1h: 100_000,
      }),
    );
    expect(replayTip(done)).toBeUndefined();
  });
});
