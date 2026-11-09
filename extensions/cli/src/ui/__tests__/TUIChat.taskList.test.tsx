import { buildTaskPlan } from "core/util/taskPlan.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getSessionTaskPlan, updateSessionTaskPlan } from "../../session.js";

import {
  ENTER,
  messageText,
  registerFlowServices,
  renderFlow,
  resetFlowState,
  ScriptedLlm,
  textTurn,
  toolTurn,
  type,
  waitUntil,
} from "./TUIChat.flowHarness.js";

/**
 * The TaskList tool (and its Checklist alias) through the TUI: the list is
 * shown above the prompt and in the tool result, and every request that
 * offers the tool ends with the `<task_list>` block. Only a session that
 * already has a list offers the tool in agent mode (plan mode makes its list
 * through PresentPlan), so each test starts from a one-item list, seeded
 * after the app has mounted and started its own session.
 */
describe("TUIChat - task list", () => {
  beforeEach(resetFlowState);
  afterEach(resetFlowState);

  /** A list the model then rewrites: what makes the tool available. */
  function seedTaskList(text = "Read the code") {
    const built = buildTaskPlan([{ text, status: "pending" }], {
      now: new Date(),
    });
    if (!built.ok) throw new Error(built.error);
    updateSessionTaskPlan(built.plan);
  }

  it("shows the list the model writes and sends it as the last block of the next request", async () => {
    const llm = new ScriptedLlm([
      toolTurn("TaskList", {
        items: [
          { text: "Read the code", status: "completed" },
          {
            text: "Fix the bug",
            status: "in_progress",
            activeForm: "Fixing the bug",
          },
          { text: "Add a test", status: "pending" },
        ],
      }),
      textTurn("list written"),
    ]);
    await registerFlowServices({ llm, mode: "normal" });
    const ui = renderFlow();
    seedTaskList();
    try {
      await type(ui.stdin, "fix the bug");
      await type(ui.stdin, ENTER);
      await waitUntil(
        () => ui.allOutput().includes("list written"),
        "the reply after the tool call",
        ui.lastFrame,
      );

      // The first request offers the tool and ends with the seeded list
      expect(llm.requests).toHaveLength(2);
      const offered = llm.requests[0].tools.map((t) => t.function.name);
      expect(offered).toContain("TaskList");
      expect(offered).not.toContain("Checklist");
      const firstTail = messageText(llm.requests[0].messages.at(-1)!);
      expect(firstTail).toContain("<task_list>");
      expect(firstTail).toContain("[ ] 1. Read the code");

      // The second request ends with the list, after the tool result
      const second = llm.requests[1].messages;
      const tail = messageText(second.at(-1)!);
      expect(tail.startsWith("<task_list>")).toBe(true);
      expect(tail).toContain("[x] 1. Read the code");
      expect(tail).toContain("[>] 2. Fix the bug");
      expect(tail).toContain("[ ] 3. Add a test");
      expect(second.at(-2)!.role).toBe("tool");
      const blocks = second.filter((m) =>
        messageText(m).includes("<task_list>"),
      );
      expect(blocks).toHaveLength(1);

      // The strip above the prompt shows progress and the current item
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("1/3 Fixing the bug"),
        "the task progress strip",
        ui.lastFrame,
      );
      expect(ui.lastFrame()).toContain("Tasks");
      // The tool result is the short confirmation
      expect(ui.allOutput()).toContain(
        "Task list saved: 1/3 done. In progress: 2. Fix the bug.",
      );
    } finally {
      ui.unmount();
    }
  });

  it("runs the Checklist alias into the same task list", async () => {
    const llm = new ScriptedLlm([
      toolTurn("Checklist", {
        checklist: "- [x] Write the parser\n- [ ] Wire it up",
      }),
      textTurn("checklist written"),
    ]);
    await registerFlowServices({ llm, mode: "normal" });
    const ui = renderFlow();
    // The item the checklist ticks, so the list stays these two
    seedTaskList("Write the parser");
    try {
      await type(ui.stdin, "track this");
      await type(ui.stdin, ENTER);
      await waitUntil(
        () => ui.allOutput().includes("checklist written"),
        "the reply after the alias call",
        ui.lastFrame,
      );

      expect(getSessionTaskPlan()?.items.map((i) => i.text)).toEqual([
        "Write the parser",
        "Wire it up",
      ]);
      const tail = messageText(llm.requests[1].messages.at(-1)!);
      expect(tail.startsWith("<task_list>")).toBe(true);
      expect(tail).toContain("[ ] 2. Wire it up");
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("1/2 Wire it up"),
        "the task progress strip",
        ui.lastFrame,
      );
    } finally {
      ui.unmount();
    }
  });
});
