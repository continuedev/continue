import { describe, expect, test } from "vitest";

import type { LoopState, TaskPlan } from "../index.js";

import {
  acceptReplan,
  createLoop,
  decideNext,
  finishItemResultFor,
  finishItemRun,
  loopItemPrompt,
  runItemAgain,
  startItemRun,
  stopLoop,
} from "./loopMode.js";
import {
  hasReplanReminder,
  replanReminderTarget,
  saveReminder,
  takeReminders,
} from "./loopReminders.js";

const T0 = new Date("2026-11-08T10:00:00Z");
const T1 = new Date("2026-11-08T10:05:00Z");
const ctx = { now: T1, sessionTokens: 0 };

function planOf(...texts: string[]): TaskPlan {
  return {
    items: texts.map((text, i) => ({
      id: String(i + 1),
      text,
      status: "pending" as const,
    })),
    updatedAt: T0.toISOString(),
  };
}

const PLAN = planOf("A", "B", "C");
const later = { outcome: "later" as const, summary: "x" };
const done = { outcome: "done" as const, summary: "ok" };
const fresh = (plan = PLAN) => createLoop(plan, { now: T0, sessionTokens: 0 });

function save(
  loop: LoopState,
  when: string,
  extra: { fromItemId?: string; item?: string; note?: string } = {},
): LoopState {
  const saved = saveReminder(
    loop,
    PLAN,
    { fromItemId: "1", note: "A note", when, ...extra },
    T0,
  );
  if (!saved.ok) throw new Error(saved.error);
  return saved.loop;
}

const ITEM_2 = { kind: "item", itemId: "2" } as const;

/** Item 2's run starts, given the reminders due to it. */
function startWithReminders(loop: LoopState) {
  const taken = takeReminders(loop, ITEM_2, {}, T1);
  return {
    loop: startItemRun(taken.loop, "2", 3, T1),
    reminders: taken.reminders,
  };
}

describe("a run that dies keeps its reminders", () => {
  test("stopped before reporting: the note is delivered to the next run", () => {
    const { loop, reminders } = startWithReminders(save(fresh(), "next_items"));
    expect(reminders).toHaveLength(1);
    expect(loop.reminders?.[0].deliveredAt).toBeDefined();
    const stopped = stopLoop(loop, "error", "The request failed");
    expect(stopped.reminders?.[0].deliveredAt).toBeUndefined();
    expect(takeReminders(stopped, ITEM_2, {}, T1).reminders).toHaveLength(1);
  });

  test("ended without a report: the same", () => {
    const { loop } = startWithReminders(save(fresh(), "next_items"));
    const ended = finishItemRun(loop, undefined);
    expect(ended.reminders?.[0].deliveredAt).toBeUndefined();
  });

  test("a run that reported has used it", () => {
    const { loop } = startWithReminders(save(fresh(), "next_items"));
    expect(finishItemRun(loop, done).reminders?.[0].deliveredAt).toBeDefined();
    const reported: LoopState = {
      ...loop,
      current: { ...loop.current!, report: done },
    };
    expect(
      stopLoop(reported, "stopped", "x").reminders?.[0].deliveredAt,
    ).toBeDefined();
  });

  test("a note delivered to an earlier run stays delivered", () => {
    const first = takeReminders(
      save(fresh(), "next_items"),
      ITEM_2,
      {},
      T0,
    ).loop;
    const running = startItemRun(first, "2", 3, T1);
    expect(
      stopLoop(running, "stopped", "x").reminders?.[0].deliveredAt,
    ).toBeDefined();
  });
});

