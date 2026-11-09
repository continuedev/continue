import { beforeEach, describe, expect, it } from "vitest";

import { recordRefusals, resetRefusalCount } from "./refusalCap.js";

describe("the refusal cap", () => {
  beforeEach(() => resetRefusalCount());

  it("a single refusal does not end the turn", () => {
    expect(recordRefusals(1, true)).toBe(false);
  });

  it("three rounds in a row that only refused end it", () => {
    expect(recordRefusals(1, true)).toBe(false);
    expect(recordRefusals(1, true)).toBe(false);
    expect(recordRefusals(1, true)).toBe(true);
  });

  it("a round that ran something resets the run of refusals", () => {
    recordRefusals(1, true);
    recordRefusals(1, true);
    expect(recordRefusals(0, false)).toBe(false);
    expect(recordRefusals(1, true)).toBe(false);
    expect(recordRefusals(1, true)).toBe(false);
    expect(recordRefusals(1, true)).toBe(true);
  });

  it("twenty refused calls in one turn end it, however spread", () => {
    expect(recordRefusals(10, true)).toBe(false);
    recordRefusals(0, false);
    expect(recordRefusals(10, true)).toBe(true);
  });

  it("a new turn starts clean", () => {
    recordRefusals(1, true);
    recordRefusals(1, true);
    resetRefusalCount();
    expect(recordRefusals(1, true)).toBe(false);
  });
});
