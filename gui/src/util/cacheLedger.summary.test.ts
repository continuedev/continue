import { describe, expect, it } from "vitest";
import { formatCacheSummary, summarizeLedger } from "./cacheLedger";
import { entry, MIN, t0 } from "./cacheLedger.testUtils";
import { MODEL_CHANGED, SHORTER_PROMPT_CAUSE } from "./cacheSafeguards";

describe("summarizeLedger", () => {
  it("is undefined when there are no requests, or caching was never on", () => {
    expect(summarizeLedger([])).toBeUndefined();
    expect(
      summarizeLedger([entry({ cachingOn: false, uncached: 9_000 })]),
    ).toBeUndefined();
  });

  it("counts requests and the share of input read from the cache", () => {
    // input: 100k + 100k + 100k = 300k; read: 0 + 90k + 95k = 185k
    const s = summarizeLedger([
      entry({ at: t0, write5m: 100_000 }),
      entry({ at: t0 + MIN, read: 90_000, uncached: 10_000 }),
      entry({ at: t0 + 2 * MIN, read: 95_000, uncached: 5_000 }),
    ])!;
    expect(s.requests).toBe(3);
    expect(s.hitShare).toBeCloseTo(185 / 300, 6);
    expect(s.misses).toBe(0);
    expect(s.expectedRebuilds).toBe(0);
    expect(s.lastMiss).toBeUndefined();
  });

  it("leaves out requests made with caching off", () => {
    const s = summarizeLedger([
      entry({ cachingOn: false, uncached: 500_000 }),
      entry({ read: 90_000, uncached: 10_000 }),
    ])!;
    expect(s.requests).toBe(1);
    expect(s.hitShare).toBeCloseTo(0.9, 6);
  });

  it("splits the tokens written by lifetime", () => {
    const s = summarizeLedger([
      entry({ write5m: 1_000, write1h: 4_000 }),
      entry({ write5m: 500 }),
    ])!;
    expect(s.written).toEqual({ m5: 1_500, h1: 4_000 });
  });

  it("counts a request with a cause as a miss, and keeps the last one", () => {
    const s = summarizeLedger([
      entry({ at: t0, write5m: 100_000 }),
      entry({
        at: t0 + MIN,
        write5m: 100_000,
        missCauses: ["the tools changed"],
      }),
      entry({
        at: t0 + 2 * MIN,
        write5m: 200_000,
        write1h: 50_000,
        missCauses: [
          "an earlier message was edited or removed (message 2 of 6)",
        ],
      }),
    ])!;
    expect(s.misses).toBe(2);
    expect(s.lastMiss).toEqual({
      at: t0 + 2 * MIN,
      causes: ["an earlier message was edited or removed (message 2 of 6)"],
      tokens: 250_000,
    });
  });

  it("counts a miss with no known cause too", () => {
    const s = summarizeLedger([entry({ missCauses: [] })])!;
    expect(s.misses).toBe(1);
    expect(s.lastMiss?.causes).toEqual([]);
  });

  it("counts a model switch and a pruned window as expected rebuilds, not misses", () => {
    const s = summarizeLedger([
      entry({ missCauses: ["the model changed"] }),
      entry({ missCauses: ["the oldest messages were dropped to fit"] }),
      entry({
        missCauses: [
          "the model changed",
          "the oldest messages were dropped to fit",
        ],
      }),
    ])!;
    expect(s.expectedRebuilds).toBe(3);
    expect(s.misses).toBe(0);
  });

  it("counts a shortened conversation as an expected rebuild, from the cause the thunk records", () => {
    const s = summarizeLedger([
      entry({
        write5m: 30_000,
        missCauses: [SHORTER_PROMPT_CAUSE],
      }),
      entry({ write5m: 40_000, missCauses: [MODEL_CHANGED] }),
    ])!;
    expect(s.expectedRebuilds).toBe(2);
    expect(s.misses).toBe(0);
  });

  it("a model switch together with a real cause is still a miss", () => {
    const s = summarizeLedger([
      entry({ missCauses: ["the model changed", "the tools changed"] }),
    ])!;
    expect(s.misses).toBe(1);
    expect(s.expectedRebuilds).toBe(0);
  });
});

describe("formatCacheSummary", () => {
  const now = t0 + 10 * MIN;

  it("is empty without a summary", () => {
    expect(formatCacheSummary(undefined, now)).toBe("");
  });

  it("says requests and the share, and nothing else for a clean session", () => {
    const s = summarizeLedger([
      entry({ write5m: 100_000 }),
      entry({ read: 90_000, uncached: 10_000 }),
    ])!;
    expect(formatCacheSummary(s, now)).toBe(
      "2 requests \u00b7 45% of input from cache",
    );
  });

  it("uses the singular for one request", () => {
    const s = summarizeLedger([entry({ write5m: 5_000 })])!;
    expect(formatCacheSummary(s, now)).toMatch(/^1 request \u00b7 0% of/);
  });

  it("names the last miss, how long ago, how much was rewritten, and why", () => {
    const s = summarizeLedger([
      entry({ at: t0, write5m: 100_000 }),
      entry({
        at: now - (6 * MIN + 10_000), // 6m 10s before now
        write5m: 310_200,
        missCauses: ["the tools changed"],
      }),
    ])!;
    expect(formatCacheSummary(s, now)).toBe(
      "2 requests \u00b7 0% of input from cache \u00b7 1 miss (last 6m 10s ago, 310.2k tokens rewritten, the tools changed) \u00b7 re-read 100.0k tokens after changes",
    );
  });

  it("pluralises misses and mentions expected rebuilds", () => {
    const s = summarizeLedger([
      entry({ at: t0, write5m: 1_000, missCauses: [] }),
      entry({ at: t0 + MIN, write5m: 1_000, missCauses: [] }),
      entry({
        at: t0 + 2 * MIN,
        write5m: 1_000,
        missCauses: ["the model changed"],
      }),
    ])!;
    const text = formatCacheSummary(s, now);
    expect(text).toContain("2 misses");
    expect(text).toContain("1 expected rebuild");
    expect(text).not.toContain("1 expected rebuilds");
  });

  it("shows a long wait in hours", () => {
    const s = summarizeLedger([
      entry({ at: t0, write5m: 1_000, missCauses: [] }),
    ])!;
    expect(formatCacheSummary(s, t0 + 125 * MIN)).toContain(
      "last 2 h 5 min ago",
    );
  });
});
