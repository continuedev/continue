import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  nextTickDelay,
  ringFraction,
} from "./promptCacheCountdown";

const S = 1000;
const MIN = 60 * S;

describe("formatCountdown", () => {
  it.each([
    [1, "1s"],
    [200, "1s"],
    [45 * S, "45s"],
    [59 * S + 100, "1:00"],
    [60 * S, "1:00"],
    [4 * MIN + 12 * S, "4:12"],
    [4 * MIN + 11 * S + 1, "4:12"],
    [9 * MIN + 59 * S, "9:59"],
    [10 * MIN - 1, "10:00"],
    [10 * MIN, "10m"],
    [10 * MIN + 1, "11m"],
    [42 * MIN, "42m"],
    [60 * MIN, "60m"],
  ])("%i ms -> %s", (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});

describe("ringFraction", () => {
  it("is full when just written and empty at expiry", () => {
    expect(ringFraction(5 * MIN, 5 * MIN)).toBe(1);
    expect(ringFraction(0, 5 * MIN)).toBe(0);
  });

  it("is proportional in between", () => {
    expect(ringFraction(15 * MIN, 60 * MIN)).toBeCloseTo(0.25);
  });

  it("stays within 0 and 1 and survives a missing lifetime", () => {
    expect(ringFraction(-5, MIN)).toBe(0);
    expect(ringFraction(2 * MIN, MIN)).toBe(1);
    expect(ringFraction(MIN, 0)).toBe(0);
  });
});

describe("nextTickDelay", () => {
  it("never returns less than 1", () => {
    for (const ms of [-5, 0, 1, 999, 1000, 10 * MIN, 30 * MIN]) {
      expect(nextTickDelay(ms)).toBeGreaterThanOrEqual(1);
    }
  });

  it("wakes exactly when the displayed text changes, in the seconds range", () => {
    for (const ms of [
      9 * MIN + 59 * S + 400,
      4 * MIN + 12 * S,
      4 * MIN + 11 * S + 1,
      61 * S,
      45 * S + 700,
      2 * S,
    ]) {
      const before = formatCountdown(ms);
      const delay = nextTickDelay(ms);
      expect(formatCountdown(ms - delay + 1)).toBe(before);
      expect(formatCountdown(ms - delay)).not.toBe(before);
    }
  });

  it("wakes exactly when the displayed text changes, in the minutes range", () => {
    for (const ms of [42 * MIN, 42 * MIN - 1, 30 * MIN + 5 * S, 11 * MIN + 1]) {
      const before = formatCountdown(ms);
      const delay = nextTickDelay(ms);
      expect(formatCountdown(ms - delay + 1)).toBe(before);
      expect(formatCountdown(ms - delay)).not.toBe(before);
    }
  });

  it("switches to counting seconds just below ten minutes", () => {
    expect(nextTickDelay(10 * MIN)).toBe(1);
    expect(formatCountdown(10 * MIN - 1)).toBe("10:00");
  });

  it("wakes just after expiry when the last second ends", () => {
    expect(nextTickDelay(500)).toBe(501);
    expect(nextTickDelay(1)).toBe(2);
  });
});
