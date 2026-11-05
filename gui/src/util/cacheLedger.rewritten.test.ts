import { describe, expect, it } from "vitest";
import { summarizeLedger } from "./cacheLedger";
import { entry, MIN, t0 } from "./cacheLedger.testUtils";
import { formatCacheSummary } from "./cacheLedger";

describe("tokens written again (C17)", () => {
  it("counts the conversation written again after the entry expired", () => {
    // 5-minute entry, next request 12 minutes later writes it all again,
    // plus 10k of new content: only what the first request wrote counts.
    const s = summarizeLedger([
      entry({ at: t0, write5m: 100_000 }),
      entry({ at: t0 + 12 * MIN, write5m: 110_000 }),
    ])!;
    expect(s.rewritten).toEqual({ afterPause: 100_000, afterChange: 0 });
  });

  it("counts it as a change when the entry was alive and the request still wrote", () => {
    const s = summarizeLedger([
      entry({ at: t0, write5m: 100_000 }),
      entry({
        at: t0 + 2 * MIN,
        write5m: 100_000,
        missCauses: ["the tools changed"],
      }),
    ])!;
    expect(s.rewritten).toEqual({ afterPause: 0, afterChange: 100_000 });
  });

  it("counts an expected rebuild (a model switch) as a change too", () => {
    const s = summarizeLedger([
      entry({ at: t0, write5m: 80_000 }),
      entry({
        at: t0 + MIN,
        write5m: 80_000,
        missCauses: ["the model changed"],
      }),
    ])!;
    expect(s.rewritten.afterChange).toBe(80_000);
  });

  it("does not count a read, new content, or a write inside the lifetime", () => {
    const s = summarizeLedger([
      entry({ at: t0, write5m: 100_000 }),
      // reads the old part, writes 5k of new content: nothing re-read
      entry({ at: t0 + MIN, read: 100_000, write5m: 5_000 }),
      entry({ at: t0 + 2 * MIN, read: 105_000, write5m: 4_000 }),
    ])!;
    expect(s.rewritten).toEqual({ afterPause: 0, afterChange: 0 });
  });

  it("uses the 1-hour lifetime of the previous request to decide it was a pause", () => {
    const s = summarizeLedger([
      entry({ at: t0, ttl: "1h", write1h: 100_000 }),
      // 30 minutes later: a 1-hour entry is still alive, so not a pause
      entry({ at: t0 + 30 * MIN, ttl: "1h", write1h: 100_000 }),
      // 90 minutes after that one: expired
      entry({ at: t0 + 120 * MIN, ttl: "1h", write1h: 100_000 }),
    ])!;
    expect(s.rewritten).toEqual({ afterPause: 100_000, afterChange: 0 });
  });

  it("ignores a previous request that was too short to be cached", () => {
    // a prompt under the model's minimum is neither read nor written
    const s = summarizeLedger([
      entry({ at: t0, uncached: 500 }),
      entry({ at: t0 + 20 * MIN, write5m: 4_000 }),
    ])!;
    expect(s.rewritten).toEqual({ afterPause: 0, afterChange: 0 });
  });

  it("adds up several pauses and changes", () => {
    const s = summarizeLedger([
      entry({ at: t0, write5m: 50_000 }),
      entry({ at: t0 + 10 * MIN, write5m: 60_000 }), // pause: 50k
      entry({
        at: t0 + 11 * MIN,
        write5m: 60_000,
        missCauses: ["the tools changed"],
      }), // change: 60k
      entry({ at: t0 + 30 * MIN, write5m: 70_000 }), // pause: 60k
    ])!;
    expect(s.rewritten).toEqual({ afterPause: 110_000, afterChange: 60_000 });
  });
});

describe("formatCacheSummary with re-reads", () => {
  const now = t0 + 40 * MIN;
  const text = (entries: ReturnType<typeof entry>[]) =>
    formatCacheSummary(summarizeLedger(entries), now);

  it("says nothing extra when nothing was written again", () => {
    expect(
      text([
        entry({ at: t0, write5m: 100_000 }),
        entry({ at: t0 + MIN, read: 100_000, uncached: 1_000 }),
      ]),
    ).not.toContain("re-read");
  });

  it("names tokens re-read after pauses", () => {
    expect(
      text([
        entry({ at: t0, write5m: 100_000 }),
        entry({ at: t0 + 12 * MIN, write5m: 110_000 }),
      ]),
    ).toContain("re-read 100.0k tokens after pauses");
  });

  it("names tokens re-read after changes", () => {
    expect(
      text([
        entry({ at: t0, write5m: 80_000 }),
        entry({
          at: t0 + MIN,
          write5m: 80_000,
          missCauses: ["the tools changed"],
        }),
      ]),
    ).toContain("re-read 80.0k tokens after changes");
  });

  it("names both, in one clause", () => {
    expect(
      text([
        entry({ at: t0, write5m: 50_000 }),
        entry({ at: t0 + 10 * MIN, write5m: 60_000 }),
        entry({
          at: t0 + 11 * MIN,
          write5m: 60_000,
          missCauses: ["the tools changed"],
        }),
      ]),
    ).toContain("re-read 50.0k tokens after pauses, 60.0k after changes");
  });
});
