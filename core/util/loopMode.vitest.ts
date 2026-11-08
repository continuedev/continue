import { describe, expect, test } from "vitest";
import type {
  LoopAutonomy,
  LoopBudget,
  LoopState,
  LoopStrategy,
  TaskPlan,
} from "../index.js";
import {
  type FinishOutcome,
  acceptReplan,
  answerLoop,
  answersToDeliver,
  consumeLoopGrant,
  createLoop,
  describeLoopBudget,
  describeLoopReplan,
  enterWait,
  loopGrantKey,
  releaseEmptyWait,
  loopTokensFromUsage,
  describeHeldCall,
  itemTurnState,
  itemTurnLimitReport,
  LOOP_AUTONOMY,
  type LoopControlResult,
  loopReplanSetting,
  maxRoundsForReplan,
  runItemAgain,
  setLoopBudget,
  skipItem,
  loopAutonomyFor,
  proceedUnanswered,
  replanDecision,
  setLoopAutonomy,
  decideNext,
  defaultLoopStrategy,
  endReplan,
  LOOP_STRATEGIES,
  LOOP_STRATEGY_ORDER,
  loopItemRepairPrompt,
  loopReplanTurnPrompt,
  loopStrategy,
  repairDecision,
  setLoopStrategy,
  approvalHeldResult,
  finishItemReport,
  finishItemRun,
  formatLoopStatus,
  holdQuestionResult,
  LOOP_CLI_TOOL_NAMES,
  loopCallKey,
  loopPlanBlock,
  loopRunKey,
  loopRunPlanBlock,
  repeatedCallResult,
  replanHoldResult,
  REPLAN_HOLD_RESULT,
  holdQuestion,
  loopItemPrompt,
  loopReplanPrompt,
  markDelivered,
  nextRunnableItem,
  planAddsScope,
  reconcileLoop,
  restoreLoop,
  settleSteeredAnswers,
  standingInstructions,
  requestStop,
  resumeLoop,
  startItemRun,
  startReplan,
  stopLoop,
  taskPlanWithLoop,
  withLoopPlanBlock,
} from "./loopMode.js";

const T0 = new Date("2026-11-07T10:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const ctx = (minutes = 0, sessionTokens = 0) => ({
  now: at(minutes),
  sessionTokens,
});

function plan(...texts: string[]): TaskPlan {
  return {
    items: texts.map((text, i) => ({
      id: String(i + 1),
      text,
      status: "pending" as const,
    })),
    updatedAt: T0.toISOString(),
  };
}

const PLAN = plan("Write the parser", "Add tests", "Update the docs");

function loopOn(p = PLAN, budget = {}): LoopState {
  return createLoop(p, { now: T0, sessionTokens: 0, budget });
}

/** Runs an item to a report, from decide to finish. */
function runItem(
  loop: LoopState,
  itemId: string,
  report?: { outcome: FinishOutcome; summary?: string },
) {
  return finishItemRun(startItemRun(loop, itemId, 0, T0), report);
}

const status = (loop: LoopState, id: string) =>
  loop.items.find((i) => i.id === id)?.status;

describe("next item", () => {
  test("the first open item in plan order runs first", () => {
    const loop = loopOn();
    expect(decideNext(loop, PLAN, ctx())).toEqual({ kind: "run", itemId: "1" });
  });

  test("done, waiting, running and failed items are skipped; redo is picked", () => {
    let loop = runItem(loopOn(), "1", { outcome: "done" });
    expect(nextRunnableItem(loop, PLAN)?.id).toBe("2");
    loop = runItem(loop, "2", { outcome: "waiting" });
    expect(nextRunnableItem(loop, PLAN)?.id).toBe("3");
    loop = runItem(loop, "3", { outcome: "stuck", summary: "no docs dir" });
    expect(nextRunnableItem(loop, PLAN)).toBeUndefined();

    const q = holdQuestion(
      loop,
      {
        itemId: "1",
        question: "Tabs?",
        kind: "assumption",
        assumption: "spaces",
      },
      T0,
    );
    if (!q.ok) throw new Error(q.error);
    const a = answerLoop(
      q.loop,
      { questionId: q.question.id, text: "tabs" },
      T0,
    );
    if (!a.ok) throw new Error(a.error);
    expect(status(a.loop, "1")).toBe("redo");
    expect(nextRunnableItem(a.loop, PLAN)?.id).toBe("1");
  });

  test("nothing is decided while an item runs", () => {
    const loop = startItemRun(loopOn(), "1", 4, T0);
    expect(decideNext(loop, PLAN, ctx())).toEqual({ kind: "none" });
    expect(loop.current).toMatchObject({
      kind: "item",
      itemId: "1",
      historyIndex: 4,
    });
    expect(status(loop, "1")).toBe("running");
  });

  test("the person's edits to the list join the loop", () => {
    const edited: TaskPlan = {
      ...PLAN,
      items: [
        { ...PLAN.items[0], status: "completed" },
        PLAN.items[2],
        { id: "9", text: "Release", status: "pending" },
      ],
    };
    const loop = reconcileLoop(loopOn(), edited);
    expect(loop.items.map((i) => [i.id, i.status])).toEqual([
      ["1", "done"],
      ["3", "pending"],
      ["9", "pending"],
    ]);
    expect(nextRunnableItem(loop, edited)?.id).toBe("3");
  });

  test("a run that ends without finish_item runs again, then fails", () => {
    let loop = runItem(loopOn(), "1", undefined);
    expect(status(loop, "1")).toBe("pending");
    loop = runItem(loop, "1", undefined);
    expect(status(loop, "1")).toBe("failed");
  });
});

