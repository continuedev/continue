import type { CacheLedgerEntry } from "./cacheLedger";

export const MIN = 60_000;
export const t0 = 1_000_000_000;

// Sonnet 4.6: $3 input, $3.75 5m write, $6 1h write, $0.30 read. It takes a
// 1-hour lifetime and caches from 1,024 tokens, so round numbers work.
export const MODEL = "claude-sonnet-4-6";

export function entry(over: Partial<CacheLedgerEntry> = {}): CacheLedgerEntry {
  return {
    at: t0,
    mode: "agent",
    provider: "anthropic",
    model: MODEL,
    cachingOn: true,
    ttl: "5m",
    oneHour: true,
    uncached: 0,
    read: 0,
    write5m: 0,
    write1h: 0,
    output: 0,
    ...over,
  };
}

/** n requests `gapMs` apart; each prompt is 100k tokens larger than the last. */
export function conversation(n: number, gapMs: number, mode = "agent") {
  return Array.from({ length: n }, (_, i) =>
    entry({ at: t0 + i * gapMs, mode, uncached: (i + 1) * 100_000 }),
  );
}
