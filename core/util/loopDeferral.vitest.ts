import { describe, expect, test } from "vitest";

import type { LoopState, TaskPlan } from "../index.js";

import {
  createLoop,
  decideNext,
  deferralSpent,
  finishItemReport,
  finishItemResult,
  formatLoopStatus,
  itemTurnLimitResult,
  LOOP_MAX_DEFERRALS,
  loopItemPrompt,
  repeatedCallResult,
  startItemRun,
  finishItemRun,
} from "./loopMode.js";
import {
  LOOP_REMINDER_LIMITS,
  reminderFileStamp,
  saveLaterReminder,
  saveReminder,
  takeReminders,
} from "./loopReminders.js";

const T0 = new Date("2026-11-08T10:00:00Z");
const ctx = { now: T0, sessionTokens: 0 };

function planOf(...items: { text: string; after?: string[] }[]): TaskPlan {
  return {
    items: items.map((item, i) => ({
      id: String(i + 1),
      status: "pending" as const,
      ...item,
    })),
    updatedAt: T0.toISOString(),
  };
}

const PLAN = planOf({ text: "A" }, { text: "B" }, { text: "C" });
const later = { outcome: "later" as const, summary: "Needs B first" };
const status = (loop: LoopState, id: string) =>
  loop.items.find((i) => i.id === id)?.status;
const fresh = (plan = PLAN) => createLoop(plan, { now: T0, sessionTokens: 0 });
const run = (
  loop: LoopState,
  id: string,
  report: Parameters<typeof finishItemRun>[1],
) => finishItemRun(startItemRun(loop, id, 0, T0), report);
const next = (loop: LoopState, plan = PLAN) => decideNext(loop, plan, ctx);
const done = { outcome: "done" as const, summary: "ok" };

