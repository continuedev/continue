import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  currentModeEntry,
  isLoopEntry,
  resetLoopMemory,
} from "../../loop/loopSession.js";
import { services } from "../../services/index.js";
import { getSessionLoop, updateSessionLoop } from "../../session.js";

import {
  ENTER,
  ESC,
  heldTurn,
  messageText,
  registerFlowServices,
  renderFlow,
  resetFlowState,
  ScriptedLlm,
  SHIFT_TAB,
  tick,
  toolTurn,
  type,
  waitUntil,
} from "./TUIChat.flowHarness.js";

const planArgs = {
  title: "Add retry",
  plan: "Retry failed fetches with backoff.",
  todos: ["Add a retry helper", "Use it in fetch"],
};

/** Generous waits: the flow spans several turns, and a full run is loaded. */
const waitLong = (
  predicate: () => boolean,
  describe: string,
  lastFrame: () => string | undefined,
) => waitUntil(predicate, describe, lastFrame, 15_000);

function userTexts(request: { messages: any[] }): string[] {
  return request.messages
    .filter((m) => m.role === "user")
    .map((m) => messageText(m))
    .filter((text) => !text.startsWith("<task_list>"));
}

/**
 * Loop as a mode entry: Shift+Tab reaches "loop" after plan. Underneath it
 * is plan mode, so the first message plans; the plan it presents starts the
 * loop without the Build question. Leaving the entry while an item runs
 * stops the loop after that item.
 */
describe("TUIChat - the loop entry", () => {
  let cwd: string;

  beforeEach(async () => {
    await resetFlowState();
    updateSessionLoop(undefined);
    resetLoopMemory();
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cn-loop-entry-"));
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
  });

  afterEach(async () => {
    updateSessionLoop(undefined);
    resetLoopMemory();
    await resetFlowState();
    vi.restoreAllMocks();
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("Shift+Tab to loop, a prompt plans, and the plan starts the loop with no question", async () => {
    const llm = new ScriptedLlm([
      toolTurn("PresentPlan", planArgs),
      toolTurn("FinishItem", { outcome: "done", summary: "Added the helper" }),
      toolTurn("FinishItem", { outcome: "done", summary: "Used it" }),
    ]);
    await registerFlowServices({ llm, mode: "normal" });
    const ui = renderFlow();
    try {
      await tick(300);
      await type(ui.stdin, SHIFT_TAB);
      await type(ui.stdin, SHIFT_TAB);
      await waitLong(
        () => (ui.lastFrame() ?? "").includes("[⟳ loop]"),
        "the loop entry in the status bar",
        ui.lastFrame,
      );
      expect(isLoopEntry()).toBe(true);
      expect(services.toolPermissions.getCurrentMode()).toBe("plan");

      await type(ui.stdin, "plan a retry");
      await type(ui.stdin, ENTER);

      await waitLong(
        () => getSessionLoop()?.status === "stopped",
        "the loop to finish",
        () =>
          `${ui.lastFrame()}\nrequests: ${llm.requests.length}\nloop: ${JSON.stringify(getSessionLoop())}`,
      );
      expect(getSessionLoop()?.stopReason).toBe("done");
      expect(ui.allOutput()).not.toContain("Build this plan?");

      // The first turn planned, in plan mode
      const [planning, item1, item2] = llm.requests;
      const planningTools = planning.tools.map((t) => t.function.name);
      expect(planningTools).toContain("PresentPlan");
      expect(planningTools).not.toContain("Write");
      // Then each to-do ran on its own turn, with the loop's tools
      expect(llm.requests).toHaveLength(3);
      expect(userTexts(item1)[0]).toContain(
        "only this item: Add a retry helper",
      );
      expect(item1.tools.map((t) => t.function.name)).toContain("FinishItem");
      expect(userTexts(item2)[0]).toContain("only this item: Use it in fetch");

      // Still the loop entry: back in plan mode for the next prompt
      expect(currentModeEntry()).toBe("loop");
      expect(services.toolPermissions.getCurrentMode()).toBe("plan");

      await type(ui.stdin, ESC);
      await tick(100);
    } finally {
      ui.unmount();
    }
  }, 60_000);

  it("leaving the loop entry while an item runs stops the loop after it", async () => {
    const firstItem = heldTurn(
      toolTurn("FinishItem", { outcome: "done", summary: "Added the helper" }),
    );
    const llm = new ScriptedLlm([
      toolTurn("PresentPlan", planArgs),
      firstItem.turn,
      toolTurn("FinishItem", { outcome: "done", summary: "Used it" }),
    ]);
    await registerFlowServices({ llm, mode: "normal" });
    services.toolPermissions.switchMode("plan");
    const ui = renderFlow();
    try {
      await tick(300);
      await type(ui.stdin, SHIFT_TAB);
      await waitLong(() => isLoopEntry(), "the loop entry", ui.lastFrame);

      await type(ui.stdin, "plan a retry");
      await type(ui.stdin, ENTER);
      await firstItem.started;
      expect(getSessionLoop()?.current?.itemId).toBe("1");
      expect(services.toolPermissions.getCurrentMode()).toBe("normal");

      // Shift+Tab from loop goes to auto: the item finishes first
      await type(ui.stdin, SHIFT_TAB);
      expect(isLoopEntry()).toBe(false);
      expect(getSessionLoop()?.stopRequested).toBe(true);
      expect(services.toolPermissions.getCurrentMode()).toBe("normal");

      firstItem.release();
      await waitLong(
        () => getSessionLoop()?.status === "stopped",
        "the loop to stop",
        ui.lastFrame,
      );
      const loop = getSessionLoop()!;
      expect(loop.items.map((i) => i.status)).toEqual(["done", "pending"]);
      expect(llm.requests).toHaveLength(2);
      expect(services.toolPermissions.getCurrentMode()).toBe("auto");
      expect(currentModeEntry()).toBe("auto");

      await type(ui.stdin, ESC);
      await tick(100);
    } finally {
      firstItem.release();
      ui.unmount();
    }
  }, 60_000);
});