describe("questions", () => {
  test("a blocking question parks the item while the others go on", () => {
    let loop = startItemRun(loopOn(), "1", 0, T0);
    const held = holdQuestion(
      loop,
      { itemId: "1", question: "Which grammar version?", kind: "blocking" },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    // The model reported done-ish nothing; the open blocking question parks it.
    loop = finishItemRun(held.loop, { outcome: "stuck" });
    expect(status(loop, "1")).toBe("waiting");
    expect(decideNext(loop, PLAN, ctx())).toEqual({ kind: "run", itemId: "2" });
    expect(taskPlanWithLoop(PLAN, loop).items[0]).toMatchObject({
      status: "blocked",
      note: "Waiting on you: q1",
    });
  });

  test("an assumption question lets the item finish with its default", () => {
    let loop = startItemRun(loopOn(), "1", 0, T0);
    const held = holdQuestion(
      loop,
      {
        itemId: "1",
        question: "Name the module parser.ts or grammar.ts?",
        kind: "assumption",
        assumption: "parser.ts",
      },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    loop = finishItemRun(held.loop, { outcome: "done", summary: "parser.ts" });
    expect(status(loop, "1")).toBe("done");
    expect(loop.questions[0]).toMatchObject({
      kind: "assumption",
      assumption: "parser.ts",
    });
    expect(loop.questions[0].answerId).toBeUndefined();
  });

  test("an assumption needs its default; the kind must be known", () => {
    const loop = loopOn();
    const noDefault = holdQuestion(
      loop,
      { itemId: "1", question: "Tabs?", kind: "assumption" },
      T0,
    );
    expect(noDefault.ok).toBe(false);
    const badKind = holdQuestion(
      loop,
      { itemId: "1", question: "Tabs?", kind: "maybe" },
      T0,
    );
    expect(badKind.ok).toBe(false);
  });

  test("asking the same open question again does not add a second one", () => {
    const input = { itemId: "1", question: "Tabs?", kind: "blocking" };
    const first = holdQuestion(loopOn(), input, T0);
    if (!first.ok) throw new Error(first.error);
    const again = holdQuestion(first.loop, input, T0);
    expect(again).toMatchObject({ ok: true, duplicate: true });
    if (again.ok) expect(again.loop.questions).toHaveLength(1);
  });

  test("one item cannot flood the inbox", () => {
    let loop = loopOn();
    for (let i = 0; i < 4; i++) {
      const r = holdQuestion(
        loop,
        { itemId: "1", question: `Q${i}?`, kind: "blocking" },
        T0,
      );
      if (!r.ok) throw new Error(r.error);
      loop = r.loop;
    }
    const fifth = holdQuestion(
      loop,
      { itemId: "1", question: "Q5?", kind: "blocking" },
      T0,
    );
    expect(fifth.ok).toBe(false);
  });
});

describe("answer routing", () => {
  function withQuestion(
    loop: LoopState,
    itemId: string,
    kind: "blocking" | "assumption" = "blocking",
  ) {
    const r = holdQuestion(
      loop,
      {
        itemId,
        question: `About item ${itemId}?`,
        kind,
        ...(kind === "assumption" ? { assumption: "the default" } : {}),
      },
      T0,
    );
    if (!r.ok) throw new Error(r.error);
    return { loop: r.loop, questionId: r.question.id };
  }

  test("waiting: the item is queued again with the answer", () => {
    const running = startItemRun(loopOn(), "1", 0, T0);
    const { loop: held, questionId } = withQuestion(running, "1");
    const waiting = finishItemRun(held, { outcome: "waiting" });
    const r = answerLoop(waiting, { questionId, text: "Use v2" }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.route).toBe("requeue");
    expect(status(r.loop, "1")).toBe("pending");
    expect(decideNext(r.loop, PLAN, ctx())).toEqual({
      kind: "run",
      itemId: "1",
    });
    expect(answersToDeliver(r.loop, "1").map((a) => a.text)).toEqual([
      "Use v2",
    ]);
  });

  test("running: the answer is steered in", () => {
    const running = startItemRun(loopOn(), "2", 0, T0);
    const { loop, questionId } = withQuestion(running, "2", "assumption");
    const r = answerLoop(loop, { questionId, text: "No, use vitest" }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.route).toBe("steer");
    expect(status(r.loop, "2")).toBe("running");
  });

  test("done on an overruled assumption: reopened as redo", () => {
    const running = startItemRun(loopOn(), "1", 0, T0);
    const { loop: held, questionId } = withQuestion(running, "1", "assumption");
    const done = finishItemRun(held, { outcome: "done" });
    const r = answerLoop(done, { questionId, text: "Call it grammar.ts" }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.route).toBe("redo");
    expect(status(r.loop, "1")).toBe("redo");
    const prompt = loopItemPrompt({
      item: PLAN.items[0],
      answers: answersToDeliver(r.loop, "1"),
      questions: r.loop.questions,
      redo: true,
      attempt: 1,
    });
    expect(prompt).toContain("overruled");
    expect(prompt).toContain("Call it grammar.ts");
  });

  test("done on a confirmed assumption: nothing changes", () => {
    const running = startItemRun(loopOn(), "1", 0, T0);
    const { loop: held, questionId } = withQuestion(running, "1", "assumption");
    const done = finishItemRun(held, { outcome: "done" });
    const r = answerLoop(done, { questionId, text: "", confirm: true }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.route).toBe("confirmed");
    expect(status(r.loop, "1")).toBe("done");
    expect(r.answer.text).toContain("the default");
  });

  test("about the plan: waits for the re-plan unless re-plan now", () => {
    const r = answerLoop(loopOn(), { text: "Skip the docs item" }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.route).toBe("replan");
    expect(decideNext(r.loop, PLAN, ctx())).toEqual({
      kind: "run",
      itemId: "1",
    });

    const now = answerLoop(
      r.loop,
      { text: "Stop and re-plan", replanNow: true },
      T0,
    );
    if (!now.ok) throw new Error(now.error);
    expect(decideNext(now.loop, PLAN, ctx())).toEqual({ kind: "replan" });
    const replanning = startReplan(now.loop, 0, T0);
    expect(replanning.answers.every((a) => a.delivered)).toBe(true);
    expect(replanning.replanRequested).toBe(false);
  });

  test("several answers at once each take their own route", () => {
    let loop = startItemRun(loopOn(), "1", 0, T0);
    const q1 = withQuestion(loop, "1", "assumption");
    loop = finishItemRun(q1.loop, { outcome: "done" });
    loop = startItemRun(loop, "2", 0, T0);
    const q2 = withQuestion(loop, "2", "blocking");
    loop = finishItemRun(q2.loop, { outcome: "waiting" });

    const answers = [
      { questionId: q1.questionId, text: "Overruled" },
      { questionId: q2.questionId, text: "Answer" },
      { text: "Plan-wide note" },
    ];
    const routes: string[] = [];
    for (const input of answers) {
      const r = answerLoop(loop, input, T0);
      if (!r.ok) throw new Error(r.error);
      loop = r.loop;
      routes.push(r.answer.route);
    }
    expect(routes).toEqual(["redo", "requeue", "replan"]);
    expect(
      answerLoop(loop, { questionId: q1.questionId, text: "x" }, T0).ok,
    ).toBe(false);
  });

  test("a steered answer that arrived after the run ended goes with the next run", () => {
    let loop = startItemRun(loopOn(), "1", 0, T0);
    loop = startItemRun(loop, "1", 0, T0);
    const late = answerLoop(loop, { itemId: "1", text: "Use tabs" }, T0);
    const onTime =
      late.ok &&
      answerLoop(late.loop, { itemId: "1", text: "And a README" }, T0);
    if (!late.ok || !onTime || !onTime.ok) throw new Error("answer failed");
    expect([late.answer.route, onTime.answer.route]).toEqual([
      "steer",
      "steer",
    ]);

    // The run finished; only the second answer reached it at a tool boundary
    loop = finishItemRun(onTime.loop, { outcome: "done" });
    loop = settleSteeredAnswers(loop, [onTime.answer.id]);
    expect(status(loop, "1")).toBe("redo");
    expect(answersToDeliver(loop, "1").map((a) => a.text)).toEqual([
      "Use tabs",
    ]);
  });

  test("an approval answer grants the exact call once", () => {
    let loop = startItemRun(loopOn(), "1", 0, T0);
    const held = holdQuestion(
      loop,
      {
        itemId: "1",
        question: "Run `npm publish`?",
        kind: "approval",
        approval: {
          toolName: "run_terminal_command",
          summary: "npm publish",
          grantKey: "k1",
        },
      },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    loop = finishItemRun(held.loop, undefined);
    expect(status(loop, "1")).toBe("waiting");
    const r = answerLoop(
      loop,
      { questionId: held.question.id, text: "", approve: true },
      T0,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.route).toBe("requeue");
    const first = consumeLoopGrant(r.loop, "k1");
    expect(first.granted).toBe(true);
    expect(consumeLoopGrant(first.loop, "k1").granted).toBe(false);
  });

  test("delivered answers are not sent twice", () => {
    const r = answerLoop(loopOn(), { itemId: "2", text: "Use vitest" }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.route).toBe("next-run");
    const ids = answersToDeliver(r.loop, "2").map((a) => a.id);
    expect(answersToDeliver(markDelivered(r.loop, ids), "2")).toEqual([]);
  });
});

describe("re-evaluation", () => {
  test("re-plans when no item can run and some are not done", () => {
    let loop = runItem(loopOn(), "1", { outcome: "done" });
    loop = runItem(loop, "2", { outcome: "stuck", summary: "no runner" });
    loop = runItem(loop, "3", { outcome: "done" });
    expect(decideNext(loop, PLAN, ctx())).toEqual({ kind: "replan" });
    const prompt = loopReplanPrompt({
      loop,
      plan: PLAN,
      planFile: ".continuous/plans/p.md",
    });
    expect(prompt).toContain("[!] Add tests (failed: no runner)");
    expect(prompt).toContain("present_plan");
  });

  test("an accepted re-plan keeps finished work and starts a round", () => {
    let loop = runItem(loopOn(), "1", { outcome: "done" });
    loop = runItem(loop, "2", { outcome: "stuck" });
    loop = runItem(loop, "3", { outcome: "done" });
    const next: TaskPlan = {
      ...PLAN,
      items: [
        PLAN.items[0],
        { id: "4", text: "Add a test runner", status: "pending" },
        PLAN.items[1],
        PLAN.items[2],
      ],
    };
    const before = PLAN.items.map((i) => i.text);
    expect(planAddsScope(before, next)).toBe(true);
    expect(planAddsScope(before, plan("Write the parser", "Add tests"))).toBe(
      false,
    );
    loop = acceptReplan(startReplan(loop, 0, T0), next, ctx());
    expect(loop.round).toBe(2);
    expect(loop.items.map((i) => [i.id, i.status])).toEqual([
      ["1", "done"],
      ["4", "pending"],
      ["2", "pending"],
      ["3", "done"],
    ]);
    expect(decideNext(loop, next, ctx())).toEqual({ kind: "run", itemId: "4" });
  });

  test("waits instead of re-planning when every open item waits on the person", () => {
    let loop = runItem(loopOn(plan("A", "B")), "1", { outcome: "done" });
    loop = runItem(loop, "2", { outcome: "waiting" });
    expect(decideNext(loop, plan("A", "B"), ctx())).toEqual({ kind: "wait" });
  });

  test("a plan-wide answer after the last item still gets a re-plan", () => {
    let loop = runItem(loopOn(plan("A")), "1", { outcome: "done" });
    const r = answerLoop(loop, { text: "Also do B" }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(decideNext(r.loop, plan("A"), ctx())).toEqual({ kind: "replan" });
  });
});

describe("stop conditions", () => {
  test("done when every item is done", () => {
    let loop = loopOn(plan("A", "B"));
    loop = runItem(loop, "1", { outcome: "done" });
    loop = runItem(loop, "2", { outcome: "done" });
    expect(decideNext(loop, plan("A", "B"), ctx())).toMatchObject({
      kind: "stop",
      reason: "done",
    });
  });

  test("rounds", () => {
    let loop = loopOn(plan("A"), { maxRounds: 1 });
    loop = runItem(loop, "1", { outcome: "stuck" });
    expect(decideNext(loop, plan("A"), ctx())).toMatchObject({
      kind: "stop",
      reason: "rounds",
    });
  });

  test("tokens, counting only the loop's own", () => {
    const loop = createLoop(PLAN, {
      now: T0,
      sessionTokens: 5000,
      budget: { maxTokens: 1000 },
    });
    expect(decideNext(loop, PLAN, ctx(0, 5900)).kind).toBe("run");
    expect(decideNext(loop, PLAN, ctx(0, 6000))).toMatchObject({
      kind: "stop",
      reason: "tokens",
    });
  });

  test("wall time", () => {
    const loop = loopOn(PLAN, { maxWallMs: 30 * 60_000 });
    expect(decideNext(loop, PLAN, ctx(29)).kind).toBe("run");
    expect(decideNext(loop, PLAN, ctx(30))).toMatchObject({
      kind: "stop",
      reason: "time",
    });
  });

  test("no progress: a round that finishes nothing after one that did not either", () => {
    let loop = loopOn(plan("A"), { maxNoProgressRounds: 2 });
    loop = runItem(loop, "1", { outcome: "stuck" });
    expect(decideNext(loop, plan("A"), ctx()).kind).toBe("replan");
    loop = acceptReplan(startReplan(loop, 0, T0), plan("A"), ctx());
    expect(loop.noProgressRounds).toBe(1);
    loop = runItem(loop, "1", { outcome: "stuck" });
    expect(decideNext(loop, plan("A"), ctx())).toMatchObject({
      kind: "stop",
      reason: "no_progress",
    });
  });

  test("everything waiting on the person pauses, and an answer resumes", () => {
    let loop = startItemRun(loopOn(plan("A")), "1", 0, T0);
    const held = holdQuestion(
      loop,
      { itemId: "1", question: "Which?", kind: "blocking" },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    loop = finishItemRun(held.loop, undefined);
    expect(decideNext(loop, plan("A"), ctx())).toEqual({ kind: "wait" });
    loop = { ...loop, status: "waiting" };
    const r = answerLoop(
      loop,
      { questionId: held.question.id, text: "This one" },
      T0,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.loop.status).toBe("running");
    expect(decideNext(r.loop, plan("A"), ctx())).toEqual({
      kind: "run",
      itemId: "1",
    });
  });

  test("Stop loop waits for the running item, then stops", () => {
    let loop = requestStop(startItemRun(loopOn(), "1", 0, T0));
    expect(loop.status).toBe("running");
    loop = finishItemRun(loop, { outcome: "done" });
    expect(decideNext(loop, PLAN, ctx())).toMatchObject({
      kind: "stop",
      reason: "stopped",
    });
    expect(requestStop(loopOn()).status).toBe("stopped");
  });

  test("Stop puts the running item back and resume restarts the budgets", () => {
    let loop = startItemRun(loopOn(), "2", 0, T0);
    loop = stopLoop(loop, "stopped", "You stopped the loop.");
    expect(status(loop, "2")).toBe("pending");
    expect(decideNext(loop, PLAN, ctx())).toEqual({ kind: "none" });
    loop = resumeLoop(loop, ctx(500, 99));
    expect(loop.tokensAtStart).toBe(99);
    expect(decideNext(loop, PLAN, ctx(500, 99))).toEqual({
      kind: "run",
      itemId: "1",
    });
  });
});

describe("persistence", () => {
  test("a saved loop restores as it was", () => {
    let loop = runItem(loopOn(), "1", { outcome: "done", summary: "ok" });
    const r = answerLoop(loop, { text: "plan note" }, T0);
    if (!r.ok) throw new Error(r.error);
    loop = r.loop;
    const restored = restoreLoop(JSON.parse(JSON.stringify(loop)));
    expect(restored).toEqual(loop);
  });

  test("a loop saved mid-run restores stopped, with the item pending", () => {
    const loop = startItemRun(loopOn(), "1", 0, T0);
    const restored = restoreLoop(JSON.parse(JSON.stringify(loop)))!;
    expect(restored.status).toBe("stopped");
    expect(restored.current).toBeUndefined();
    expect(status(restored, "1")).toBe("pending");
  });

  test("anything else is not a loop", () => {
    expect(restoreLoop(undefined)).toBeUndefined();
    expect(restoreLoop({ status: "running" })).toBeUndefined();
  });
});

describe("the item prompt", () => {
  const prompt = loopItemPrompt({
    item: PLAN.items[1],
    planFile: ".continuous/plans/parser.md",
    answers: [],
    questions: [],
    attempt: 1,
  });

  test("is about the one item and points at the plan", () => {
    expect(prompt).toContain("only this item: Add tests");
    expect(prompt).toContain(".continuous/plans/parser.md");
    expect(prompt).toContain("finish_item");
    // It never asks the model to pick what comes next or explains the loop
    expect(prompt).not.toMatch(/next item|choose.*item|loop/i);
  });

  test("encourages holding questions, assumption first, self-contained", () => {
    expect(prompt).toContain("hold_question");
    expect(prompt).toMatch(/rather than deciding silently/);
    expect(prompt).toMatch(
      /your default in `assumption` with kind "assumption"/,
    );
    expect(prompt).toMatch(/type of the question/);
    // The finish rule is stated in both directions for small models
    expect(prompt).toMatch(/End this turn only by calling finish_item/);
    expect(prompt).toMatch(
      /"blocking" only when there is no reasonable default/,
    );
    expect(prompt).toMatch(/answered without this conversation/);
  });
});

test("the status line", () => {
  let loop = runItem(loopOn(), "1", { outcome: "done" });
  loop = runItem(loop, "2", { outcome: "waiting" });
  expect(formatLoopStatus(loop)).toBe(
    "Auto · Round 1 · 1/3 done · 1 waiting on you",
  );
});

describe("ideas from the Ralph loop", () => {
  test("notes from a run go with every later item, newest last and capped", () => {
    let loop = runItem(loopOn(), "1", {
      outcome: "done",
      notes: "Tests run with\n  `npx vitest run`",
    } as any);
    expect(loop.notes).toEqual(["Tests run with `npx vitest run`"]);
    for (let i = 0; i < 20; i++) {
      loop = runItem(loop, "2", { outcome: "stuck", notes: `n${i}` } as any);
      loop = {
        ...loop,
        items: loop.items.map((it) =>
          it.id === "2" ? { ...it, status: "pending", attempts: 0 } : it,
        ),
      };
    }
    expect(loop.notes).toHaveLength(12);
    expect(loop.notes?.at(-1)).toBe("n19");
    const long = runItem(loopOn(), "1", {
      outcome: "done",
      notes: "x".repeat(900),
    } as any);
    expect(long.notes?.[0]).toHaveLength(300);

    const prompt = loopItemPrompt({
      item: PLAN.items[1],
      answers: [],
      questions: [],
      attempt: 1,
      notes: ["Tests run with `npx vitest run`"],
    });
    expect(prompt).toContain(
      "Notes from earlier items:\n- Tests run with `npx vitest run`",
    );
    expect(loopReplanPrompt({ loop, plan: PLAN })).toContain(
      "Notes from the runs:",
    );
  });

  test("a standing instruction goes with every item and does not wait for a re-plan", () => {
    const r = answerLoop(
      loopOn(),
      { text: "Never edit generated files", standing: true },
      T0,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.route).toBe("standing");
    expect(standingInstructions(r.loop)).toEqual([
      "Never edit generated files",
    ]);
    // It is not a plan note: no re-plan is owed for it
    let loop = runItem(r.loop, "1", { outcome: "done" });
    loop = runItem(loop, "2", { outcome: "done" });
    loop = runItem(loop, "3", { outcome: "done" });
    expect(decideNext(loop, PLAN, ctx())).toMatchObject({
      kind: "stop",
      reason: "done",
    });
    const prompt = loopItemPrompt({
      item: PLAN.items[0],
      answers: answersToDeliver(loop, "1"),
      questions: [],
      attempt: 1,
      standing: standingInstructions(loop),
    });
    expect(prompt).toContain(
      "instructions for every item:\n- Never edit generated files",
    );
  });

  test("a standing instruction does not resume a loop waiting on an answer", () => {
    const waiting = { ...loopOn(), status: "waiting" as const };
    const r = answerLoop(waiting, { text: "Use tabs", standing: true }, T0);
    expect(r.ok && r.loop.status).toBe("waiting");
  });

  test("the contract asks to search first, finish fully and run the checks", () => {
    const prompt = loopItemPrompt({
      item: PLAN.items[0],
      answers: [],
      questions: [],
      attempt: 1,
      planFile: "p.md",
      freshContext: true,
    });
    expect(prompt).toMatch(/Search the code before you add anything/);
    expect(prompt).toMatch(/no placeholders or stubs/);
    expect(prompt).toMatch(/run the checks the project has/);
    expect(prompt).toMatch(
      /their work is in the files, not in this conversation/,
    );
    expect(prompt).toMatch(/in `notes`/);
  });

  test("a loop runs each item in a fresh context unless told otherwise", () => {
    expect(loopOn().freshContext).toBe(true);
    expect(
      createLoop(PLAN, { now: T0, sessionTokens: 0, freshContext: false })
        .freshContext,
    ).toBe(false);
  });

  test("the re-plan treats the plan as possibly wrong", () => {
    expect(loopReplanPrompt({ loop: loopOn(), plan: PLAN })).toMatch(
      /The plan may be wrong/,
    );
  });
});

describe("autonomy levels", () => {
  test("the level follows the approval mode", () => {
    expect(loopAutonomyFor("manual")).toBe("supervised");
    expect(loopAutonomyFor(undefined)).toBe("supervised");
    expect(loopAutonomyFor("autoApprove")).toBe("auto");
    expect(loopAutonomyFor("auto")).toBe("auto");
    expect(loopAutonomyFor("yolo")).toBe("unattended");
  });

  test("each level brings its budgets, and changing level changes them", () => {
    const loop = createLoop(PLAN, {
      now: T0,
      sessionTokens: 0,
      autonomy: "unattended",
    });
    expect(loop.budget.maxRounds).toBe(10);
    expect(
      createLoop(PLAN, { now: T0, sessionTokens: 0, autonomy: "supervised" })
        .budget.maxWallMs,
    ).toBe(60 * 60_000);
    // A budget given explicitly wins over the level's
    expect(
      createLoop(PLAN, {
        now: T0,
        sessionTokens: 0,
        autonomy: "unattended",
        budget: { maxRounds: 2 },
      }).budget.maxRounds,
    ).toBe(2);
    const changed = setLoopAutonomy(loop, "supervised");
    expect(changed.autonomy).toBe("supervised");
    expect(changed.budget).toEqual(LOOP_AUTONOMY.supervised.budget);
  });

  test("which re-plans go on by themselves", () => {
    const before = PLAN.items.map((i) => i.text);
    const same = plan("Write the parser", "Add tests");
    const twoNew = plan(
      "Write the parser",
      "Install vitest",
      "Add a runner",
      "Add tests",
    );
    const sixNew = plan("a", "b", "c", "d", "e", "f");
    const at = (autonomy: any) =>
      createLoop(PLAN, { now: T0, sessionTokens: 0, autonomy });
    expect(replanDecision(at("supervised"), before, same).accept).toBe(false);
    expect(replanDecision(at("auto"), before, same).accept).toBe(true);
    expect(replanDecision(at("auto"), before, twoNew)).toMatchObject({
      accept: false,
      reason: "The re-plan adds 2 new to-dos.",
    });
    expect(replanDecision(at("unattended"), before, twoNew).accept).toBe(true);
    expect(replanDecision(at("unattended"), before, sixNew).accept).toBe(false);
  });

  test("three failed items in a row stop the loop, at every level; one done resets the count", () => {
    const five = plan("A", "B", "C", "D", "E");
    for (const autonomy of ["supervised", "auto", "unattended"] as const) {
      let loop = createLoop(five, { now: T0, sessionTokens: 0, autonomy });
      loop = runItem(loop, "1", { outcome: "stuck" });
      loop = runItem(loop, "2", { outcome: "stuck" });
      loop = runItem(loop, "3", { outcome: "done" });
      expect(loop.consecutiveFailures).toBe(0);
      loop = runItem(loop, "4", { outcome: "stuck" });
      loop = runItem(loop, "5", { outcome: "stuck" });
      expect(decideNext(loop, five, ctx()).kind).not.toBe("stop");
      // Item 1 failed before; one more failed run makes three in a row
      loop = runItem(loop, "1", undefined);
      expect(loop.consecutiveFailures).toBe(3);
      expect(decideNext(loop, five, ctx())).toMatchObject({
        kind: "stop",
        reason: "failures",
      });
    }
  });

  test("unattended: when everything waits, the items go on after the timeout without confirming anything", () => {
    let loop = createLoop(plan("A", "B"), {
      now: T0,
      sessionTokens: 0,
      autonomy: "unattended",
    });
    loop = runItem(loop, "1", { outcome: "done" });
    loop = startItemRun(loop, "2", 0, T0);
    const held = holdQuestion(
      loop,
      { itemId: "2", question: "Which DB?", kind: "blocking" },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    loop = finishItemRun(held.loop, { outcome: "waiting" });

    const waiting = decideNext(loop, plan("A", "B"), ctx(0));
    expect(waiting).toEqual({ kind: "wait", until: at(15).toISOString() });
    loop = enterWait(loop, at(0));
    expect(enterWait(loop, at(5)).waitingSince).toBe(at(0).toISOString());
    expect(decideNext(loop, plan("A", "B"), ctx(14)).kind).toBe("wait");
    expect(decideNext(loop, plan("A", "B"), ctx(15))).toEqual({
      kind: "proceed",
    });

    loop = proceedUnanswered(loop);
    expect(loop.status).toBe("running");
    expect(loop.items[1]).toMatchObject({
      status: "pending",
      unanswered: ["q1"],
    });
    expect(loop.questions[0].answerId).toBeUndefined();
    const prompt = loopItemPrompt({
      item: { id: "2", text: "B", status: "pending" },
      answers: [],
      questions: loop.questions,
      attempt: 1,
      unanswered: loop.questions,
    });
    expect(prompt).toContain("Nobody answered these questions in time");
    expect(prompt).toContain("- Which DB?");
    expect(prompt).toMatch(/cannot be undone/);

    // The item finishes on its default; the person answers later: it is redone
    loop = runItem(loop, "2", { outcome: "done" });
    expect(loop.items[1].unanswered).toBeUndefined();
    const late = answerLoop(loop, { questionId: "q1", text: "Postgres" }, T0);
    expect(late.ok && late.answer.route).toBe("redo");
  });

  test("supervised and auto wait for as long as it takes", () => {
    for (const autonomy of ["supervised", "auto"] as const) {
      let loop = createLoop(plan("A"), { now: T0, sessionTokens: 0, autonomy });
      loop = enterWait(runItem(loop, "1", { outcome: "waiting" }), at(0));
      expect(decideNext(loop, plan("A"), ctx(50))).toEqual({ kind: "wait" });
    }
  });

  test("an answer ends the wait", () => {
    let loop = createLoop(plan("A"), {
      now: T0,
      sessionTokens: 0,
      autonomy: "unattended",
    });
    loop = startItemRun(loop, "1", 0, T0);
    const held = holdQuestion(
      loop,
      { itemId: "1", question: "Which?", kind: "blocking" },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    loop = enterWait(finishItemRun(held.loop, undefined), T0);
    const r = answerLoop(loop, { questionId: "q1", text: "This" }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.loop.status).toBe("running");
    expect(r.loop.waitingSince).toBeUndefined();
  });

  test("a loop saved before autonomy levels counts as auto", () => {
    const { autonomy: _drop, ...old } = loopOn();
    expect(formatLoopStatus(old as LoopState)).toMatch(/^Auto · /);
    const unattended = setLoopAutonomy(loopOn(), "unattended");
    expect(
      formatLoopStatus(
        enterWait(runItem(unattended, "1", { outcome: "waiting" }), T0),
      ),
    ).toMatch(/goes on without answers at/);
  });
});

describe("tool names for the CLI", () => {
  const names = LOOP_CLI_TOOL_NAMES;

  test("the item prompt names the CLI's tools when told to", () => {
    const prompt = loopItemPrompt({
      item: PLAN.items[0],
      answers: [],
      questions: [],
      attempt: 1,
      unanswered: [
        {
          id: "q1",
          itemId: "1",
          question: "Which?",
          kind: "blocking",
          askedAt: T0.toISOString(),
        },
      ],
      toolNames: names,
    });
    expect(prompt).toContain("call FinishItem");
    expect(prompt).toContain("call HoldQuestion");
    expect(prompt).toContain("record it with HoldQuestion");
    expect(prompt).not.toMatch(/finish_item|hold_question/);
    // Without names it is the IDE's, as before
    expect(
      loopItemPrompt({
        item: PLAN.items[0],
        answers: [],
        questions: [],
        attempt: 1,
      }),
    ).toContain("call finish_item");
  });

  test("the re-plan prompt names the CLI's plan tool", () => {
    const prompt = loopReplanPrompt({
      loop: loopOn(),
      plan: PLAN,
      planTitle: "Parser",
      toolNames: names,
    });
    expect(prompt).toContain('call PresentPlan with the title "Parser"');
    expect(prompt).not.toContain("present_plan");
  });

  test("tool results and errors use the names they are given", () => {
    let loop = startItemRun(loopOn(), "1", 0, T0);
    for (let i = 0; i < 4; i++) {
      const r = holdQuestion(
        loop,
        { itemId: "1", question: `Q${i}?`, kind: "blocking" },
        T0,
      );
      if (!r.ok) throw new Error(r.error);
      loop = r.loop;
    }
    const over = holdQuestion(
      loop,
      { itemId: "1", question: "Q5?", kind: "blocking", toolNames: names },
      T0,
    );
    expect(over.ok).toBe(false);
    expect(!over.ok && over.error).toContain("call FinishItem");

    const q = loop.questions[0];
    expect(holdQuestionResult(q, false, names)).toContain("call FinishItem");
    expect(holdQuestionResult(q, false)).toContain("call finish_item");
    expect(approvalHeldResult(q, names)).toContain("call FinishItem");
    expect(repeatedCallResult("Bash", 4, names)).toContain("call FinishItem");
    expect(replanHoldResult(names)).toContain("with PresentPlan");
    expect(REPLAN_HOLD_RESULT).toContain("with present_plan");
  });

  test("a call's key ignores argument order and matches the gui's grantKey", () => {
    expect(loopCallKey("Bash", { a: 1, b: [2, { c: 3, d: 4 }] })).toBe(
      loopCallKey("Bash", { b: [2, { d: 4, c: 3 }], a: 1 }),
    );
    expect(loopCallKey("Bash", { command: "ls" })).toBe(
      'Bash\u0000{"command":"ls"}',
    );
    expect(loopCallKey("Bash", undefined)).toBe("Bash\u0000{}");
  });

  test("finish_item's arguments become its report", () => {
    expect(finishItemReport({ outcome: "nope" })).toEqual({
      ok: false,
      error: "outcome must be one of done, waiting, stuck, later",
    });
    const r = finishItemReport({
      outcome: "done",
      summary: `  ${"s".repeat(600)}`,
      notes: "  use npm test  ",
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.report.outcome).toBe("done");
    expect(r.report.summary).toHaveLength(500);
    expect(r.report.notes).toBe("use npm test");
    expect(finishItemReport({ outcome: "stuck", summary: " " })).toEqual({
      ok: true,
      report: { outcome: "stuck" },
    });
  });
});

describe("the plan block", () => {
  function midRun(): LoopState {
    let loop = runItem(loopOn(), "1", {
      outcome: "done",
      summary: "Parser written; see parse.ts",
    });
    loop = finishItemRun(
      { ...startItemRun(loop, "1", 0, T0) },
      { outcome: "done", summary: "Parser written", notes: "npm test works" },
    );
    const answered = answerLoop(
      loop,
      { text: "Keep the public API", standing: true },
      T0,
    );
    if (!answered.ok) throw new Error(answered.error);
    loop = startItemRun(answered.loop, "2", 3, T0);
    const held = holdQuestion(
      loop,
      {
        itemId: "2",
        question: "Use vitest or jest?",
        kind: "assumption",
        assumption: "vitest",
      },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    return held.loop;
  }

  test("shows every slot, marks the running item, and carries notes and signs", () => {
    const block = loopPlanBlock({ loop: midRun(), plan: PLAN });
    expect(block.startsWith("<task_list>")).toBe(true);
    expect(block.endsWith("</task_list>")).toBe(true);
    expect(block).toContain("[x] 1. Write the parser: Parser written");
    expect(block).toContain("[>] 2. Add tests  <- this item");
    expect(block).toContain("[ ] 3. Update the docs");
    expect(block).toContain(
      "    q1 (assumption): Use vitest or jest? Assumed: vitest",
    );
    expect(block).toContain("Notes from earlier items:\n- npm test works");
    expect(block).toContain(
      "The person's instructions for every item:\n- Keep the public API",
    );
    expect(block).toContain("report it with finish_item");
    // It marks the item; it never asks the model to pick one or explains the loop
    expect(block).not.toMatch(/next item|choose|loop/i);
  });

  test("uses the CLI's names, clips long summaries, and is empty without items", () => {
    let loop = startItemRun(loopOn(), "1", 0, T0);
    loop = finishItemRun(loop, { outcome: "stuck", summary: "x".repeat(400) });
    const block = loopPlanBlock({
      loop,
      plan: PLAN,
      toolNames: LOOP_CLI_TOOL_NAMES,
    });
    expect(block).toContain(
      "report it with FinishItem and ask with HoldQuestion",
    );
    const failed = block.split("\n").find((l) => l.startsWith("[!] 1."))!;
    expect(failed.length).toBeLessThan(200);
    expect(failed.endsWith("…")).toBe(true);
    expect(loopPlanBlock({ loop, plan: plan() })).toBe("");
  });

  test("with the block, the item prompt leaves the notes and signs to it", () => {
    const base = {
      item: PLAN.items[1],
      answers: [],
      questions: [],
      attempt: 1,
      notes: ["npm test works"],
      standing: ["Keep the public API"],
    };
    const withBlock = loopItemPrompt({ ...base, planBlock: true });
    expect(withBlock).toContain("only this item: Add tests");
    expect(withBlock).toContain(
      "The task list below shows every item's state as this run started",
    );
    expect(withBlock).not.toContain("npm test works");
    expect(withBlock).not.toContain("Keep the public API");
    const without = loopItemPrompt(base);
    expect(without).toContain("- npm test works");
    expect(without).toContain("- Keep the public API");
  });

  test("one block per run: what the run changes stays out of it, the next run gets it", () => {
    // Found by the real-model run: a block rebuilt per request changed (a
    // held question) and broke the prompt cache at the block.
    let loop = startItemRun(loopOn(), "1", 0, T0);
    const memo = {};
    const first = loopRunPlanBlock(memo, { loop, plan: PLAN });
    expect(first).toContain("[>] 1. Write the parser  <- this item");
    const held = holdQuestion(
      loop,
      {
        itemId: "1",
        question: "Tabs or spaces?",
        kind: "assumption",
        assumption: "spaces",
      },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    loop = held.loop;
    expect(loopPlanBlock({ loop, plan: PLAN })).toContain("Tabs or spaces?");
    expect(loopRunPlanBlock(memo, { loop, plan: PLAN })).toBe(first);
    loop = finishItemRun(loop, { outcome: "done", summary: "Parser written" });
    loop = startItemRun(loop, "2", 4, at(5));
    const next = loopRunPlanBlock(memo, { loop, plan: PLAN });
    expect(next).toContain("[x] 1. Write the parser: Parser written");
    expect(next).toContain("[>] 2. Add tests  <- this item");
    expect(loopRunKey(loop)).toBe(`2:4:${at(5).toISOString()}`);
    expect(
      loopRunPlanBlock(
        {},
        {
          loop: finishItemRun(loop, { outcome: "done", summary: "ok" }),
          plan: PLAN,
        },
      ),
    ).toBe("");
  });

  test("the block goes after the item prompt's text", () => {
    expect(
      withLoopPlanBlock("Work on this item", "<task_list></task_list>"),
    ).toBe("Work on this item\n\n<task_list></task_list>");
    expect(withLoopPlanBlock("Work", "")).toBe("Work");
    expect(
      withLoopPlanBlock(
        [{ type: "text", text: "Work" }],
        "<task_list></task_list>",
      ),
    ).toEqual([
      { type: "text", text: "Work" },
      { type: "text", text: "<task_list></task_list>" },
    ]);
  });
});

describe("controls: skip, run again and the limits", () => {
  function ok(result: LoopControlResult): LoopState {
    if (!result.ok) throw new Error(result.error);
    return result.loop;
  }

  test("a skipped item counts as finished, shows cancelled, and is no progress", () => {
    let loop = loopOn();
    loop = ok(skipItem(loop, "1"));
    expect(loop.items[0]).toMatchObject({ status: "done", skipped: true });
    expect(loop.doneThisRound).toBe(0);
    expect(decideNext(loop, PLAN, ctx())).toEqual({ kind: "run", itemId: "2" });
    const synced = taskPlanWithLoop(PLAN, loop);
    expect(synced.items[0]).toMatchObject({
      status: "cancelled",
      note: "Skipped by you",
    });
    expect(formatLoopStatus(loop)).toContain("0/3 done · 1 skipped");
    expect(loopPlanBlock({ loop, plan: PLAN })).toContain(
      "[x] 1. Write the parser (skipped by the person: not done)",
    );
    loop = ok(skipItem(runItem(loop, "2", { outcome: "done" }), "3"));
    expect(loop.doneThisRound).toBe(1);
    expect(decideNext(loop, PLAN, ctx())).toMatchObject({
      kind: "stop",
      reason: "done",
      detail: "All 3 items are done (2 skipped).",
    });
  });

  test("skipping is refused for the running item and an item already done", () => {
    const running = startItemRun(loopOn(), "1", 0, T0);
    expect(skipItem(running, "1")).toEqual({
      ok: false,
      error: "1 is running: use Stop now, or Stop after this item, instead",
    });
    const done = runItem(loopOn(), "1", { outcome: "done" });
    expect(skipItem(done, "1").ok).toBe(false);
    expect(skipItem(done, "9")).toEqual({
      ok: false,
      error: "No item 9 in the loop",
    });
    const skipped = ok(skipItem(loopOn(), "2"));
    expect(skipItem(skipped, "2").ok).toBe(false);
  });

  test("a skipped waiting item keeps its questions open, and an answer waits for a run", () => {
    let loop = startItemRun(loopOn(plan("Only")), "1", 0, T0);
    const held = holdQuestion(
      loop,
      { itemId: "1", question: "Which API?", kind: "blocking" },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    loop = enterWait(finishItemRun(held.loop, { outcome: "waiting" }), T0);
    expect(loop.status).toBe("waiting");

    loop = ok(skipItem(loop, "1"));
    // The loop goes on
    expect(loop.status).toBe("running");
    expect(loop.questions[0].answerId).toBeUndefined();
    const answered = answerLoop(
      loop,
      { questionId: "q1", text: "The v2 one" },
      T0,
    );
    if (!answered.ok) throw new Error(answered.error);
    expect(answered.answer.route).toBe("next-run");
    expect(status(answered.loop, "1")).toBe("done");

    // Run again: the answer goes with the run
    const again = ok(runItemAgain(answered.loop, "1"));
    expect(answersToDeliver(again, "1").map((a) => a.text)).toEqual([
      "The v2 one",
    ]);
  });

  test("run again reopens a done, failed or skipped item, with its own wording", () => {
    let loop = runItem(loopOn(), "1", { outcome: "done", summary: "Parsed" });
    loop = runItem(loop, "2", { outcome: "stuck" });
    loop = ok(skipItem(loop, "3"));
    for (const id of ["1", "2", "3"]) {
      loop = ok(runItemAgain(loop, id));
      expect(loop.items.find((i) => i.id === id)).toMatchObject({
        status: "pending",
        attempts: 0,
        again: true,
      });
    }
    expect(loop.items[2].skipped).toBeUndefined();
    expect(taskPlanWithLoop(PLAN, loop).items[0]).toMatchObject({
      status: "pending",
      note: "Run again: you asked for it",
    });
    expect(loopPlanBlock({ loop, plan: PLAN })).toContain(
      "[ ] 2. Add tests (to be run again at the person's request)",
    );

    const prompt = loopItemPrompt({
      item: PLAN.items[0],
      answers: [],
      questions: [],
      again: loop.items[0].again,
      attempt: 1,
    });
    expect(prompt).toContain("the person asked for it to run again");
    expect(prompt).toContain("check what is done before you change anything");
    expect(prompt).not.toContain("overruled");

    // The run ends: the flag goes
    const ran = runItem(loop, "1", { outcome: "done" });
    expect(ran.items[0].again).toBeUndefined();
  });

  test("run again is refused for the running item and an item still to run", () => {
    const running = startItemRun(loopOn(), "1", 0, T0);
    expect(runItemAgain(running, "1")).toEqual({
      ok: false,
      error: "1 is running",
    });
    expect(runItemAgain(loopOn(), "2")).toEqual({
      ok: false,
      error: "2 has not run yet",
    });
  });

  test("run again on a loop that finished leaves it stopped, ready to resume", () => {
    const one = plan("One");
    const done = runItem(loopOn(one), "1", { outcome: "done" });
    const action = decideNext(done, one, ctx());
    if (action.kind !== "stop") throw new Error(action.kind);
    const stopped = stopLoop(done, action.reason, action.detail);
    const reopened = ok(runItemAgain(stopped, "1"));
    expect(reopened).toMatchObject({
      status: "stopped",
      stopReason: "stopped",
      stopDetail: "An item was reopened: Resume to run it.",
    });
    expect(decideNext(reopened, one, ctx())).toEqual({ kind: "none" });
    const resumed = resumeLoop(reopened, ctx(1));
    expect(decideNext(resumed, one, ctx(1))).toEqual({
      kind: "run",
      itemId: "1",
    });
  });

  test("setLoopBudget changes the limits within bounds, and refuses anything else", () => {
    const loop = loopOn();
    const changed = ok(
      setLoopBudget(loop, {
        maxRounds: 1,
        maxTokens: 0,
        maxWallMs: 30 * 60_000,
        maxAttempts: 5,
        maxConsecutiveFailures: 10,
      }),
    );
    expect(changed.budget).toEqual({
      maxRounds: 1,
      maxTokens: 0,
      maxWallMs: 30 * 60_000,
      maxAttempts: 5,
      maxConsecutiveFailures: 10,
      maxNoProgressRounds: loop.budget.maxNoProgressRounds,
      maxItemTurns: loop.budget.maxItemTurns,
    });
    // The bounds themselves are allowed
    expect(
      setLoopBudget(loop, {
        maxRounds: 50,
        maxTokens: 10_000,
        maxWallMs: 86_400_000,
      }).ok,
    ).toBe(true);
    expect(
      setLoopBudget(loop, { maxTokens: 50_000_000, maxWallMs: 60_000 }).ok,
    ).toBe(true);
    const refused: [unknown, string][] = [
      [{ maxRounds: 0 }, "maxRounds must be an integer from 1 to 50"],
      [{ maxRounds: 51 }, "maxRounds must be an integer from 1 to 50"],
      [{ maxRounds: 2.5 }, "maxRounds must be an integer from 1 to 50"],
      [
        { maxTokens: 9_999 },
        "maxTokens must be 0 (no limit) or an integer from 10000 to 50000000",
      ],
      [
        { maxTokens: 50_000_001 },
        "maxTokens must be 0 (no limit) or an integer from 10000 to 50000000",
      ],
      [
        { maxWallMs: 59_999 },
        "maxWallMs must be 0 (no limit) or an integer from 60000 to 86400000",
      ],
      [
        { maxWallMs: "1h" },
        "maxWallMs must be 0 (no limit) or an integer from 60000 to 86400000",
      ],
      [{ maxAttempts: 0 }, "maxAttempts must be an integer from 1 to 5"],
      [{ maxAttempts: 6 }, "maxAttempts must be an integer from 1 to 5"],
      [
        { maxConsecutiveFailures: 0 },
        "maxConsecutiveFailures must be an integer from 1 to 10",
      ],
      [
        { maxConsecutiveFailures: 11 },
        "maxConsecutiveFailures must be an integer from 1 to 10",
      ],
      [{ maxNoProgressRounds: 3 }, "maxNoProgressRounds is not a limit"],
      ["5 rounds", "The limits must be an object"],
      [[1], "The limits must be an object"],
    ];
    for (const [input, error] of refused) {
      const result = setLoopBudget(loop, input);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toContain(error);
    }
    // One bad limit changes nothing
    expect(setLoopBudget(loop, { maxRounds: 2, maxAttempts: 9 }).ok).toBe(
      false,
    );
    // The level resets them
    expect(setLoopAutonomy(changed, "auto").budget).toEqual(
      LOOP_AUTONOMY.auto.budget,
    );
  });

  test("a lower limit stops the loop at its next step", () => {
    const loop = ok(setLoopBudget(loopOn(), { maxTokens: 10_000 }));
    expect(decideNext(loop, PLAN, ctx(0, 20_000))).toMatchObject({
      kind: "stop",
      reason: "tokens",
    });
    const timed = ok(setLoopBudget(loopOn(), { maxWallMs: 60_000 }));
    expect(decideNext(timed, PLAN, ctx(2))).toMatchObject({
      kind: "stop",
      reason: "time",
    });
  });

  test("re-plan never, up to N and until done map onto maxRounds", () => {
    const one = plan("One");
    const loop = loopOn(one);
    const never = ok(
      setLoopBudget(loop, {
        maxRounds: maxRoundsForReplan(loop, { kind: "never" }),
      }),
    );
    expect(never.budget.maxRounds).toBe(1);
    expect(loopReplanSetting(never)).toEqual({ kind: "never" });
    expect(describeLoopReplan(never)).toBe(
      "Re-plan never: one pass over the plan",
    );
    // Round 1's item failed: never means stop rather than re-plan
    const failed = runItem(never, "1", { outcome: "stuck" });
    expect(decideNext(failed, one, ctx())).toMatchObject({
      kind: "stop",
      reason: "rounds",
    });

    const twice = ok(
      setLoopBudget(loop, {
        maxRounds: maxRoundsForReplan(loop, { kind: "up_to", replans: 2 }),
      }),
    );
    expect(twice.budget.maxRounds).toBe(3);
    expect(loopReplanSetting(twice)).toEqual({ kind: "up_to", replans: 2 });
    expect(describeLoopReplan(twice)).toBe("Re-plan up to 2 times");
    const stuck = runItem(twice, "1", { outcome: "stuck" });
    expect(decideNext(stuck, one, ctx())).toEqual({ kind: "replan" });

    const untilDone = ok(
      setLoopBudget(never, {
        maxRounds: maxRoundsForReplan(never, { kind: "until_done" }),
      }),
    );
    expect(untilDone.budget.maxRounds).toBe(
      LOOP_AUTONOMY.auto.budget.maxRounds,
    );
    expect(loopReplanSetting(untilDone)).toEqual({ kind: "until_done" });
    expect(describeLoopReplan(untilDone)).toBe(
      "Re-plan until done (at most 4 times, the Auto level's limit)",
    );
  });

  test("describeLoopBudget says the limits in words", () => {
    expect(describeLoopBudget(LOOP_AUTONOMY.auto.budget)).toBe(
      "5 rounds, 10,000,000 tokens, 120 minutes",
    );
    expect(
      describeLoopBudget({
        ...LOOP_AUTONOMY.auto.budget,
        maxRounds: 1,
        maxTokens: 0,
        maxWallMs: 0,
      }),
    ).toBe("1 round, no token limit, no time limit");
  });

  test("the re-plan prompt names skipped items", () => {
    const loop = ok(skipItem(loopOn(), "2"));
    expect(loopReplanPrompt({ loop, plan: PLAN })).toContain(
      "- [x] Add tests (skipped by the person)",
    );
  });
});

describe("strategies", () => {
  function loopWith(
    strategy: LoopStrategy | undefined,
    p: TaskPlan = PLAN,
    options: { autonomy?: LoopAutonomy; budget?: Partial<LoopBudget> } = {},
  ): LoopState {
    return createLoop(p, {
      now: T0,
      sessionTokens: 0,
      autonomy: options.autonomy ?? "auto",
      budget: options.budget,
      ...(strategy ? { strategy } : {}),
    });
  }

  /** A re-plan turn for `action` that presents `presented`, accepted when allowed. */
  function replanTurn(
    loop: LoopState,
    before: TaskPlan,
    action: { checkIn?: string; itemId?: string },
    presented: TaskPlan,
  ) {
    const started = startReplan(loop, 0, T0, { plan: before, ...action });
    const ended = endReplan(started, presented);
    return {
      ...ended,
      loop: ended.accept
        ? acceptReplan(ended.loop, presented, ctx())
        : ended.loop,
    };
  }

  const four = plan("A", "B", "C", "D");
  const five = plan("A", "B", "C", "D", "E");

  test("every strategy has a label and a one-line description", () => {
    for (const s of LOOP_STRATEGY_ORDER) {
      expect(LOOP_STRATEGIES[s].label).toBeTruthy();
      expect(LOOP_STRATEGIES[s].description).not.toContain("\n");
    }
  });

  test("the default follows the level; a pick stays when the level changes", () => {
    const at = (autonomy: LoopAutonomy) =>
      createLoop(PLAN, { now: T0, sessionTokens: 0, autonomy });
    expect(at("supervised").strategy).toBe("finish");
    expect(at("auto").strategy).toBe("fix-forward");
    expect(at("unattended").strategy).toBe("fix-forward");
    expect(defaultLoopStrategy("supervised")).toBe("finish");

    // Not picked: the strategy follows the level
    expect(setLoopAutonomy(at("auto"), "supervised").strategy).toBe("finish");
    expect(setLoopAutonomy(at("supervised"), "unattended").strategy).toBe(
      "fix-forward",
    );
    // Picked, at the start or later: it stays
    const picked = loopWith("check-in");
    expect(picked.strategyPicked).toBe(true);
    expect(setLoopAutonomy(picked, "supervised").strategy).toBe("check-in");
    const later = setLoopStrategy(at("supervised"), "check-in");
    expect(setLoopAutonomy(later, "unattended").strategy).toBe("check-in");
  });

  test("a loop without a strategy finishes what it started, as before", () => {
    // No level named, or saved before strategies
    expect(loopOn().strategy).toBeUndefined();
    const { strategy: _drop, ...old } = loopWith("fix-forward");
    const saved = old as LoopState;
    expect(loopStrategy(saved)).toBe("finish");
    // Changing the level does not give it one
    expect(setLoopAutonomy(saved, "supervised").strategy).toBeUndefined();

    let loop = runItem(saved, "1", { outcome: "done" });
    loop = runItem(loop, "2", { outcome: "stuck" });
    // No repair: the next item runs, and the round's re-plan comes at the end
    expect(decideNext(loop, PLAN, ctx())).toEqual({ kind: "run", itemId: "3" });
    loop = runItem(loop, "3", { outcome: "done" });
    expect(decideNext(loop, PLAN, ctx())).toEqual({ kind: "replan" });
    expect(loop.repairItemId).toBeUndefined();
    expect(loop.doneSinceReplan).toBeUndefined();
    expect(formatLoopStatus(loop)).toMatch(/^Auto · Round 1/);
  });

  test("the status names a strategy that is not the level's default", () => {
    expect(formatLoopStatus(loopWith("fix-forward"))).toMatch(
      /^Auto · Round 1/,
    );
    expect(formatLoopStatus(loopWith("check-in"))).toMatch(
      /^Auto · Check in · Round 1/,
    );
    expect(
      formatLoopStatus(loopWith("finish", PLAN, { autonomy: "unattended" })),
    ).toMatch(/^Unattended · Finish what you started · /);
    expect(formatLoopStatus(loopWith("check-in"), { level: false })).toMatch(
      /^Round 1/,
    );
  });

  describe("check in", () => {
    test("re-plans after every 3 finished items, between items", () => {
      let loop = loopWith("check-in", five);
      loop = runItem(loop, "1", { outcome: "done" });
      loop = runItem(loop, "2", { outcome: "done" });
      expect(decideNext(loop, five, ctx())).toEqual({
        kind: "run",
        itemId: "3",
      });
      // Not while an item runs
      const running = startItemRun(loop, "3", 0, T0);
      expect(decideNext(running, five, ctx())).toEqual({ kind: "none" });
      loop = finishItemRun(running, { outcome: "done" });
      expect(decideNext(loop, five, ctx())).toEqual({
        kind: "replan",
        checkIn: "3 items were done since the last check-in.",
      });
      const prompt = loopReplanTurnPrompt(
        { checkIn: "3 items were done since the last check-in." },
        { loop, plan: five, toolNames: LOOP_CLI_TOOL_NAMES },
      );
      expect(prompt).toContain(
        "Check in on the plan before the next item: 3 items were done",
      );
      expect(prompt).toContain("present it unchanged");
      expect(prompt).toContain("PresentPlan");
      expect(prompt).not.toContain("No item of the plan can run now");
    });

    test("a check-in that keeps the plan is not a round", () => {
      let loop = loopWith("check-in", five);
      for (const id of ["1", "2", "3"]) {
        loop = runItem(loop, id, { outcome: "done" });
      }
      const action = decideNext(loop, five, ctx());
      if (action.kind !== "replan") throw new Error(action.kind);
      const turn = replanTurn(loop, five, action, five);
      expect(turn.accept).toBe(true);
      expect(turn.loop.round).toBe(1);
      expect(turn.loop.noProgressRounds).toBe(0);
      expect(turn.loop.doneThisRound).toBe(3);
      expect(turn.loop.doneSinceReplan).toBe(0);
      expect(decideNext(turn.loop, five, ctx())).toEqual({
        kind: "run",
        itemId: "4",
      });
    });

    test("a check-in that changes the plan is a round", () => {
      let loop = loopWith("check-in", five, { autonomy: "unattended" });
      for (const id of ["1", "2", "3"]) {
        loop = runItem(loop, id, { outcome: "done" });
      }
      const action = decideNext(loop, five, ctx());
      if (action.kind !== "replan") throw new Error(action.kind);
      const changed: TaskPlan = {
        ...five,
        items: [
          ...five.items.slice(0, 4),
          { id: "6", text: "E, smaller", status: "pending" },
        ],
      };
      const turn = replanTurn(loop, five, action, changed);
      expect(turn.accept).toBe(true);
      expect(turn.loop.round).toBe(2);
      expect(turn.loop.doneThisRound).toBe(0);
    });

    test("a failed item or an overruled assumption asks for a check-in at once", () => {
      let loop = loopWith("check-in", four);
      loop = runItem(loop, "1", { outcome: "stuck", summary: "no runner" });
      expect(decideNext(loop, four, ctx())).toEqual({
        kind: "replan",
        checkIn: "Item 1 failed.",
      });
      // Kept as it was: the failed item stays failed and the loop goes on
      let turn = replanTurn(loop, four, { checkIn: "Item 1 failed." }, four);
      expect(turn.loop.round).toBe(1);
      expect(status(turn.loop, "1")).toBe("failed");
      expect(decideNext(turn.loop, four, ctx())).toEqual({
        kind: "run",
        itemId: "2",
      });

      // An overruled assumption of a done item
      loop = startItemRun(turn.loop, "2", 0, T0);
      const q = holdQuestion(
        loop,
        {
          itemId: "2",
          question: "Tabs?",
          kind: "assumption",
          assumption: "spaces",
        },
        T0,
      );
      if (!q.ok) throw new Error(q.error);
      loop = finishItemRun(q.loop, { outcome: "done" });
      expect(decideNext(loop, four, ctx())).toEqual({
        kind: "run",
        itemId: "3",
      });
      const a = answerLoop(
        loop,
        { questionId: q.question.id, text: "tabs" },
        T0,
      );
      if (!a.ok) throw new Error(a.error);
      expect(decideNext(a.loop, four, ctx())).toMatchObject({
        kind: "replan",
        checkIn: expect.stringContaining("overruled an assumption of item 2"),
      });
      turn = replanTurn(a.loop, four, { checkIn: "x" }, four);
      expect(decideNext(turn.loop, four, ctx())).toEqual({
        kind: "run",
        itemId: "2",
      });
    });

    test("check-ins keep the limits: none past maxRounds or the no-progress limit, and budgets stop", () => {
      let loop = loopWith("check-in", five, { budget: { maxRounds: 1 } });
      for (const id of ["1", "2", "3"]) {
        loop = runItem(loop, id, { outcome: "done" });
      }
      // No re-plan is left, so the items go on
      expect(decideNext(loop, five, ctx())).toEqual({
        kind: "run",
        itemId: "4",
      });

      let stuck = loopWith("check-in", four, {
        budget: { maxNoProgressRounds: 1 },
      });
      stuck = runItem(stuck, "1", { outcome: "stuck" });
      expect(decideNext(stuck, four, ctx())).toEqual({
        kind: "run",
        itemId: "2",
      });

      loop = loopWith("check-in", five, { budget: { maxTokens: 100 } });
      for (const id of ["1", "2", "3"]) {
        loop = runItem(loop, id, { outcome: "done" });
      }
      expect(decideNext(loop, five, ctx(0, 100))).toMatchObject({
        kind: "stop",
        reason: "tokens",
      });
    });
  });

  describe("fix forward", () => {
    test("a failed item gets a re-plan of just that item", () => {
      let loop = loopWith(undefined, PLAN, { autonomy: "auto" });
      expect(loop.strategy).toBe("fix-forward");
      loop = runItem(loop, "1", { outcome: "done" });
      loop = runItem(loop, "2", { outcome: "stuck", summary: "no runner" });
      expect(loop.consecutiveFailures).toBe(1);
      const action = decideNext(loop, PLAN, ctx());
      expect(action).toEqual({ kind: "replan", itemId: "2" });
      if (action.kind !== "replan") throw new Error(action.kind);

      const prompt = loopReplanTurnPrompt(action, {
        loop,
        plan: PLAN,
        planFile: ".continue/plans/p.md",
        planTitle: "Parser",
      });
      expect(prompt).toContain("failed: Add tests");
      expect(prompt).toContain("What its run reported: no runner");
      expect(prompt).toMatch(/reword the item/);
      expect(prompt).toMatch(/split it into at most 3 smaller to-dos/);
      expect(prompt).toMatch(/drop it/);
      expect(prompt).toContain('present_plan with the title "Parser"');
      expect(prompt).toContain("Do not change, add or drop any other to-do.");
      expect(
        loopItemRepairPrompt({
          loop,
          plan: PLAN,
          itemId: "2",
          toolNames: LOOP_CLI_TOOL_NAMES,
        }),
      ).toContain("call PresentPlan");

      // The repair turn records the item and counts against it
      const started = startReplan(loop, 7, T0, { plan: PLAN, ...action });
      expect(started.current).toMatchObject({
        kind: "replan",
        itemId: "2",
        itemText: "Add tests",
        planTexts: PLAN.items.map((i) => i.text),
      });
      expect(started.items.find((i) => i.id === "2")?.repairs).toBe(1);
      expect(started.repairItemId).toBeUndefined();
    });

    test("a split of the item goes on under Auto and counts a round; the parts inherit its repairs", () => {
      let loop = loopWith("fix-forward");
      loop = runItem(loop, "1", { outcome: "done" });
      loop = runItem(loop, "2", { outcome: "stuck" });
      const split: TaskPlan = {
        ...PLAN,
        items: [
          PLAN.items[0],
          { id: "4", text: "Install vitest", status: "pending" },
          { id: "5", text: "Add parser tests", status: "pending" },
          PLAN.items[2],
        ],
      };
      const turn = replanTurn(loop, PLAN, { itemId: "2" }, split);
      expect(turn.accept).toBe(true);
      expect(turn.loop.replanReason).toBe(
        "The repair replaces the failed item with 2 to-dos.",
      );
      expect(turn.loop.round).toBe(2);
      expect(turn.loop.items.map((i) => [i.id, i.status, i.repairs])).toEqual([
        ["1", "done", undefined],
        ["4", "pending", 1],
        ["5", "pending", 1],
        ["3", "pending", undefined],
      ]);
      expect(decideNext(turn.loop, split, ctx())).toEqual({
        kind: "run",
        itemId: "4",
      });
    });

    test("a repair that changes other to-dos is judged as a re-plan; Supervised waits", () => {
      const loop = runItem(loopWith("fix-forward"), "1", { outcome: "stuck" });
      const before = PLAN.items.map((i) => i.text);
      const item = "Write the parser";
      const reworded = plan("Parse in steps", "Add tests", "Update the docs");
      expect(repairDecision(loop, before, item, reworded)).toEqual({
        accept: true,
        reason: "The repair replaces the failed item with 1 to-do.",
      });
      expect(
        repairDecision(
          loop,
          before,
          item,
          plan("Add tests", "Update the docs"),
        ),
      ).toEqual({ accept: true, reason: "The repair drops the failed item." });
      expect(
        repairDecision(loop, before, item, plan("Parse", "Add tests", "Docs")),
      ).toMatchObject({
        accept: false,
        reason: "The re-plan adds 2 new to-dos.",
      });
      const tooMany = plan("a", "b", "c", "d", "Add tests", "Update the docs");
      expect(repairDecision(loop, before, item, tooMany).accept).toBe(false);
      const supervised = setLoopAutonomy(loop, "supervised");
      expect(repairDecision(supervised, before, item, reworded).accept).toBe(
        false,
      );
    });

    test("at most 2 repairs per item, then it stays failed and the loop moves on", () => {
      const p = plan("A", "B");
      let loop = loopWith("fix-forward", p, {
        budget: { maxConsecutiveFailures: 5 },
      });
      for (let repair = 1; repair <= 2; repair++) {
        loop = runItem(loop, "1", { outcome: "stuck" });
        expect(decideNext(loop, p, ctx())).toEqual({
          kind: "replan",
          itemId: "1",
        });
        // The model keeps the item as it was
        loop = replanTurn(loop, p, { itemId: "1" }, p).loop;
        expect(loop.items[0]).toMatchObject({
          status: "pending",
          repairs: repair,
        });
      }
      expect(loop.round).toBe(3);
      loop = runItem(loop, "1", { outcome: "stuck" });
      expect(status(loop, "1")).toBe("failed");
      expect(loop.repairItemId).toBeUndefined();
      expect(decideNext(loop, p, ctx())).toEqual({ kind: "run", itemId: "2" });
    });

    test("repairs keep the limits: rounds, the three-failures stop and the budgets", () => {
      const p = plan("A", "B");
      // A repair counts toward maxRounds: none is left after round 2
      let loop = loopWith("fix-forward", p, { budget: { maxRounds: 2 } });
      loop = runItem(loop, "1", { outcome: "stuck" });
      loop = replanTurn(loop, p, { itemId: "1" }, p).loop;
      expect(loop.round).toBe(2);
      loop = runItem(loop, "1", { outcome: "stuck" });
      expect(decideNext(loop, p, ctx())).toEqual({ kind: "run", itemId: "2" });

      // Every failed run counts toward three in a row
      loop = loopWith("fix-forward", p);
      for (let i = 0; i < 2; i++) {
        loop = runItem(loop, "1", { outcome: "stuck" });
        loop = replanTurn(loop, p, { itemId: "1" }, p).loop;
      }
      loop = runItem(loop, "1", undefined);
      loop = runItem(loop, "1", undefined);
      expect(loop.consecutiveFailures).toBe(3);
      expect(decideNext(loop, p, ctx())).toMatchObject({
        kind: "stop",
        reason: "failures",
      });

      // Budgets come first
      loop = runItem(
        loopWith("fix-forward", p, { budget: { maxWallMs: 60_000 } }),
        "1",
        { outcome: "stuck" },
      );
      expect(decideNext(loop, p, ctx(1))).toMatchObject({
        kind: "stop",
        reason: "time",
      });
    });

    test("an item requeued by an answer before its repair just runs again", () => {
      let loop = loopWith("fix-forward", plan("A"));
      loop = runItem(loop, "1", { outcome: "stuck" });
      const a = answerLoop(loop, { itemId: "1", text: "Use the old API" }, T0);
      if (!a.ok) throw new Error(a.error);
      expect(decideNext(a.loop, plan("A"), ctx())).toEqual({
        kind: "run",
        itemId: "1",
      });
    });
  });
});

describe("found by the sandbox run", () => {
  test("a run may make maxItemTurns requests, then only report, then it ends", () => {
    const loop = loopOn(PLAN, { maxItemTurns: 10 });
    expect(itemTurnState(loop, 9)).toBe("ok");
    expect(itemTurnState(loop, 10)).toBe("wrap-up");
    expect(itemTurnState(loop, 19)).toBe("wrap-up");
    expect(itemTurnState(loop, 20)).toBe("end");
    expect(itemTurnState(loopOn(PLAN, { maxItemTurns: 0 }), 500)).toBe("ok");
  });

  test("a loop saved before the turn limit uses the default", () => {
    const loop = loopOn();
    const { maxItemTurns: _drop, ...budget } = loop.budget;
    expect(itemTurnState({ ...loop, budget: budget as any }, 59)).toBe("ok");
    expect(itemTurnState({ ...loop, budget: budget as any }, 60)).toBe(
      "wrap-up",
    );
  });

  test("a run ended at the limit is failed with the reason, not counted as done", () => {
    const loop = runItem(loopOn(), "1", itemTurnLimitReport(33));
    expect(status(loop, "1")).toBe("failed");
    expect(loop.items[0].summary).toBe(
      "Ended after 33 requests without reporting.",
    );
  });

  test("a held call reads as what would actually run", () => {
    expect(
      describeHeldCall("run_terminal_command", { command: "npm publish" }),
    ).toBe("npm publish");
    expect(describeHeldCall("mcp_tool", { a: 1 })).toBe('mcp_tool {"a":1}');
    expect(describeHeldCall("mcp_tool", {})).toBe("mcp_tool");
    expect(describeHeldCall("mcp_tool", undefined)).toBe("mcp_tool");
  });

  test("a failed request stops the loop with its own reason, and Resume is possible", () => {
    let loop = startItemRun(loopOn(), "1", 0, T0);
    loop = stopLoop(loop, "error", "The model request failed: boom");
    expect(loop).toMatchObject({ status: "stopped", stopReason: "error" });
    expect(status(loop, "1")).toBe("pending");
    expect(decideNext(resumeLoop(loop, ctx()), PLAN, ctx())).toEqual({
      kind: "run",
      itemId: "1",
    });
  });
});

test("the token budget counts output and uncached input, not re-sent prompts", () => {
  expect(
    loopTokensFromUsage({
      promptTokens: 201_398,
      completionTokens: 1283,
      promptTokensDetails: { cachedTokens: 184_961 },
    }),
  ).toBe(17_720);
  // A provider that reports no cache counts in full
  expect(loopTokensFromUsage({ promptTokens: 100, completionTokens: 5 })).toBe(
    105,
  );
});

describe("an item that reports waiting", () => {
  function heldApproval() {
    const loop = startItemRun(loopOn(), "1", 0, T0);
    const held = holdQuestion(
      loop,
      {
        itemId: "1",
        question: "Allow this call? create the report",
        kind: "approval",
        approval: {
          toolName: "create_new_file",
          summary: "report",
          grantKey: "k",
        },
      },
      T0,
    );
    if (!held.ok) throw new Error(held.error);
    return held;
  }

  test("runs again when its question was answered during the run", () => {
    // Found by the sandbox run: the answer came before the run reported waiting
    const held = heldApproval();
    const answered = answerLoop(
      held.loop,
      { questionId: held.question.id, text: "", approve: true },
      T0,
    );
    if (!answered.ok) throw new Error(answered.error);
    expect(answered.answer.route).toBe("steer");
    let loop = finishItemRun(answered.loop, { outcome: "waiting" });
    loop = settleSteeredAnswers(loop, []);
    expect(status(loop, "1")).toBe("pending");
    loop = releaseEmptyWait(loop, "1");
    expect(status(loop, "1")).toBe("pending");
    expect(decideNext(loop, PLAN, ctx())).toEqual({ kind: "run", itemId: "1" });
    expect(answersToDeliver(loop, "1")).toHaveLength(1);
  });

  test("keeps waiting while a blocking question is open", () => {
    const held = heldApproval();
    const loop = releaseEmptyWait(
      finishItemRun(held.loop, { outcome: "waiting" }),
      "1",
    );
    expect(status(loop, "1")).toBe("waiting");
  });

  test("fails when it asked nothing, because nobody could ever answer", () => {
    const loop = releaseEmptyWait(
      runItem(loopOn(), "1", { outcome: "waiting" }),
      "1",
    );
    expect(status(loop, "1")).toBe("failed");
    expect(loop.items[0].summary).toBe(
      "Reported waiting, but no question is open.",
    );
    expect(loop.consecutiveFailures).toBe(1);
  });
});

test("an Allow once grant covers the file or command, not every argument", () => {
  // Found by the sandbox run: the model rewrote the file with slightly
  // different text, so an exact-argument grant never matched
  expect(
    loopGrantKey("create_new_file", { filepath: "a/b.md", contents: "one" }),
  ).toBe(
    loopGrantKey("create_new_file", { filepath: "a\\b.md", contents: "two" }),
  );
  expect(loopGrantKey("run", { command: " npm test " })).toBe(
    loopGrantKey("run", { command: "npm test", cwd: "x" }),
  );
  expect(loopGrantKey("create_new_file", { filepath: "a.md" })).not.toBe(
    loopGrantKey("create_new_file", { filepath: "b.md" }),
  );
  expect(loopGrantKey("mcp", { q: 1 })).not.toBe(loopGrantKey("mcp", { q: 2 }));
});
