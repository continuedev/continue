import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { messageQueue } from "../../stream/messageQueue.js";

import {
  ENTER,
  ESC,
  heldTurn,
  messageText,
  registerFlowServices,
  renderFlow,
  resetFlowState,
  ScriptedLlm,
  textTurn,
  tick,
  toolTurn,
  type,
  waitUntil,
} from "./TUIChat.flowHarness.js";

/**
 * Message queue and steering through the TUI: Enter while the agent works
 * queues, Enter again on the empty prompt steers the queue into the running
 * turn at the next tool boundary, and Esc pauses the queue until the next
 * message.
 */
describe("TUIChat - message queue and steering", () => {
  beforeEach(resetFlowState);
  afterEach(resetFlowState);

  it("answers a message with the scripted model", async () => {
    const llm = new ScriptedLlm([textTurn("hello from the model")]);
    await registerFlowServices({ llm });
    const ui = renderFlow();
    try {
      await type(ui.stdin, "hi");
      await type(ui.stdin, ENTER);
      await waitUntil(
        () => ui.allOutput().includes("hello from the model"),
        "the reply",
        ui.lastFrame,
      );
      expect(llm.requests).toHaveLength(1);
      expect(messageText(llm.requests[0].messages.at(-1)!)).toContain("hi");
    } finally {
      ui.unmount();
    }
  });

  it("queues messages typed while the agent works and sends them as one when the turn ends", async () => {
    const first = heldTurn(textTurn("first reply"));
    const llm = new ScriptedLlm([first.turn, textTurn("second reply")]);
    await registerFlowServices({ llm });
    const ui = renderFlow();
    try {
      await type(ui.stdin, "start");
      await type(ui.stdin, ENTER);
      await first.started;

      await type(ui.stdin, "next one");
      await type(ui.stdin, ENTER);
      await type(ui.stdin, "and another");
      await type(ui.stdin, ENTER);

      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("Queued (2)"),
        "the queue to show both messages",
        ui.lastFrame,
      );
      const frame = ui.lastFrame() ?? "";
      expect(frame).toContain("sent when the turn ends");
      expect(frame).toContain("1. next one");
      expect(frame).toContain("2. and another");
      expect(llm.requests).toHaveLength(1);

      first.release();
      await waitUntil(
        () => llm.requests.length === 2,
        "the queued messages to be sent",
        ui.lastFrame,
      );
      const sent = llm.requests[1].messages.filter((m) => m.role === "user");
      expect(messageText(sent.at(-1)!)).toBe("next one\n\nand another");

      await waitUntil(
        () => ui.allOutput().includes("second reply"),
        "the reply to the queued messages",
        ui.lastFrame,
      );
      expect(messageQueue.getQueueLength()).toBe(0);
      expect(ui.lastFrame()).not.toContain("Queued (");
      await tick(200);
      expect(llm.requests).toHaveLength(2);
    } finally {
      ui.unmount();
    }
  });

  it("steers a queued message into the running turn after the tool results", async () => {
    const first = heldTurn(toolTurn("Read", { filepath: "package.json" }));
    const llm = new ScriptedLlm([first.turn, textTurn("switching to b.ts")]);
    await registerFlowServices({ llm });
    const ui = renderFlow();
    try {
      await type(ui.stdin, "fix a.ts");
      await type(ui.stdin, ENTER);
      await first.started;

      await type(ui.stdin, "use b.ts instead");
      await type(ui.stdin, ENTER);
      // Enter on the empty prompt asks to steer
      await type(ui.stdin, ENTER);
      await waitUntil(
        () =>
          (ui.lastFrame() ?? "").includes(
            "sending after the current tool calls",
          ),
        "the steer hint",
        ui.lastFrame,
      );
      expect(messageQueue.isSteerRequested()).toBe(true);

      first.release();
      await waitUntil(
        () => llm.requests.length === 2,
        "the request after the tool boundary",
        ui.lastFrame,
      );

      // Same turn: assistant(tool call), the tool's result, then the steer
      const messages = llm.requests[1].messages.filter(
        (m) => m.role !== "system",
      );
      const roles = messages.map((m) => m.role);
      expect(roles.slice(-3)).toEqual(["assistant", "tool", "user"]);
      expect(messages.at(-2)!.tool_call_id).toBe("call_Read");
      expect(messageText(messages.at(-2)!)).toContain("@continuedev/cli");
      expect(messageText(messages.at(-1)!)).toBe("use b.ts instead");
      expect(messageQueue.getQueueLength()).toBe(0);

      await waitUntil(
        () => ui.allOutput().includes("switching to b.ts"),
        "the steered reply",
        ui.lastFrame,
      );
      // The steered message was delivered in the turn, not again after it
      await tick(300);
      expect(llm.requests).toHaveLength(2);
      expect(ui.lastFrame()).not.toContain("Queued (");
    } finally {
      ui.unmount();
    }
  });

  it("Esc pauses the queue, and the next message sends it along", async () => {
    const first = heldTurn(textTurn("never shown"));
    const llm = new ScriptedLlm([first.turn, textTurn("after the stop")]);
    await registerFlowServices({ llm });
    const ui = renderFlow();
    try {
      await type(ui.stdin, "start");
      await type(ui.stdin, ENTER);
      await first.started;

      await type(ui.stdin, "queued while working");
      await type(ui.stdin, ENTER);
      await type(ui.stdin, ESC);

      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("paused"),
        "the paused queue",
        ui.lastFrame,
      );
      expect(messageQueue.isPaused()).toBe(true);
      expect(messageQueue.getQueueLength()).toBe(1);
      await tick(300);
      expect(llm.requests).toHaveLength(1);

      await type(ui.stdin, "then this");
      await type(ui.stdin, ENTER);
      await waitUntil(
        () => llm.requests.length === 2,
        "the resumed queue to be sent",
        ui.lastFrame,
      );
      const sent = llm.requests[1].messages.filter((m) => m.role === "user");
      expect(messageText(sent.at(-1)!)).toBe(
        "queued while working\n\nthen this",
      );
      expect(messageQueue.isPaused()).toBe(false);
      await waitUntil(
        () => ui.allOutput().includes("after the stop"),
        "the reply",
        ui.lastFrame,
      );
      expect(ui.allOutput()).not.toContain("never shown");
    } finally {
      ui.unmount();
    }
  });

  it("Enter on the empty prompt after Esc resumes and sends the paused queue", async () => {
    const first = heldTurn(textTurn("never shown"));
    const llm = new ScriptedLlm([first.turn, textTurn("resumed")]);
    await registerFlowServices({ llm });
    const ui = renderFlow();
    try {
      await type(ui.stdin, "start");
      await type(ui.stdin, ENTER);
      await first.started;
      await type(ui.stdin, "keep this");
      await type(ui.stdin, ENTER);
      await type(ui.stdin, ESC);
      await waitUntil(
        () => messageQueue.isPaused(),
        "the queue to pause",
        ui.lastFrame,
      );

      await type(ui.stdin, ENTER);
      await waitUntil(
        () => llm.requests.length === 2,
        "the paused queue to be sent",
        ui.lastFrame,
      );
      const users = llm.requests[1].messages.filter((m) => m.role === "user");
      expect(users.map(messageText)).toEqual(["start", "keep this"]);
      await waitUntil(
        () => ui.allOutput().includes("resumed"),
        "the reply",
        ui.lastFrame,
      );
      expect(messageQueue.getQueueLength()).toBe(0);
    } finally {
      ui.unmount();
    }
  });
});
