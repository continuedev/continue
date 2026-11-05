import { describe, expect, it } from "vitest";
import { replayAll, replayInputCost } from "./cacheLedger";
import { conversation, entry, MIN, t0 } from "./cacheLedger.testUtils";

describe("replayInputCost against hand-worked answers", () => {
  // Three requests 1 minute apart, prompts of 100k, 200k, 300k tokens.
  const three = conversation(3, 1 * MIN);

  it("off: every token at the input price", () => {
    expect(replayInputCost(three, "off")).toBeCloseTo(1.8, 6); // 600k * $3/M
  });

  it("5m: write the first prompt, then read the previous and write the new part", () => {
    // r1: write 100k            = 0.1 * 3.75         = 0.375
    // r2: read 100k, write 100k = 0.1*0.3 + 0.1*3.75 = 0.405
    // r3: read 200k, write 100k = 0.2*0.3 + 0.1*3.75 = 0.435
    expect(replayInputCost(three, "5m")).toBeCloseTo(1.215, 6);
  });

  it("1h: the same shape with the 1-hour write price", () => {
    // r1: 0.1*6 = 0.6   r2: 0.03 + 0.6   r3: 0.06 + 0.6
    expect(replayInputCost(three, "1h")).toBeCloseTo(1.89, 6);
  });

  it("5m loses the cache across a gap over 5 minutes, 1h keeps it", () => {
    const gap = conversation(2, 10 * MIN);
    // 5m: r1 write 100k (0.375); r2's entry expired: write 200k (0.75)
    expect(replayInputCost(gap, "5m")).toBeCloseTo(1.125, 6);
    // 1h: r1 write 100k (0.6); r2 reads 100k (0.03) and writes 100k (0.6)
    expect(replayInputCost(gap, "1h")).toBeCloseTo(1.23, 6);
    expect(replayInputCost(gap, "off")).toBeCloseTo(0.9, 6);
  });

  it("a read refreshes the lifetime, so steady requests stay warm on 5m", () => {
    const steady = conversation(5, 4 * MIN); // each within 5 minutes of the last
    // request i reads 0.1*i*0.3 and writes 0.1*3.75
    const expected = [0, 1, 2, 3, 4]
      .map((i) => i * 0.1 * 0.3 + 0.1 * 3.75)
      .reduce((a, b) => a + b, 0);
    expect(replayInputCost(steady, "5m")).toBeCloseTo(expected, 6);
  });

  it("a pruned prompt breaks the chain under every policy", () => {
    const broken = conversation(3, MIN);
    broken[1] = { ...broken[1], pruned: true };
    // r2 cannot read r1: it writes all 200k (0.75); r3 reads 200k, writes 100k
    expect(replayInputCost(broken, "5m")).toBeCloseTo(0.375 + 0.75 + 0.435, 6);
  });

  it("a model change breaks the chain", () => {
    const switched = conversation(2, MIN);
    switched[1] = { ...switched[1], model: "claude-opus-4-6" };
    // r2 on Opus 4.6 ($6.25 write per M): writes all 200k = 1.25
    expect(replayInputCost(switched, "5m")).toBeCloseTo(0.375 + 1.25, 6);
  });

  it("a prompt under the model's cache minimum is not cached", () => {
    // Haiku 4.5 caches from 4,096 tokens; 3,000 tokens pay the input price ($1/M)
    const small = [entry({ model: "claude-haiku-4-5", uncached: 3_000 })];
    expect(replayInputCost(small, "5m")).toBeCloseTo(0.003, 9);
  });

  it("1h falls back to 5m for a model that cannot take it", () => {
    const e = conversation(2, 10 * MIN).map((x) => ({ ...x, oneHour: false }));
    expect(replayInputCost(e, "1h")).toBeCloseTo(replayInputCost(e, "5m")!, 9);
  });

  it("is undefined for an unpriced model", () => {
    expect(
      replayInputCost([entry({ model: "gpt-4o", uncached: 10 })], "5m"),
    ).toBeUndefined();
  });
});

describe("replayInputCost under Auto", () => {
  it("stays on 5 minutes for four requests, then 1 hour from the fifth, in agent mode", () => {
    const e = conversation(6, 10 * 1000); // 10 s apart, no pause trigger
    let expected = 0;
    for (let i = 0; i < 6; i++) {
      const total = (i + 1) * 100_000;
      const prev = i * 100_000;
      const price = i >= 4 ? 6 : 3.75;
      expected += (prev * 0.3 + (total - prev) * price) / 1e6;
    }
    expect(replayInputCost(e, "auto")).toBeCloseTo(expected, 6);
  });

  it("does not count up in chat mode", () => {
    const e = conversation(8, 10 * 1000, "chat");
    expect(replayInputCost(e, "auto")).toBeCloseTo(
      replayInputCost(e, "5m")!,
      9,
    );
  });

  it("moves to 1 hour after a pause of 5 to 55 minutes", () => {
    const e = conversation(3, 10 * MIN, "chat");
    // r1 5m write 0.375; r2 (gap 10m) escalates and r1's entry expired: write
    // 200k at 1h = 1.2; r3: r2's 1h entry is alive, read 200k, write 100k at 1h
    const expected = 0.375 + 1.2 + (0.2 * 0.3 + 0.1 * 6);
    expect(replayInputCost(e, "auto")).toBeCloseTo(expected, 6);
  });
});