describe("re-plans and reminders", () => {
  test("a note for an item that left the plan goes to the next item", () => {
    const running = startItemRun(fresh(), "1", 0, T0);
    let loop = save(running, "retry", { note: "for retry" });
    loop = save(loop, "item", { item: "2", note: "for two" });
    loop = finishItemRun(loop, { outcome: "stuck", summary: "x" });
    const reworded = {
      ...PLAN,
      items: PLAN.items.filter((t) => t.id === "3"),
    };
    const accepted = acceptReplan(loop, reworded, ctx);
    expect(accepted.reminders?.map((r) => r.when)).toEqual([
      "next_items",
      "next_items",
    ]);
    expect(accepted.reminders?.[1].itemId).toBeUndefined();
    const taken = takeReminders(
      accepted,
      { kind: "item", itemId: "3" },
      {},
      T1,
    );
    expect(taken.reminders.map((r) => r.reminder.note)).toEqual([
      "for retry",
      "for two",
    ]);
  });

  test("a note whose item stayed is left alone", () => {
    const running = startItemRun(fresh(), "1", 0, T0);
    const loop = finishItemRun(save(running, "retry"), {
      outcome: "stuck",
      summary: "x",
    });
    expect(acceptReplan(loop, PLAN, ctx).reminders?.[0].when).toBe("retry");
  });

  test("a repair takes only its own item's notes", () => {
    let loop = save(fresh(), "retry", { note: "my retry" });
    loop = save(loop, "replan", { note: "my follow-up" });
    loop = save(loop, "replan", { fromItemId: "2", note: "other follow-up" });
    const taken = takeReminders(
      loop,
      replanReminderTarget({ itemId: "1" }),
      {},
      T1,
    );
    expect(taken.reminders.map((r) => r.reminder.note)).toEqual([
      "my retry",
      "my follow-up",
    ]);
    expect(replanReminderTarget({})).toEqual({ kind: "replan" });
    // The other item's follow-up still waits for a real re-plan
    expect(hasReplanReminder(taken.loop)).toBe(true);
  });

  test("a follow-up for a re-plan keeps the loop from ending", () => {
    const two = planOf("A");
    let loop = startItemRun(fresh(two), "1", 0, T0);
    loop = finishItemRun(save(loop, "replan"), done);
    expect(decideNext(loop, two, ctx).kind).toBe("replan");
    const read = takeReminders(loop, { kind: "replan" }, {}, T1).loop;
    expect(decideNext(read, two, ctx).kind).toBe("stop");
  });
});

describe("setting an item aside", () => {
  const set = () => finishItemRun(startItemRun(fresh(), "1", 0, T0), later);

  test("only until it has run: after that it keeps its place", () => {
    const aside = set();
    expect(aside.items[0].setAside).toBe(true);
    expect(decideNext(aside, PLAN, ctx)).toEqual({ kind: "run", itemId: "2" });
    const ran = finishItemRun(startItemRun(aside, "1", 0, T1), undefined);
    expect(ran.items[0].setAside).toBeUndefined();
    expect(ran.items[0].deferrals).toBe(1);
    expect(decideNext(ran, PLAN, ctx)).toEqual({ kind: "run", itemId: "1" });
  });

  test("the prompt says so without claiming other items ran", () => {
    const prompt = loopItemPrompt({
      item: PLAN.items[0],
      answers: [],
      questions: [],
      attempt: 1,
      returning: true,
    });
    expect(prompt).toContain("An earlier run set this item aside");
    expect(prompt).not.toContain("other items have run");
  });

  test("Run again on a set-aside item says what is true", () => {
    expect(runItemAgain(set(), "1")).toEqual({
      ok: false,
      error: "1 was set aside and is still to run",
    });
  });

  test("the tool result matches what the report comes to", () => {
    const running = startItemRun(fresh(), "1", 0, T0);
    expect(finishItemResultFor(running, "1", "later")).toContain("comes back");
    const blocked: LoopState = {
      ...running,
      questions: [
        {
          id: "q1",
          itemId: "1",
          question: "Which?",
          kind: "blocking",
          askedAt: T0.toISOString(),
        },
      ],
    };
    expect(finishItemResultFor(blocked, "1", "later")).toContain(
      "waits for the answer",
    );
    const again = startItemRun(set(), "1", 0, T1);
    expect(finishItemResultFor(again, "1", "later")).toContain(
      "recorded as stuck",
    );
    expect(finishItemResultFor(running, "1", "done")).toContain(
      "Recorded as done",
    );
  });
});
