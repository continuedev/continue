import { beforeEach, describe, expect, it } from "vitest";

import {
  checkRepeatedCall,
  recordInvalidCalls,
  recordRepeatOutcome,
  resetRepeatGuard,
  startRepeatRound,
} from "./repeatGuard.js";

const read = { name: "Read", arguments: { filepath: "a.ts" } };
const readB = { name: "Read", arguments: { filepath: "b.ts" } };
const taskList = {
  name: "TaskList",
  arguments: { items: [{ text: "a", status: "pending" }] },
};

type Call = { name: string; arguments: Record<string, unknown> };

/** One round of the given calls, each recorded as succeeded unless `errored`. */
function round(calls: Call[], errored = false) {
  startRepeatRound();
  const verdicts = calls.map((c) => checkRepeatedCall(c));
  calls.forEach((c, i) => {
    if (!verdicts[i].refusal) recordRepeatOutcome(c, errored);
  });
  return verdicts;
}

describe("the repeat guard", () => {
  beforeEach(() => resetRepeatGuard());

  it("lets a call run twice and refuses the third identical one", () => {
    expect(round([read])[0]).toEqual({ endTurn: false });
    expect(round([read])[0]).toEqual({ endTurn: false });
    const third = round([read])[0];
    expect(third.refusal).toContain("Read was not run");
    expect(third.refusal).toContain("identical to the last 2 calls");
    expect(third.endTurn).toBe(false);
  });

  it("ends the turn at the sixth identical call", () => {
    for (let i = 0; i < 5; i++) {
      expect(round([read])[0].endTurn).toBe(false);
    }
    expect(round([read])[0].endTurn).toBe(true);
  });

  it("compares arguments as canonical JSON, so key order does not matter", () => {
    round([{ name: "Read", arguments: { a: 1, b: 2 } }]);
    round([{ name: "Read", arguments: { b: 2, a: 1 } }]);
    expect(
      round([{ name: "Read", arguments: { a: 1, b: 2 } }])[0].refusal,
    ).toBeDefined();
  });

  it("a different call in between resets the run", () => {
    round([read]);
    round([read]);
    round([readB]);
    expect(round([read])[0].refusal).toBeUndefined();
  });

  it("counts identical calls within one round too", () => {
    const verdicts = round(Array.from({ length: 6 }, () => taskList));
    expect(verdicts.slice(0, 2).every((v) => !v.refusal)).toBe(true);
    expect(verdicts[2].refusal).toContain(
      "the task list is already as you sent it",
    );
    expect(verdicts[2].refusal).toContain("Do not resend it unchanged");
    expect(verdicts[5].endTurn).toBe(true);
  });

  it("counts a call repeated in every round even when other calls come with it", () => {
    round([read, readB]);
    round([read, { name: "Read", arguments: { filepath: "c.ts" } }]);
    const [third] = round([read]);
    expect(third.refusal).toBeDefined();
  });

  it("says the call failed when every earlier identical call errored", () => {
    round([read], true);
    round([read], true);
    const [third] = round([read]);
    expect(third.refusal).toContain(
      "already failed 2 times with the same arguments",
    );
    expect(third.refusal).toContain("Read it and change something");
  });

  it("says the result is above when an earlier identical call succeeded", () => {
    round([read], true);
    round([read], false);
    const [third] = round([read]);
    expect(third.refusal).toContain("whose result is above");
  });

  it("a refused call keeps counting toward the end of the turn", () => {
    round([read]);
    round([read]);
    expect(round([read])[0].refusal).toBeDefined();
    expect(round([read])[0].refusal).toBeDefined();
    expect(round([read])[0].endTurn).toBe(false);
    expect(round([read])[0].endTurn).toBe(true);
  });

  it("a new turn starts clean", () => {
    round([read]);
    round([read]);
    resetRepeatGuard();
    expect(round([read])[0].refusal).toBeUndefined();
  });

  describe("rounds of calls with invalid arguments", () => {
    it("adds a note from the third round in a row and ends the turn at the sixth", () => {
      expect(recordInvalidCalls(true)).toEqual({ endTurn: false });
      expect(recordInvalidCalls(true)).toEqual({ endTurn: false });
      const third = recordInvalidCalls(true);
      expect(third.refusal).toContain("3rd round in a row");
      expect(third.refusal).toContain("invalid arguments");
      expect(third.endTurn).toBe(false);
      recordInvalidCalls(true);
      recordInvalidCalls(true);
      expect(recordInvalidCalls(true).endTurn).toBe(true);
    });

    it("a round with only valid calls resets the run", () => {
      recordInvalidCalls(true);
      recordInvalidCalls(true);
      expect(recordInvalidCalls(false)).toEqual({ endTurn: false });
      expect(recordInvalidCalls(true).refusal).toBeUndefined();
    });

    it("the count is per turn", () => {
      recordInvalidCalls(true);
      recordInvalidCalls(true);
      resetRepeatGuard();
      expect(recordInvalidCalls(true).refusal).toBeUndefined();
    });
  });
});
