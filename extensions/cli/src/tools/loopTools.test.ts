import { createLoop, startItemRun } from "core/util/loopMode.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { consumeLoopTurnEnd, resetLoopMemory } from "../loop/loopSession.js";
import { services } from "../services/index.js";
import {
  createSession,
  getSessionLoop,
  updateSessionLoop,
  updateSessionTaskPlan,
} from "../session.js";

import { finishItemTool, holdQuestionTool } from "./loopTools.js";

const NOW = new Date("2026-11-07T10:00:00Z");
const PLAN = {
  items: [
    { id: "1", text: "One", status: "pending" as const },
    { id: "2", text: "Two", status: "pending" as const },
  ],
  updatedAt: NOW.toISOString(),
};

describe("HoldQuestion and FinishItem", () => {
  beforeEach(async () => {
    // The main session's history, which a turn end applies to
    await services.chatHistory.initialize(createSession([]), false);
    updateSessionTaskPlan(PLAN);
    resetLoopMemory();
  });

  afterEach(() => {
    updateSessionLoop(undefined);
    updateSessionTaskPlan(undefined);
    resetLoopMemory();
  });

  function runningItem() {
    const loop = createLoop(PLAN, { now: NOW, sessionTokens: 0 });
    updateSessionLoop(startItemRun(loop, "2", 0, NOW));
  }

  it("are only for an item the loop is running", async () => {
    await expect(
      holdQuestionTool.run({ question: "Q?", kind: "blocking" }),
    ).rejects.toThrow("only for an item that Loop mode is running");
    await expect(finishItemTool.run({ outcome: "done" })).rejects.toThrow(
      "only for an item that Loop mode is running",
    );
  });

  it("HoldQuestion puts the question in the inbox for the running item", async () => {
    runningItem();
    await expect(
      holdQuestionTool.run({ question: "Q?", kind: "assumption" }),
    ).rejects.toThrow("needs `assumption`");
    const result = await holdQuestionTool.run({
      question: "Tabs or spaces?",
      kind: "assumption",
      assumption: "spaces",
    });
    expect(result).toContain("Question q1 is in the person's inbox");
    expect(getSessionLoop()?.questions[0]).toMatchObject({
      id: "q1",
      itemId: "2",
      kind: "assumption",
    });
    const again = await holdQuestionTool.run({
      question: "Tabs or spaces?",
      kind: "assumption",
      assumption: "spaces",
    });
    expect(again).toContain("You already asked this (q1)");
    // The turn goes on
    expect(consumeLoopTurnEnd()).toBe(false);
  });

  it("FinishItem records the report and ends the turn", async () => {
    runningItem();
    await expect(finishItemTool.run({ outcome: "maybe" })).rejects.toThrow(
      "outcome must be one of done, waiting, stuck, later",
    );
    expect(consumeLoopTurnEnd()).toBe(false);
    const result = await finishItemTool.run({
      outcome: "done",
      summary: "Did two",
      notes: "npm test works",
    });
    expect(result).toBe("Recorded as done. End your turn now.");
    expect(getSessionLoop()?.current?.report).toEqual({
      outcome: "done",
      summary: "Did two",
      notes: "npm test works",
    });
    expect(consumeLoopTurnEnd()).toBe(true);
  });

  it('FinishItem with outcome "later" saves its note for the item\'s return', async () => {
    runningItem();
    await expect(
      finishItemTool.run({ outcome: "later", summary: "Needs Two" }),
    ).rejects.toThrow("needs `reminder`");
    await expect(
      finishItemTool.run({
        outcome: "later",
        summary: "Needs Two",
        reminder: "Tried X; Two adds the API",
      }),
    ).resolves.toContain("comes back after the other items");
    const loop = getSessionLoop()!;
    expect(loop.current?.report?.outcome).toBe("later");
    expect(loop.reminders).toMatchObject([
      { note: "Tried X; Two adds the API", when: "retry", fromItemId: "2" },
    ]);
  });

  it("are described with the CLI's names", () => {
    expect(holdQuestionTool.description).toContain("then call FinishItem");
    expect(finishItemTool.parameters.required).toEqual(["outcome", "summary"]);
    expect(
      Object.values(holdQuestionTool.parameters.properties).every(
        (p) => typeof p.description === "string",
      ),
    ).toBe(true);
  });
});
