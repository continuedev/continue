import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLoopMemory } from "../../loop/loopSession.js";
import { services } from "../../services/index.js";
import {
  getSessionLoop,
  getSessionTaskPlan,
  updateSessionLoop,
} from "../../session.js";

import {
  ENTER,
  ESC,
  heldTurn,
  messageText,
  registerFlowServices,
  renderFlow,
  resetFlowState,
  ScriptedLlm,
  tick,
  toolTurn,
  type,
  waitUntil,
} from "./TUIChat.flowHarness.js";

const DOWN = "\x1b[B";

const planArgs = {
  title: "Add retry",
  plan: "Retry failed fetches with backoff.",
  todos: ["Add a retry helper", "Use it in fetch"],
};

/**
 * The flow spans many turns, each with its own waits; under a loaded run
 * (the whole suite in parallel) the harness's 5 seconds can run out.
 */
const waitLong = (
  predicate: () => boolean,
  describe: string,
  lastFrame: () => string | undefined,
) => waitUntil(predicate, describe, lastFrame, 15_000);

/** The user messages of a request, without the plan block in the prompt. */
function userTexts(request: { messages: any[] }): string[] {
  return request.messages
    .filter((m) => m.role === "user")
    .map((m) => messageText(m).split("<task_list>")[0]);
}

/** The plan block an item's request carries after the item prompt. */
function planBlock(request: { messages: any[] }): string {
  const prompt = request.messages.find(
    (m) => m.role === "user" && messageText(m).includes("<task_list>"),
  );
  const text = prompt ? messageText(prompt) : "";
  return text.slice(text.indexOf("<task_list>"));
}

/**
 * Loop mode through the TUI: "Build in a loop" on a plan starts the loop;
 * each to-do runs on its own turn from its own prompt, reports with
 * FinishItem, and a call that would ask is held in the inbox (/loop) instead
 * of prompting.
 */
