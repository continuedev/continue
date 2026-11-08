import { describe, expect, test } from "vitest";
import type { LoopState, TaskPlan } from "../index.js";
import {
  answerLoop,
  blockingDependencies,
  createLoop,
  decideNext,
  finishItemRun,
  holdCheck,
  holdQuestion,
  loopCallKey,
  loopGrantKey,
  loopItemPrompt,
  loopPlanBlock,
  recordCheck,
  skipItem,
  startCheck,
  startItemRun,
  taskPlanWithLoop,
  unmetDependencies,
} from "./loopMode.js";
import {
  parsePlanFile,
  serializePlanFile,
  taskPlanForProposal,
  taskPlanFromPlanFile,
  validatePlanArgs,
} from "./planFile.js";
import { buildTaskPlan } from "./taskPlan.js";

/* Loop mode's plan items: `after:` dependencies and `check:` commands (L6). */

const T0 = new Date("2026-11-07T10:00:00Z");
const ctx = { now: T0, sessionTokens: 0 };

function plan(
  ...items: { text: string; after?: string[]; check?: string }[]
): TaskPlan {
  return {
    items: items.map((item, i) => ({
      id: String(i + 1),
      status: "pending" as const,
      ...item,
    })),
    updatedAt: T0.toISOString(),
  };
}

const loopOn = (p: TaskPlan) => createLoop(p, { now: T0, sessionTokens: 0 });

/** Runs item `id` to a report; `check` is its TaskItem.check. */
function run(
  loop: LoopState,
  p: TaskPlan,
  id: string,
  outcome: "done" | "stuck" | "waiting" = "done",
) {
  const check = p.items.find((t) => t.id === id)?.check;
  return finishItemRun(
    startItemRun(loop, id, 0, T0),
    { outcome, summary: `${outcome} ${id}` },
    { check },
  );
}

const status = (loop: LoopState, id: string) =>
  loop.items.find((i) => i.id === id)?.status;

describe("the plan file's after: and check: lines", () => {
  const file = `# Retry

Add retries.

## To-dos

- [ ] Add a retry helper <!-- id: 1 -->
  check: npm test -- retry
- [ ] Use it in fetch <!-- id: 2 -->
  after: 1
  check: npm test -- fetch
- [ ] Document it <!-- id: 3 -->
  after: 1, 2
`;

  test("are read under their to-do, positions becoming ids", () => {
    const read = taskPlanFromPlanFile(file, undefined, T0);
    if (!read.ok) throw new Error(read.error);
    expect(read.plan.items).toEqual([
      expect.objectContaining({ id: "1", check: "npm test -- retry" }),
      expect.objectContaining({
        id: "2",
        after: ["1"],
        check: "npm test -- fetch",
      }),
      expect.objectContaining({ id: "3", after: ["1", "2"] }),
    ]);
    expect(read.plan.items[0].after).toBeUndefined();
  });

  test("are written back as they were read", () => {
    const read = taskPlanFromPlanFile(file, undefined, T0);
    if (!read.ok) throw new Error(read.error);
    const doc = parsePlanFile(file);
    expect(
      serializePlanFile({
        title: doc.title,
        body: doc.body,
        items: read.plan.items,
      }),
    ).toBe(file);
  });

  test("refuse a circle, a reference out of range, and an item after itself", () => {
    const circle = buildTaskPlan(
      [
        { text: "A", after: [2] },
        { text: "B", after: "1" },
      ],
      { reset: true },
    );
    expect(circle).toEqual({
      ok: false,
      error:
        "Items 1, 2 come after each other in a circle; remove one of the after: lines.",
    });
    expect(buildTaskPlan([{ text: "A", after: [3] }], { reset: true })).toEqual(
      { ok: false, error: "Item 1: after: must list item numbers from 1 to 1" },
    );
    expect(
      buildTaskPlan([{ text: "A" }, { text: "B", after: "2" }], {
        reset: true,
      }),
    ).toEqual({ ok: false, error: "Item 2 cannot come after itself" });
  });

  test("come from the plan tool as to-do objects or todo_details", () => {
    const args = validatePlanArgs({
      title: "Retry",
      plan: "Add retries.",
      todos: [
        "Add a retry helper",
        { text: "Use it in fetch", after: [1] },
        "Document it",
      ],
      todo_details: [
        { todo: 1, check: "npm test -- retry" },
        { todo: 3, after: [1, 2] },
      ],
    });
    if (!args.ok) throw new Error(args.error);
    const proposed = taskPlanForProposal(args.items, undefined, T0);
    if (!proposed.ok) throw new Error(proposed.error);
    expect(proposed.plan.items.map((i) => [i.after, i.check])).toEqual([
      [undefined, "npm test -- retry"],
      [["1"], undefined],
      [["1", "2"], undefined],
    ]);
    expect(
      validatePlanArgs({
        title: "T",
        todos: ["A"],
        todo_details: [{ todo: 4 }],
      }),
    ).toEqual({
      ok: false,
      error: "todo_details: todo must be a to-do number from 1 to 1",
    });
  });
});

