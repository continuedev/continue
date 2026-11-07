import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { serviceContainer, services } from "../../services/index.js";
import { ModelService } from "../../services/ModelService.js";
import { SERVICE_NAMES } from "../../services/types.js";
import { setBetaSubagentToolEnabled } from "../../tools/toolsConfig.js";

import {
  ENTER,
  ESC,
  heldTurn,
  messageText,
  registerFlowServices,
  renderFlow,
  resetFlowState,
  ScriptedLlm,
  testModel,
  textTurn,
  tick,
  toolTurn,
  type,
  waitUntil,
} from "./TUIChat.flowHarness.js";

const builder = {
  ...testModel,
  name: "builder",
  model: "builder-model",
  roles: ["subagent"],
  chatOptions: { baseSystemMessage: "You build things." },
} as any;

const lookupIssue = {
  name: "lookup_issue",
  description: "Look up an issue",
  inputSchema: { type: "object", properties: { id: { type: "string" } } },
};

const spawn = toolTurn("Subagent", {
  description: "check the issue",
  prompt: "Read issue 7 and say whether it is fixed",
  subagent_name: "builder",
});

/**
 * Subagents through the TUI: the subagent's "ask" calls reach the parent's
 * permission prompt labelled with its name, and stopping the parent stops
 * the subagent.
 */
describe("TUIChat - subagent permission prompts", () => {
  let runTool: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await resetFlowState();
    setBetaSubagentToolEnabled(true);
    runTool = vi.spyOn(services.mcp, "runTool").mockResolvedValue({
      content: [{ type: "text", text: "issue 7: fixed" }],
    });
  });

  afterEach(async () => {
    await resetFlowState();
    setBetaSubagentToolEnabled(false);
    vi.restoreAllMocks();
  });

  /** Registers services whose subagent "builder" runs on `sub`. */
  async function setup(parent: ScriptedLlm, sub: ScriptedLlm) {
    await registerFlowServices({
      llm: parent,
      extraModels: [builder],
      mcpTools: [lookupIssue],
    });
    const state = serviceContainer.getSync<any>(SERVICE_NAMES.MODEL).value;
    vi.spyOn(ModelService, "getSubagentModels").mockReturnValue([
      {
        llmApi: sub.api,
        model: builder,
        assistant: state.assistant,
        authConfig: null,
      },
    ]);
    const ui = renderFlow();
    await type(ui.stdin, "is issue 7 fixed?");
    await type(ui.stdin, ENTER);
    // The Subagent tool itself asks first
    await waitUntil(
      () => (ui.lastFrame() ?? "").includes("Spawning builder"),
      "the prompt for the Subagent call",
      ui.lastFrame,
    );
    await type(ui.stdin, ENTER);
    return ui;
  }

  /**
   * After a stopped run the parent is itself again: a new message gets an
   * answer, and the parent's own permissions (which offer the Subagent tool)
   * are back in place.
   */
  async function expectNextTurnWorks(
    ui: Awaited<ReturnType<typeof setup>>,
    parent: ScriptedLlm,
  ) {
    const before = parent.requests.length;
    await type(ui.stdin, "never mind");
    await type(ui.stdin, ENTER);
    await waitUntil(
      () => parent.requests.length === before + 1,
      "the next request",
      ui.lastFrame,
    );
    const tools = parent.requests[before].tools.map((t) => t.function.name);
    expect(tools).toContain("Subagent");
    expect(services.chatHistory.isReady()).toBe(true);
    await waitUntil(
      () => (ui.lastFrame() ?? "").includes("Ask anything"),
      "the turn to end",
      ui.lastFrame,
    );
  }

  it("routes the subagent's ask to the parent's prompt, labelled with its name", async () => {
    const parent = new ScriptedLlm([
      spawn,
      textTurn("the subagent says fixed"),
    ]);
    const sub = new ScriptedLlm([
      toolTurn("lookup_issue", { id: "7" }),
      textTurn("Issue 7 is fixed."),
    ]);
    const ui = await setup(parent, sub);
    try {
      await waitUntil(
        () =>
          (ui.lastFrame() ?? "").includes(
            'Subagent "builder" asks to run lookup_issue',
          ),
        "the subagent's labelled prompt",
        ui.lastFrame,
      );
      expect(ui.lastFrame()).toContain("Would you like to continue?");
      expect(runTool).not.toHaveBeenCalled();

      await type(ui.stdin, ENTER);
      await waitUntil(
        () => parent.requests.length === 2,
        "the parent's request after the subagent",
        ui.lastFrame,
      );
      expect(runTool).toHaveBeenCalledWith("lookup_issue", { id: "7" });
      // The subagent's own requests never offer it the Subagent tool
      expect(sub.requests[0].tools.map((t) => t.function.name)).not.toContain(
        "Subagent",
      );

      const result = parent.requests[1].messages.find((m) => m.role === "tool");
      const text = messageText(result!);
      expect(text).toContain("Issue 7 is fixed.");
      expect(text).toContain("status: completed");
      expect(text).not.toContain("issue 7: fixed"); // no tool output

      await waitUntil(
        () => ui.allOutput().includes("the subagent says fixed"),
        "the parent's reply",
        ui.lastFrame,
      );
    } finally {
      ui.unmount();
    }
  });

  it("refusing the subagent's ask stops the parent and the subagent", async () => {
    const parent = new ScriptedLlm([spawn, textTurn("unreachable")]);
    const sub = new ScriptedLlm([
      toolTurn("lookup_issue", { id: "7" }),
      textTurn("unreachable"),
    ]);
    const ui = await setup(parent, sub);
    try {
      await waitUntil(
        () =>
          (ui.lastFrame() ?? "").includes(
            'Subagent "builder" asks to run lookup_issue',
          ),
        "the subagent's labelled prompt",
        ui.lastFrame,
      );
      await type(ui.stdin, ESC);
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("Ask anything"),
        "the prompt to come back",
        ui.lastFrame,
      );
      // The Subagent call finishes after Stop added its message below it;
      // the screen shows how it ended, not the call still running.
      await waitUntil(
        () =>
          (ui.lastFrame() ?? "").includes("(the subagent returned no text)"),
        "the cancelled Subagent call on screen",
        ui.lastFrame,
      );
      const frame = ui.lastFrame() ?? "";
      expect(frame).toContain("Tool canceled");
      expect(frame).not.toContain("(calling)");
      expect(runTool).not.toHaveBeenCalled();
      expect(sub.requests).toHaveLength(1);
      expect(parent.requests).toHaveLength(1);
      await expectNextTurnWorks(ui, parent);
    } finally {
      ui.unmount();
    }
  });

  it("Esc while the subagent works aborts its run", async () => {
    const subTurn = heldTurn(textTurn("unreachable"));
    const parent = new ScriptedLlm([spawn, textTurn("unreachable")]);
    const sub = new ScriptedLlm([subTurn.turn]);
    const ui = await setup(parent, sub);
    try {
      await subTurn.started;
      await tick(100);
      await type(ui.stdin, ESC);
      await waitUntil(
        () => subTurn.wasAborted(),
        "the subagent's request to be aborted",
        ui.lastFrame,
      );
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("Ask anything"),
        "the prompt to come back",
        ui.lastFrame,
      );
      await tick(300);
      expect(sub.requests).toHaveLength(1);
      expect(parent.requests).toHaveLength(1);
      await expectNextTurnWorks(ui, parent);
    } finally {
      ui.unmount();
    }
  });
});