describe("TUIChat - Loop mode", () => {
  let cwd: string;

  beforeEach(async () => {
    await resetFlowState();
    updateSessionLoop(undefined);
    resetLoopMemory();
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cn-loop-"));
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
  });

  afterEach(async () => {
    updateSessionLoop(undefined);
    resetLoopMemory();
    await resetFlowState();
    vi.restoreAllMocks();
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("builds a plan item by item, holding an approval in the inbox", async () => {
    const target = path.join(cwd, "retry.ts");
    const write = { filepath: target, content: "export const retry = 1;\n" };
    // Item 2's first run waits here, so the test can see the held state
    const secondRun = heldTurn(
      toolTurn("FinishItem", {
        outcome: "waiting",
        summary: "Needs approval to write retry.ts",
      }),
    );
    const llm = new ScriptedLlm([
      // Plan mode: the plan, then "Build in a loop"
      toolTurn("PresentPlan", planArgs),
      // Item 1
      toolTurn("FinishItem", {
        outcome: "done",
        summary: "Added the helper",
        notes: "run npm test",
      }),
      // Item 2: Write asks in normal mode, so the loop holds it
      toolTurn("Write", write, "call_write_1"),
      secondRun.turn,
      // Item 2 again, after "Allow once": the same call runs this time
      toolTurn("Write", write, "call_write_2"),
      toolTurn("FinishItem", { outcome: "done", summary: "Used it" }),
    ]);
    // A session started in normal mode, then switched to plan mode, so
    // normal mode's policies come back on Build (Write asks, Read does not)
    await registerFlowServices({ llm, mode: "normal" });
    services.toolPermissions.switchMode("plan");
    const ui = renderFlow();
    try {
      await type(ui.stdin, "plan a retry");
      await type(ui.stdin, ENTER);
      await waitLong(
        () => (ui.lastFrame() ?? "").includes("Build in a loop"),
        "the plan question with Build in a loop",
        ui.lastFrame,
      );
      await type(ui.stdin, DOWN);
      await type(ui.stdin, ENTER);

      await waitLong(
        () => llm.requests.length >= 4,
        "item 2's second request",
        () =>
          `${ui.lastFrame()}\nrequests: ${llm.requests.length}\nloop: ${JSON.stringify(getSessionLoop())}\nmode: ${services.toolPermissions.getCurrentMode()}`,
      );
      // The PresentPlan turn ended there: no request carried its result on
      const [, item1, item2] = llm.requests;
      expect(llm.requests).toHaveLength(4);

      // Item 1 ran from its own prompt, in normal mode, with the loop's tools
      expect(userTexts(item1)).toHaveLength(1);
      expect(userTexts(item1)[0]).toContain(
        "Work on this item of the plan, and only this item: Add a retry helper",
      );
      expect(userTexts(item1)[0]).toContain("call FinishItem");
      expect(userTexts(item1)[0]).not.toContain("plan a retry");
      const tools1 = item1.tools.map((t) => t.function.name);
      expect(tools1).toEqual(
        expect.arrayContaining(["FinishItem", "HoldQuestion", "Write"]),
      );
      expect(tools1).not.toContain("TaskList");
      expect(tools1).not.toContain("PresentPlan");

      // Item 2 starts fresh too, and carries item 1's note
      expect(userTexts(item2)).toHaveLength(1);
      expect(userTexts(item2)[0]).toContain("only this item: Use it in fetch");
      // The item prompt carries the plan: its slots, the running item
      // marked, and the notes earlier items left
      expect(planBlock(item1)).toContain(
        "[>] 1. Add a retry helper  <- this item",
      );
      const block2 = planBlock(item2);
      expect(block2).toContain("[x] 1. Add a retry helper: Added the helper");
      expect(block2).toContain("[>] 2. Use it in fetch  <- this item");
      expect(block2).toContain("Notes from earlier items:\n- run npm test");
      expect(userTexts(item2)[0]).not.toContain("run npm test");

      // The Write call did not prompt: it is held as an approval question
      const held = llm.requests[3].messages.find(
        (m) => m.role === "tool" && m.tool_call_id === "call_write_1",
      );
      expect(messageText(held!)).toContain("held as question q1");
      // The plan block stays as the run started, so the next request only
      // extends this one and a prompt cache keeps matching: the model has
      // the held question from the tool result
      expect(planBlock(llm.requests[3])).toBe(block2);
      expect(block2).not.toContain("q1 (approval)");
      expect(llm.requests[3].messages.slice(0, item2.messages.length)).toEqual(
        item2.messages,
      );
      expect(fs.existsSync(target)).toBe(false);
      expect(ui.lastFrame()).not.toContain("Would you like to continue?");

      secondRun.release();
      await waitLong(
        () => getSessionLoop()?.status === "waiting",
        "the loop to wait on the person",
        ui.lastFrame,
      );
      expect(getSessionTaskPlan()?.items.map((i) => i.status)).toEqual([
        "completed",
        "blocked",
      ]);
      await waitLong(
        () =>
          (ui.lastFrame() ?? "").includes("Loop (/loop to answer) Supervised"),
        "the loop strip",
        () => (ui.lastFrame() ?? "").split("\n").slice(-15).join("\n"),
      );
      // Above the prompt: the plan as a checklist, the waiting item with
      // what it waits on, in place of the one-line task strip
      const strip = ui.lastFrame() ?? "";
      expect(strip).toContain("✓ Add a retry helper");
      expect(strip).toContain("! Use it in fetch (Waiting on you: q1)");
      expect(strip).not.toContain("Tasks 1/2");

      // The inbox: Allow once on the held call
      await type(ui.stdin, "/loop");
      await type(ui.stdin, ENTER);
      if (!(ui.lastFrame() ?? "").includes("Allow once (q1)")) {
        await type(ui.stdin, ENTER);
      }
      await waitLong(
        () => (ui.lastFrame() ?? "").includes("Allow once (q1)"),
        "the inbox",
        ui.lastFrame,
      );
      expect(ui.lastFrame()).toContain("Allow this call? Write:");
      // The controls: per item, the re-plan setting and the limits
      expect(ui.lastFrame()).toContain("Run again: 1. Add a retry helper");
      expect(ui.lastFrame()).toContain("Skip 2. Use it in fetch");
      expect(ui.lastFrame()).toContain("Re-plan until done");
      expect(ui.lastFrame()).toContain("Limits: 3 rounds");
      await type(ui.stdin, ENTER);

      await waitLong(
        () => getSessionLoop()?.status === "stopped",
        "the loop to finish",
        ui.lastFrame,
      );
      const loop = getSessionLoop()!;
      expect(loop.stopReason).toBe("done");
      expect(fs.readFileSync(target, "utf-8")).toBe(write.content);
      // The rerun carried the answer
      expect(userTexts(llm.requests[4])[0]).toContain("Allowed.");
      expect(getSessionTaskPlan()?.items.map((i) => i.status)).toEqual([
        "completed",
        "completed",
      ]);
      expect(services.toolPermissions.getCurrentMode()).toBe("normal");

      await type(ui.stdin, ESC);
      await tick(100);
    } finally {
      secondRun.release();
      ui.unmount();
    }
  }, 60_000);

  it("carries a reminder from one item to the next, once", async () => {
    const llm = new ScriptedLlm([
      toolTurn("PresentPlan", planArgs),
      // Item 1 saves what it found, and goes on
      toolTurn("RemindMe", {
        note: "The flaky test is t3",
        when: "next_items",
      }),
      toolTurn("FinishItem", { outcome: "done", summary: "Added" }),
      // Item 2
      toolTurn("FinishItem", { outcome: "done", summary: "Used" }),
    ]);
    await registerFlowServices({ llm, mode: "normal" });
    services.toolPermissions.switchMode("plan");
    const ui = renderFlow();
    try {
      await type(ui.stdin, "plan a retry");
      await type(ui.stdin, ENTER);
      await waitLong(
        () => (ui.lastFrame() ?? "").includes("Build in a loop"),
        "the plan question",
        ui.lastFrame,
      );
      await type(ui.stdin, DOWN);
      await type(ui.stdin, ENTER);
      await waitLong(
        () => getSessionLoop()?.stopReason === "done",
        "the loop to finish",
        () => `${ui.lastFrame()}\n${JSON.stringify(getSessionLoop())}`,
      );

      const [plan, item1, afterSave, item2] = llm.requests;
      const offered = (r: typeof plan) => r.tools.map((t) => t.function.name);
      expect(offered(item1)).toContain("RemindMe");
      // Nobody may be there to answer it, so a loop must never wait on it
      expect(offered(item1)).not.toContain("AskQuestion");
      expect(offered(plan)).toContain("AskQuestion");
      expect(offered(plan)).not.toContain("RemindMe");
      expect(userTexts(item1)[0]).toContain("save it with RemindMe now");
      expect(userTexts(item1)[0]).not.toContain("The flaky test is t3");
      expect(
        afterSave.messages.some(
          (m) => m.role === "tool" && messageText(m).includes("Saved as r1"),
        ),
      ).toBe(true);
      expect(userTexts(item2)[0]).toContain(
        "- (from item 1) The flaky test is t3",
      );
      expect(getSessionLoop()?.reminders?.[0].deliveredAt).toBeDefined();

      await type(ui.stdin, ESC);
      await tick(100);
    } finally {
      ui.unmount();
    }
  }, 60_000);
});