describe('finish_item outcome "later"', () => {
  test("needs a reminder within the limit", () => {
    expect(finishItemReport({ outcome: "later", summary: "x" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("needs `reminder`"),
    });
    expect(
      finishItemReport({
        outcome: "later",
        reminder: "x".repeat(LOOP_REMINDER_LIMITS.maxLength + 1),
      }),
    ).toMatchObject({ ok: false });
    expect(
      finishItemReport({
        outcome: "later",
        summary: "x",
        reminder: " Tried Y ",
        files: ["a.ts", 3],
      }),
    ).toMatchObject({
      ok: true,
      report: { outcome: "later", summary: "x" },
      later: { note: "Tried Y", files: ["a.ts"] },
    });
    expect(finishItemReport({ outcome: "done" })).not.toHaveProperty("later");
  });

  test("the item goes behind the other runnable items", () => {
    let loop = run(fresh(), "1", later);
    expect(status(loop, "1")).toBe("pending");
    expect(next(loop)).toEqual({ kind: "run", itemId: "2" });
    loop = run(loop, "2", done);
    expect(next(loop)).toEqual({ kind: "run", itemId: "3" });
    loop = run(loop, "3", done);
    expect(next(loop)).toEqual({ kind: "run", itemId: "1" });
  });

  test("leaves the failure and no-progress counters and attempts alone", () => {
    const failing = { ...fresh(), consecutiveFailures: 2, doneThisRound: 1 };
    const loop = run(failing, "1", later);
    expect(loop.consecutiveFailures).toBe(2);
    expect(loop.doneThisRound).toBe(1);
    expect(loop.items[0].attempts).toBe(0);
    expect(loop.items[0].deferrals).toBe(1);
  });

  test("a second later is recorded as stuck", () => {
    expect(LOOP_MAX_DEFERRALS).toBe(1);
    const once = run(fresh(), "1", later);
    expect(deferralSpent(once, "1")).toBe(true);
    const twice = run(once, "1", later);
    expect(status(twice, "1")).toBe("failed");
    expect(twice.consecutiveFailures).toBe(1);
    expect(twice.items[0].deferrals).toBe(1);
    expect(twice.items[0].summary).toBe(
      "Set aside a second time, so recorded as stuck: Needs B first",
    );
    expect(finishItemResult("later", false)).toContain("comes back");
    expect(finishItemResult("later", true)).toContain("recorded as stuck");
  });

  test("an item with an open blocking question waits instead", () => {
    const running = startItemRun(fresh(), "1", 0, T0);
    const held = {
      ...running,
      questions: [
        {
          id: "q1",
          itemId: "1",
          question: "Which?",
          kind: "blocking" as const,
          askedAt: T0.toISOString(),
        },
      ],
    };
    const loop = finishItemRun(held, later);
    expect(status(loop, "1")).toBe("waiting");
    expect(loop.items[0].deferrals).toBeUndefined();
  });

  test("the note comes back with the item, marked if its file changed", () => {
    const stamp = reminderFileStamp("before");
    let loop = saveLaterReminder(
      startItemRun(fresh(), "1", 0, T0),
      "1",
      "Tried Y; B adds the API",
      [{ path: "a.ts", stamp }],
      T0,
    );
    loop = finishItemRun(loop, later);
    const elsewhere = takeReminders(
      loop,
      { kind: "item", itemId: "2" },
      {},
      T0,
    );
    expect(elsewhere.reminders).toEqual([]);
    const back = takeReminders(
      loop,
      { kind: "item", itemId: "1" },
      { "a.ts": reminderFileStamp("after") },
      T0,
    );
    expect(back.reminders[0].reminder.note).toBe("Tried Y; B adds the API");
    expect(back.reminders[0].staleFiles).toEqual(["a.ts"]);
    expect(
      loopItemPrompt({
        item: PLAN.items[0],
        answers: [],
        questions: [],
        attempt: 1,
        reminders: back.reminders,
        returning: true,
      }),
    ).toContain("An earlier run set this item aside");
  });

  test("the note is saved even past the reminder caps", () => {
    let loop = startItemRun(fresh(), "1", 0, T0);
    for (let i = 0; i < LOOP_REMINDER_LIMITS.maxPerItem; i++) {
      const saved = saveReminder(
        loop,
        PLAN,
        { fromItemId: "1", note: `n${i}`, when: "next_items" },
        T0,
      );
      if (!saved.ok) throw new Error(saved.error);
      loop = saved.loop;
    }
    const after = saveLaterReminder(loop, "1", "Why later", [], T0);
    expect(after.reminders?.at(-1)?.note).toBe("Why later");
  });

  test("a loop with only deferred items left runs them, and finishes", () => {
    const two = planOf({ text: "A" }, { text: "B" });
    let loop = run(fresh(two), "1", later);
    loop = run(loop, "2", later);
    expect(next(loop, two)).toEqual({ kind: "run", itemId: "1" });
    loop = run(loop, "1", done);
    expect(next(loop, two)).toEqual({ kind: "run", itemId: "2" });
    loop = run(loop, "2", done);
    expect(next(loop, two).kind).not.toBe("run");
    expect(status(loop, "2")).toBe("done");
  });

  test("an item waiting on a deferred one keeps waiting", () => {
    const deps = planOf(
      { text: "A" },
      { text: "B", after: ["1"] },
      { text: "C" },
    );
    const loop = run(fresh(deps), "1", later);
    expect(next(loop, deps)).toEqual({ kind: "run", itemId: "3" });
    const c = run(loop, "3", done);
    expect(next(c, deps)).toEqual({ kind: "run", itemId: "1" });
  });

  test("the status shows how many items were deferred", () => {
    expect(formatLoopStatus(fresh())).not.toContain("deferred");
    expect(formatLoopStatus(run(fresh(), "1", later))).toContain("1 deferred");
  });

  test("the stall messages offer it", () => {
    expect(repeatedCallResult("Read", 4)).toContain('with outcome "later"');
    expect(itemTurnLimitResult(60)).toContain('"later"');
  });
});
