import { describe, expect, test } from "vitest";

import type { LoopState, TaskPlan } from "../index.js";

import {
  createLoop,
  finishItemRun,
  LOOP_CLI_TOOL_NAMES,
  loopItemPrompt,
  loopReplanPrompt,
  restoreLoop,
  startItemRun,
} from "./loopMode.js";
import {
  LOOP_REMINDER_LIMITS,
  reminderFilePaths,
  reminderFileStamp,
  reminderPathsDue,
  reminderSavedResult,
  saveReminder,
  takeReminders,
  type LoopReminderTarget,
} from "./loopReminders.js";

const T0 = new Date("2026-11-08T10:00:00Z");

const PLAN: TaskPlan = {
  items: ["Parser", "Tests", "Docs"].map((text, i) => ({
    id: String(i + 1),
    text,
    status: "pending" as const,
  })),
  updatedAt: T0.toISOString(),
};

const start = (): LoopState =>
  startItemRun(createLoop(PLAN, { now: T0, sessionTokens: 0 }), "1", 0, T0);

type Input = Partial<Parameters<typeof saveReminder>[2]>;

const attempt = (loop: LoopState, input: Input) =>
  saveReminder(
    loop,
    PLAN,
    { fromItemId: "1", note: "A note", when: "next_items", ...input },
    T0,
  );

function save(loop: LoopState, input: Input): LoopState {
  const result = attempt(loop, input);
  if (!result.ok) throw new Error(result.error);
  return result.loop;
}

function refused(loop: LoopState, input: Input): string {
  const result = attempt(loop, input);
  if (result.ok) throw new Error("it was saved");
  return result.error;
}

const take = (
  loop: LoopState,
  target: LoopReminderTarget,
  stamps: Record<string, string> = {},
) => takeReminders(loop, target, stamps, T0);

const notes = (loop: LoopState, target: LoopReminderTarget) =>
  take(loop, target).reminders.map((r) => r.reminder.note);

const ITEM_1 = { kind: "item", itemId: "1" } as const;
const ITEM_2 = { kind: "item", itemId: "2" } as const;
const ITEM_3 = { kind: "item", itemId: "3" } as const;
const REPLAN = { kind: "replan" } as const;

describe("saving a reminder", () => {
  test("is on the loop at once, with an id and where it came from", () => {
    const saved = attempt(start(), {
      note: "  The cause is X  ",
      when: "retry",
    });
    if (!saved.ok) throw new Error(saved.error);
    expect(saved.reminder).toEqual({
      id: "r1",
      note: "The cause is X",
      when: "retry",
      fromItemId: "1",
      savedAt: T0.toISOString(),
    });
    expect(saved.loop.reminders).toEqual([saved.reminder]);
    expect(reminderSavedResult(saved.reminder, false)).toBe(
      "Saved as r1, for a later run of this item.",
    );
  });

  test("refuses a bad note or when, saying why", () => {
    expect(refused(start(), { note: "   " })).toContain("empty");
    expect(refused(start(), { note: 3 })).toContain("empty");
    expect(refused(start(), { when: "later" })).toContain(
      "item, next_items, retry, replan",
    );
    const long = "x".repeat(LOOP_REMINDER_LIMITS.maxLength + 1);
    expect(refused(start(), { note: long })).toContain("Shorten it");
    expect(() =>
      save(start(), { note: "x".repeat(LOOP_REMINDER_LIMITS.maxLength) }),
    ).not.toThrow();
  });

  test('when "item" needs an item that can still run', () => {
    expect(refused(start(), { when: "item" })).toContain("needs `item`");
    expect(refused(start(), { when: "item", item: "9" })).toContain(
      "no item 9",
    );
    expect(refused(start(), { when: "item", item: "1" })).toContain("retry");
    const done = finishItemRun(start(), { outcome: "done" });
    const running = startItemRun(done, "2", 1, T0);
    expect(
      refused(running, { fromItemId: "2", when: "item", item: "1" }),
    ).toContain("already done");
    // A model may send the number as a number
    expect(save(start(), { when: "item", item: 3 }).reminders?.[0].itemId).toBe(
      "3",
    );
  });

  test("the same note twice is one reminder", () => {
    const again = attempt(save(start(), {}), {});
    if (!again.ok) throw new Error(again.error);
    expect(again.duplicate).toBe(true);
    expect(again.loop.reminders).toHaveLength(1);
    expect(reminderSavedResult(again.reminder, true)).toBe(
      "Already saved as r1.",
    );
  });

  test("refuses past the item's and the loop's caps, saying why", () => {
    let loop = start();
    for (let i = 0; i < LOOP_REMINDER_LIMITS.maxPerItem; i++) {
      loop = save(loop, { note: `note ${i}` });
    }
    expect(refused(loop, { note: "one more" })).toContain(
      `this item has saved ${LOOP_REMINDER_LIMITS.maxPerItem} reminders`,
    );
    let full = start();
    for (let i = 0; i < LOOP_REMINDER_LIMITS.maxPerLoop; i++) {
      full = save(full, { fromItemId: String(i), note: `note ${i}` });
    }
    expect(refused(full, { fromItemId: "99", note: "more" })).toContain(
      `already holds ${LOOP_REMINDER_LIMITS.maxPerLoop} reminders`,
    );
  });

  test("keeps usable, distinct file paths, up to the limit", () => {
    expect(reminderFilePaths("a.ts")).toEqual([]);
    expect(reminderFilePaths([" a.ts ", "a.ts", 3, "", "b.ts"])).toEqual([
      "a.ts",
      "b.ts",
    ]);
    const many = Array.from({ length: 30 }, (_, i) => `f${i}.ts`);
    expect(reminderFilePaths(many)).toHaveLength(LOOP_REMINDER_LIMITS.maxFiles);
  });
});