describe("dependencies", () => {
  const p = plan(
    { text: "Helper" },
    { text: "Use it", after: ["1"] },
    { text: "Docs", after: ["2"] },
  );

  test("an item runs only after what it comes after is done", () => {
    let loop = loopOn(p);
    expect(decideNext(loop, p, ctx)).toEqual({ kind: "run", itemId: "1" });
    loop = run(loop, p, "1");
    expect(decideNext(loop, p, ctx)).toEqual({ kind: "run", itemId: "2" });
    expect(unmetDependencies(loop, p, p.items[2])).toEqual(["2"]);
  });

  test("an item later in the plan can come first when nothing holds it", () => {
    const q = plan({ text: "Use it", after: ["2"] }, { text: "Helper" });
    expect(decideNext(loopOn(q), q, ctx)).toEqual({ kind: "run", itemId: "2" });
  });

  test("a failed or skipped dependency blocks; the loop re-plans instead", () => {
    const failed = run(loopOn(p), p, "1", "stuck");
    expect(blockingDependencies(failed, p, p.items[1])).toEqual(["1"]);
    expect(decideNext(failed, p, ctx)).toEqual({ kind: "replan" });
    const listed = taskPlanWithLoop(p, failed).items[1];
    expect(listed).toMatchObject({ status: "blocked", note: "Blocked on 1" });

    const skipped = skipItem(loopOn(p), "1");
    if (!skipped.ok) throw new Error(skipped.error);
    expect(blockingDependencies(skipped.loop, p, p.items[1])).toEqual(["1"]);
  });

  test("items held only by an item that waits on the person wait too", () => {
    const loop = run(loopOn(p), p, "1", "waiting");
    expect(status(loop, "1")).toBe("waiting");
    expect(decideNext(loop, p, ctx)).toEqual({ kind: "wait" });
  });

  test("the plan block shows what an item comes after", () => {
    const loop = startItemRun(loopOn(p), "1", 0, T0);
    const block = loopPlanBlock({ loop, plan: p });
    expect(block).toContain("[>] 1. Helper  <- this item (attempt 1 of 2)");
    expect(block).toContain("[ ] 2. Use it (after 1)");
    expect(block).toContain("[ ] 3. Docs (after 2)");
  });
});

