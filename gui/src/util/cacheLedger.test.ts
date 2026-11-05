import { describe, expect, it } from "vitest";
import {
  actualInputCost,
  appendLedger,
  buildLedgerEntry,
  entryInputTokens,
  LEDGER_MAX,
  type CacheLedgerEntry,
} from "./cacheLedger";
import { entry, MODEL, t0 } from "./cacheLedger.testUtils";

describe("buildLedgerEntry", () => {
  it("splits the usage and keeps writes as 5-minute when the split is unreported", () => {
    const e = buildLedgerEntry({
      at: t0,
      mode: "agent",
      provider: "anthropic",
      model: MODEL,
      cachingOn: true,
      ttl: "5m",
      oneHour: true,
      usage: {
        promptTokens: 12,
        completionTokens: 34,
        promptTokensDetails: { cachedTokens: 5000, cacheWriteTokens: 700 },
      },
    });
    expect(e).toMatchObject({
      uncached: 12,
      read: 5000,
      write5m: 700,
      write1h: 0,
      output: 34,
    });
    expect(entryInputTokens(e)).toBe(5712);
  });

  it("uses the reported 1-hour share", () => {
    const e = buildLedgerEntry({
      at: t0,
      provider: "bedrock",
      model: MODEL,
      cachingOn: true,
      ttl: "1h",
      oneHour: true,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: { cacheWriteTokens: 900, cacheWriteTokens1h: 600 },
      },
    });
    expect(e.write5m).toBe(300);
    expect(e.write1h).toBe(600);
  });

  it("never lets the 1-hour share exceed the writes", () => {
    const e = buildLedgerEntry({
      at: t0,
      provider: "bedrock",
      model: MODEL,
      cachingOn: true,
      oneHour: true,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: { cacheWriteTokens: 100, cacheWriteTokens1h: 900 },
      },
    });
    expect(e.write1h).toBe(100);
    expect(e.write5m).toBe(0);
  });

  it("records no lifetime when caching was off", () => {
    const e = buildLedgerEntry({
      at: t0,
      provider: "anthropic",
      model: MODEL,
      cachingOn: false,
      ttl: "5m",
      oneHour: true,
      usage: { promptTokens: 10, completionTokens: 1 },
    });
    expect(e.ttl).toBeUndefined();
  });
});

describe("appendLedger", () => {
  it("keeps only the most recent entries", () => {
    let l: CacheLedgerEntry[] | undefined;
    for (let i = 0; i < LEDGER_MAX + 25; i++) {
      l = appendLedger(l, entry({ at: i }));
    }
    expect(l).toHaveLength(LEDGER_MAX);
    expect(l![0].at).toBe(25);
    expect(l![LEDGER_MAX - 1].at).toBe(LEDGER_MAX + 24);
  });

  it("does not change the list it was given", () => {
    const a = [entry()];
    appendLedger(a, entry({ at: 1 }));
    expect(a).toHaveLength(1);
  });
});

describe("actualInputCost", () => {
  it("prices each component", () => {
    const cost = actualInputCost([
      entry({ uncached: 1e6, read: 1e6, write5m: 1e6, write1h: 1e6 }),
    ]);
    expect(cost).toBeCloseTo(3 + 0.3 + 3.75 + 6, 6);
  });

  it("is undefined for an unpriced model", () => {
    expect(
      actualInputCost([entry({ model: "gpt-4o", uncached: 10 })]),
    ).toBeUndefined();
  });
});
