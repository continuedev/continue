import { describe, expect, it } from "vitest";
import { replayAll } from "./cacheLedger";
import { entry, MIN, t0 } from "./cacheLedger.testUtils";

describe("replayAll", () => {
  it("is undefined for an empty ledger or an unpriced model", () => {
    expect(replayAll([])).toBeUndefined();
    expect(
      replayAll([entry({ model: "gpt-4o", uncached: 5 })]),
    ).toBeUndefined();
  });

  it("agrees with the recorded cost when the replay matches what happened", () => {
    const actual = [
      entry({ at: t0, write5m: 100_000 }),
      entry({ at: t0 + MIN, read: 100_000, write5m: 100_000 }),
      entry({ at: t0 + 2 * MIN, read: 200_000, write5m: 100_000 }),
    ];
    const r = replayAll(actual)!;
    expect(r.actualUsd).toBeCloseTo(1.215, 6);
    expect(r.replayedActualUsd).toBeCloseTo(1.215, 6);
    expect(r.fidelity).toBeCloseTo(1, 6);
    expect(r.best).toBe("5m");
    expect(r.usd.off).toBeCloseTo(1.8, 6);
  });

  it("picks 1h when pauses keep expiring a 5-minute entry", () => {
    const actual = [
      entry({ at: t0, write5m: 100_000 }),
      entry({ at: t0 + 10 * MIN, write5m: 200_000 }),
      entry({ at: t0 + 20 * MIN, write5m: 300_000 }),
    ];
    const r = replayAll(actual)!;
    expect(r.fidelity).toBeCloseTo(1, 6);
    expect(r.usd["1h"]!).toBeLessThan(r.usd["5m"]!);
  });

  it("reports a fidelity far from 1 when the recorded tokens contradict the timings", () => {
    // Recorded as a clean read, but the 30-minute gap says it must have expired
    const odd = [
      entry({ at: t0, write5m: 100_000 }),
      entry({ at: t0 + 30 * MIN, read: 100_000, write5m: 100_000 }),
    ];
    expect(replayAll(odd)!.fidelity).toBeGreaterThan(1.2);
  });
});