describe("checks", () => {
  const p = plan(
    { text: "Helper", check: "npm test -- retry" },
    { text: "Docs" },
  );

  test("done with a check waits for it; the harness runs it next", () => {
    const loop = run(loopOn(p), p, "1");
    expect(status(loop, "1")).toBe("checking");
    expect(loop.doneThisRound).toBe(0);
    expect(decideNext(loop, p, ctx)).toEqual({
      kind: "check",
      itemId: "1",
      command: "npm test -- retry",
    });
    expect(taskPlanWithLoop(p, loop).items[0]).toMatchObject({
      status: "in_progress",
      note: "Checking: npm test -- retry",
    });
  });

  test("a passing check makes the item done", () => {
    let loop = startCheck(run(loopOn(p), p, "1"), "1", 0, T0);
    loop = recordCheck(
      loop,
      { status: "passed", command: "npm test -- retry", exitCode: 0 },
      T0,
    );
    expect(status(loop, "1")).toBe("done");
    expect(loop.doneThisRound).toBe(1);
    expect(loop.items[0].check?.status).toBe("passed");
    expect(decideNext(loop, p, ctx)).toEqual({ kind: "run", itemId: "2" });
    expect(loopPlanBlock({ loop, plan: p })).toContain(
      "    check: npm test -- retry (last run: passed, exit 0)",
    );
  });

  test("a failing check sends the item back with its output, then fails it", () => {
    let loop = startCheck(run(loopOn(p), p, "1"), "1", 0, T0);
    loop = recordCheck(
      loop,
      {
        status: "failed",
        command: "npm test -- retry",
        exitCode: 1,
        output: "1 test failed: retries twice",
      },
      T0,
    );
    expect(status(loop, "1")).toBe("pending");
    expect(loop.items[0].summary).toBe(
      "The check failed (exit 1): npm test -- retry",
    );
    const prompt = loopItemPrompt({
      item: p.items[0],
      answers: [],
      questions: [],
      attempt: 2,
      lastCheck: loop.items[0].check,
    });
    expect(prompt).toContain(
      "its check runs: `npm test -- retry`. It must exit 0",
    );
    expect(prompt).toContain(
      "but its check `npm test -- retry` failed (exit 1). Fix what it reports:",
    );
    expect(prompt).toContain("1 test failed: retries twice");

    // The second attempt also fails its check: the item is failed
    loop = startCheck(run(loop, p, "1"), "1", 0, T0);
    loop = recordCheck(
      loop,
      { status: "failed", command: "npm test -- retry", exitCode: 1 },
      T0,
    );
    expect(status(loop, "1")).toBe("failed");
    expect(loop.consecutiveFailures).toBe(1);
  });

  test("a check that needs approval waits on the person; Allow runs it", () => {
    let loop = startCheck(run(loopOn(p), p, "1"), "1", 0, T0);
    const held = holdQuestion(
      loop,
      {
        itemId: "1",
        question: "Allow this call? Bash: npm test -- retry",
        kind: "approval",
        approval: {
          toolName: "Bash",
          summary: "Bash: npm test -- retry",
          grantKey: "k",
        },
      },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    loop = holdCheck(held.loop);
    expect(loop.current).toBeUndefined();
    expect(status(loop, "1")).toBe("checking");
    // Docs can still run; the check waits
    expect(decideNext(loop, p, ctx)).toEqual({ kind: "run", itemId: "2" });
    loop = run(loop, p, "2");
    expect(decideNext(loop, p, ctx)).toEqual({ kind: "wait" });

    const allowed = answerLoop(
      { ...loop, status: "waiting" },
      { questionId: "q1", text: "", approve: true },
      T0,
    );
    if (!allowed.ok) throw new Error(allowed.error);
    expect(allowed.loop.status).toBe("running");
    expect(allowed.loop.grants).toContain("k");
    expect(decideNext(allowed.loop, p, ctx)).toMatchObject({ kind: "check" });
  });

  test("not allowing the check leaves the item done without it", () => {
    let loop = startCheck(run(loopOn(p), p, "1"), "1", 0, T0);
    const held = holdQuestion(
      loop,
      {
        itemId: "1",
        question: "Allow this call? Bash: npm test",
        kind: "approval",
        approval: {
          toolName: "Bash",
          summary: "Bash: npm test",
          grantKey: "k",
        },
      },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    loop = holdCheck(held.loop);
    const refused = answerLoop(
      loop,
      { questionId: "q1", text: "", approve: false },
      T0,
    );
    if (!refused.ok) throw new Error(refused.error);
    expect(status(refused.loop, "1")).toBe("done");
    expect(refused.loop.items[0].check?.status).toBe("refused");
  });

  test("an item cannot be skipped while its check runs", () => {
    const loop = startCheck(run(loopOn(p), p, "1"), "1", 0, T0);
    const skipped = skipItem(loop, "1");
    expect(skipped).toEqual({
      ok: false,
      error: "1's check is running: use Stop now, or wait for it",
    });
    // Waiting for the person's approval, it can be
    expect(skipItem(holdCheck(loop), "1").ok).toBe(true);
  });

  test("an item whose check was removed from the plan counts as done", () => {
    const loop = run(loopOn(p), p, "1");
    const edited = plan({ text: "Helper" }, { text: "Docs" });
    expect(decideNext(loop, edited, ctx)).toEqual({
      kind: "run",
      itemId: "2",
    });
  });
});

describe("found by the real-model run (2026-11-07)", () => {
  test("items that all come after one waiting item wait, however many share it", () => {
    const p = plan(
      { text: "Helper" },
      { text: "Tests A", after: ["1"] },
      { text: "Tests B", after: ["1"] },
      { text: "Docs", after: ["1"] },
      { text: "Suite", after: ["2", "3", "4"] },
    );
    const loop = run(loopOn(p), p, "1", "waiting");
    expect(decideNext(loop, p, ctx)).toEqual({ kind: "wait" });
  });

  test("waiting on a question the person answered during the run runs the item again", () => {
    const p = plan({ text: "Helper" });
    let loop = startItemRun(loopOn(p), "1", 0, T0);
    const held = holdQuestion(
      loop,
      {
        itemId: "1",
        question: "Allow this call? Write: src/a.ts",
        kind: "approval",
        approval: {
          toolName: "Write",
          summary: "Write: src/a.ts",
          grantKey: "k",
        },
      },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    const answered = answerLoop(
      held.loop,
      { questionId: "q1", text: "", approve: true },
      T0,
    );
    if (!answered.ok) throw new Error(answered.error);
    expect(answered.answer.route).toBe("steer");
    loop = finishItemRun(answered.loop, { outcome: "waiting" });
    expect(status(loop, "1")).toBe("pending");
    expect(decideNext(loop, p, ctx)).toEqual({ kind: "run", itemId: "1" });
  });

  test("a grant covers the file or command the question names, not the exact arguments", () => {
    // A relative path and its absolute form, with either slash, are one file
    const resolve = (p: string) => (p.startsWith("D:") ? p : `D:/repo/${p}`);
    expect(
      loopGrantKey("Write", { filepath: "src/a.ts", content: "one" }, resolve),
    ).toBe(
      loopGrantKey(
        "Write",
        { filepath: String.raw`D:\repo\src\a.ts`, content: "two" },
        resolve,
      ),
    );
    expect(loopGrantKey("Bash", { command: " npm test ", timeout: 5 })).toBe(
      loopGrantKey("Bash", { command: "npm test" }),
    );
    expect(loopGrantKey("Write", { filepath: "a.ts" })).not.toBe(
      loopGrantKey("Edit", { filepath: "a.ts" }),
    );
    expect(loopGrantKey("Fetch", { url: "x" })).toBe(
      loopCallKey("Fetch", { url: "x" }),
    );
  });
});
