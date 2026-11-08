import { describe, expect, test } from "vitest";

import type { LoopState, TaskPlan } from "../index.js";

import {
  acceptReplan,
  createLoop,
  endReplan,
  replanConcern,
  startReplan,
} from "./loopMode.js";
import { buildTaskPlan } from "./taskPlan.js";

const T0 = new Date("2026-11-08T10:00:00Z");

function planOf(...items: { id: string; text: string; check?: string }[]) {
  return {
    items: items.map((item) => ({ status: "pending" as const, ...item })),
    updatedAt: T0.toISOString(),
  } as TaskPlan;
}

const PLAN = planOf(
  { id: "1", text: "A", check: "node a" },
  { id: "2", text: "B", check: "node b" },
);

function withStates(
  autonomy: LoopState["autonomy"],
  states: Record<string, Partial<LoopState["items"][number]>>,
): LoopState {
  const loop = createLoop(PLAN, { now: T0, sessionTokens: 0 });
  return {
    ...loop,
    autonomy,
    items: loop.items.map((i) => ({ ...i, ...states[i.id] })),
  };
}

const failedCheck = {
  status: "failed" as const,
  check: {
    status: "failed" as const,
    command: "node b",
    exitCode: 1,
    at: T0.toISOString(),
  },
};
const done = { status: "done" as const };

describe("what a re-plan must not do quietly", () => {
  test("changing a check that failed", () => {
    const loop = withStates("auto", { "1": done, "2": failedCheck });
    const easier = planOf(
      { id: "1", text: "A", check: "node a" },
      { id: "2", text: "B", check: "test -f b" },
    );
    expect(replanConcern(loop, easier)).toBe(
      "It changes or removes the failing check of item 2.",
    );
  });

  test("removing a check that failed, or the item that had it", () => {
    const loop = withStates("auto", { "1": done, "2": failedCheck });
    const removed = planOf(
      { id: "1", text: "A", check: "node a" },
      { id: "2", text: "B" },
    );
    expect(replanConcern(loop, removed)).toContain("failing check of item 2");
    expect(
      replanConcern(loop, planOf({ id: "1", text: "A", check: "node a" })),
    ).toContain("failing check of item 2");
  });

  test("dropping a finished item", () => {
    const loop = withStates("auto", { "1": done });
    expect(replanConcern(loop, planOf({ id: "2", text: "B" }))).toBe(
      "It drops finished item 1.",
    );
  });

  test("keeping them is fine, and so is a skipped item left out", () => {
    expect(
      replanConcern(withStates("auto", { "1": done, "2": failedCheck }), PLAN),
    ).toBeUndefined();
    const skipped = withStates("auto", {
      "1": { status: "done", skipped: true },
    });
    expect(replanConcern(skipped, planOf({ id: "2", text: "B" }))).toBe(
      undefined,
    );
    // A check that passed can change
    const passed = withStates("auto", {
      "1": {
        status: "done",
        check: {
          status: "passed",
          command: "node a",
          exitCode: 0,
          at: T0.toISOString(),
        },
      },
    });
    expect(
      replanConcern(passed, planOf({ id: "1", text: "A", check: "x" })),
    ).toBeUndefined();
  });

  test("the loop then waits for the person, at any level, and says why", () => {
    const start = startReplan(
      withStates("auto", { "1": done, "2": failedCheck }),
      0,
      T0,
      { plan: PLAN, itemId: "2" },
    );
    const easier = planOf(
      { id: "1", text: "A", check: "node a" },
      { id: "2", text: "B", check: "test -f b" },
    );
    const ended = endReplan(start, easier);
    expect(ended.accept).toBe(false);
    expect(ended.loop.status).toBe("awaiting_plan");
    expect(ended.loop.replanReason).toContain("failing check of item 2");
  });

  test("a repair that keeps the check goes on by itself", () => {
    const start = startReplan(
      withStates("auto", { "1": done, "2": failedCheck }),
      0,
      T0,
      { plan: PLAN, itemId: "2" },
    );
    expect(endReplan(start, PLAN).accept).toBe(true);
  });
});

describe("after a re-plan the person accepted", () => {
  test("the result of a check the plan no longer has is forgotten", () => {
    const loop = withStates("auto", { "1": done, "2": failedCheck });
    const accepted = acceptReplan(
      loop,
      planOf({ id: "1", text: "A", check: "node a" }, { id: "2", text: "B" }),
      { now: T0, sessionTokens: 0 },
    );
    expect(accepted.items[1].status).toBe("pending");
    expect(accepted.items[1].check).toBeUndefined();
  });

  test("a check that stayed keeps its result", () => {
    const loop = withStates("auto", { "2": failedCheck });
    const accepted = acceptReplan(loop, PLAN, { now: T0, sessionTokens: 0 });
    expect(accepted.items[1].check?.status).toBe("failed");
  });
});

describe("ids of new to-dos", () => {
  const texts = (...t: string[]) => t.map((text) => ({ text }));

  test("a new to-do does not take the id of a dropped one", () => {
    const first = buildTaskPlan(texts("A", "B"));
    if (!first.ok) throw new Error(first.error);
    expect(first.plan.items.map((i) => i.id)).toEqual(["1", "2"]);
    const next = buildTaskPlan([{ id: "1", text: "A" }, { text: "C" }], {
      previous: first.plan,
    });
    if (!next.ok) throw new Error(next.error);
    expect(next.plan.items.map((i) => i.id)).toEqual(["1", "3"]);
  });

  test("a fresh list starts over", () => {
    const first = buildTaskPlan(texts("A", "B"));
    if (!first.ok) throw new Error(first.error);
    const fresh = buildTaskPlan(texts("C"), {
      previous: first.plan,
      reset: true,
    });
    if (!fresh.ok) throw new Error(fresh.error);
    expect(fresh.plan.items.map((i) => i.id)).toEqual(["1"]);
  });
});