describe("delivering a reminder", () => {
  test('when "item" reaches that item only', () => {
    const loop = save(start(), { when: "item", item: "3" });
    expect(notes(loop, ITEM_2)).toEqual([]);
    expect(notes(loop, REPLAN)).toEqual([]);
    expect(notes(loop, ITEM_3)).toEqual(["A note"]);
  });

  test('when "next_items" reaches the next other item', () => {
    const loop = save(start(), { when: "next_items" });
    expect(notes(loop, ITEM_1)).toEqual([]);
    expect(notes(loop, ITEM_2)).toEqual(["A note"]);
  });

  test('when "retry" reaches a later run of the same item', () => {
    const loop = save(start(), { when: "retry" });
    expect(notes(loop, ITEM_2)).toEqual([]);
    expect(notes(loop, ITEM_1)).toEqual(["A note"]);
  });

  test('when "replan" reaches the next re-plan only', () => {
    const loop = save(start(), { when: "replan" });
    expect(notes(loop, ITEM_1)).toEqual([]);
    expect(notes(loop, ITEM_2)).toEqual([]);
    expect(notes(loop, REPLAN)).toEqual(["A note"]);
  });

  test("once: the run that gets it marks it delivered", () => {
    const first = take(save(start(), { when: "next_items" }), ITEM_2);
    expect(first.reminders).toHaveLength(1);
    expect(first.loop.reminders?.[0].deliveredAt).toBe(T0.toISOString());
    expect(take(first.loop, ITEM_2).reminders).toEqual([]);
    expect(take(first.loop, ITEM_3).reminders).toEqual([]);
  });

  test("a run with nothing due leaves the loop as it was", () => {
    const loop = start();
    expect(take(loop, ITEM_2).loop).toBe(loop);
  });

  test("survives a reload, delivered or not", () => {
    const loop = save(start(), { when: "next_items" });
    const reloaded = restoreLoop(JSON.parse(JSON.stringify(loop)))!;
    expect(reloaded.reminders).toEqual(loop.reminders);
    expect(notes(reloaded, ITEM_2)).toEqual(["A note"]);
    // Taken once the saving run is over, as the next run's prompt is built
    const delivered = take(
      finishItemRun(loop, { outcome: "done" }),
      ITEM_2,
    ).loop;
    const again = restoreLoop(JSON.parse(JSON.stringify(delivered)))!;
    expect(notes(again, ITEM_2)).toEqual([]);
  });
});

describe("a reminder's files", () => {
  const stamp = reminderFileStamp("export const a = 1;");
  const withFile = () => save(start(), { files: [{ path: "a.ts", stamp }] });

  test("the stamp follows the content, and a missing file has its own", () => {
    expect(reminderFileStamp("same")).toBe(reminderFileStamp("same"));
    expect(reminderFileStamp("same")).not.toBe(reminderFileStamp("sane"));
    expect(reminderFileStamp(undefined)).not.toBe(reminderFileStamp(""));
  });

  test("asks for the paths of what is due", () => {
    expect(reminderPathsDue(withFile(), ITEM_2)).toEqual(["a.ts"]);
    expect(reminderPathsDue(withFile(), ITEM_1)).toEqual([]);
  });

  test("not stale when the file is the same", () => {
    const { reminders } = take(withFile(), ITEM_2, { "a.ts": stamp });
    expect(reminders[0].staleFiles).toEqual([]);
  });

  test("stale when the file changed or went away", () => {
    const changed = take(withFile(), ITEM_2, {
      "a.ts": reminderFileStamp("changed"),
    });
    expect(changed.reminders[0].staleFiles).toEqual(["a.ts"]);
    expect(take(withFile(), ITEM_2, {}).reminders[0].staleFiles).toEqual([
      "a.ts",
    ]);
  });
});

describe("the prompts", () => {
  const base = {
    item: PLAN.items[1],
    answers: [],
    questions: [],
    attempt: 1,
  };

  test("the item prompt names the tool, with either surface's name", () => {
    expect(loopItemPrompt(base)).toContain(
      "If you learn something a later item or a retry will need, save it with remind_me now.",
    );
    expect(
      loopItemPrompt({ ...base, toolNames: LOOP_CLI_TOOL_NAMES }),
    ).toContain("save it with RemindMe now");
  });

  test("the item prompt carries its reminders, and says which are stale", () => {
    const fresh = save(start(), {
      note: "Fresh",
      files: [{ path: "a.ts", stamp: "1" }],
    });
    const loop = save(fresh, {
      note: "Old",
      files: [{ path: "b.ts", stamp: "2" }],
    });
    const { reminders } = take(loop, ITEM_2, { "a.ts": "1", "b.ts": "3" });
    const prompt = loopItemPrompt({ ...base, reminders });
    expect(prompt).toContain("Reminders saved by earlier runs:");
    expect(prompt).toContain("- (from item 1; about a.ts) Fresh");
    expect(prompt).toContain(
      "- (from item 1; written before these files changed, so check first: b.ts) Old",
    );
  });

  test("without reminders there is no section", () => {
    expect(loopItemPrompt(base)).not.toContain("Reminders saved");
  });

  test("the re-plan prompt carries its reminders", () => {
    const loop = save(start(), { when: "replan", note: "Split the parser" });
    const taken = take(loop, REPLAN);
    const prompt = loopReplanPrompt({
      loop: taken.loop,
      plan: PLAN,
      reminders: taken.reminders,
    });
    expect(prompt).toContain("Reminders saved by earlier runs:");
    expect(prompt).toContain("Split the parser");
  });
});
