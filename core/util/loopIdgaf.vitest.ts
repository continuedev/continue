import { describe, expect, test } from "vitest";

import type { LoopState, TaskPlan } from "../index.js";

import {
  createLoop,
  decideNext,
  finishItemRun,
  formatLoopStatus,
  holdQuestion,
  holdQuestionResult,
  LOOP_AUTONOMY_LEVELS,
  loopItemPrompt,
  setLoopAutonomy,
  startItemRun,
} from "./loopMode.js";

const T0 = new Date("2026-11-08T10:00:00Z");
const ctx = { now: T0, sessionTokens: 0 };

const PLAN: TaskPlan = {
  items: ["A", "B"].map((text, i) => ({
    id: String(i + 1),
    text,
    status: "pending" as const,
  })),
  updatedAt: T0.toISOString(),
};

const openQuestions = (loop: LoopState, itemId: string) =>
  loop.questions.filter((q) => q.itemId === itemId && !q.answerId);

const running = (autonomy: LoopState["autonomy"]): LoopState =>
  startItemRun(
    setLoopAutonomy(createLoop(PLAN, { now: T0, sessionTokens: 0 }), autonomy!),
    "1",
    0,
    T0,
  );

function ask(loop: LoopState, kind: string, assumption?: string) {
  const held = holdQuestion(
    loop,
    { itemId: "1", question: "Which database?", kind, assumption },
    T0,
  );
  if (!held.ok) throw new Error(held.error);
  return held;
}

describe("IDGAF", () => {
  test("is a level you can pick", () => {
    expect(LOOP_AUTONOMY_LEVELS).toContain("idgaf");
    expect(formatLoopStatus(running("idgaf"))).toContain("IDGAF");
  });

  test("a blocking question never reaches the inbox", () => {
    const held = ask(running("idgaf"), "blocking");
    expect(openQuestions(held.loop, "1")).toEqual([]);
    expect(held.loop.questions[0]).toMatchObject({
      decidedAlone: true,
      kind: "assumption",
    });
    expect(holdQuestionResult(held.question, held.duplicate)).toContain(
      "Nobody will answer this",
    );
  });

  test("an assumption question needs no stated default", () => {
    expect(
      openQuestions(ask(running("idgaf"), "assumption").loop, "1"),
    ).toEqual([]);
  });

  test("an approval is still held: that is the approval mode's business", () => {
    const held = ask(running("idgaf"), "approval");
    expect(openQuestions(held.loop, "1")).toHaveLength(1);
  });

  test("an item that reports waiting runs again instead of waiting", () => {
    const loop = finishItemRun(running("idgaf"), { outcome: "waiting" });
    expect(loop.items[0].status).toBe("pending");
  });

  test("the item prompt tells it to decide", () => {
    const prompt = loopItemPrompt({
      item: PLAN.items[0],
      answers: [],
      questions: [],
      attempt: 1,
      decideAlone: true,
    });
    expect(prompt).toContain("Make every decision yourself");
    expect(prompt).not.toContain("Ask, rather than decide silently");
  });
});

describe("the other levels hold questions without stopping other items", () => {
  test.each(["supervised", "auto", "unattended"] as const)(
    "%s: the next item runs while one waits on an answer",
    (level) => {
      const held = ask(running(level), "blocking");
      expect(openQuestions(held.loop, "1")).toHaveLength(1);
      const loop = finishItemRun(held.loop, { outcome: "waiting" });
      expect(loop.items[0].status).toBe("waiting");
      expect(decideNext(loop, PLAN, ctx)).toEqual({ kind: "run", itemId: "2" });
    },
  );
});
