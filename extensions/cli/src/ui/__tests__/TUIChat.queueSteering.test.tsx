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

const DOWN = "\u001b[B";
const DELETE = "\u001b[3~";

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

  it("a second Enter steers now: the reply ends where it is and the queue goes at once", async () => {
    const first = heldTurn(textTurn("a very long essay"));
    const llm = new ScriptedLlm([first.turn, textTurn("steered reply here")]);
    await registerFlowServices({ llm });
    const ui = renderFlow();
    try {
      await type(ui.stdin, "write an essay");
      await type(ui.stdin, ENTER);
      await first.started;

      await type(ui.stdin, "no, just say hi");
      await type(ui.stdin, ENTER);
      // The first Enter on the empty prompt steers at the next tool boundary
      await type(ui.stdin, ENTER);
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("Enter again to steer now"),
        "the steer-now hint",
        ui.lastFrame,
      );
      expect(llm.requests).toHaveLength(1);

      // The second steers now
      await type(ui.stdin, ENTER);
      await waitUntil(
        () => llm.requests.length === 2,
        "the steered request",
        ui.lastFrame,
      );
      expect(first.wasAborted()).toBe(true);
      const sent = llm.requests[1].messages.filter((m) => m.role === "user");
      expect(messageText(sent.at(-1)!)).toBe("no, just say hi");
      expect(messageQueue.isPaused()).toBe(false);
      expect(messageQueue.getQueueLength()).toBe(0);

      await waitUntil(
        () => ui.allOutput().includes("steered reply here"),
        "the steered reply",
        ui.lastFrame,
      );
      expect(ui.allOutput()).not.toContain("a very long essay");
      await tick(300);
      expect(llm.requests).toHaveLength(2);
    } finally {
      ui.unmount();
    }
  });

  it("Down selects a queued message; + and - reorder it, Delete removes it, Esc leaves without stopping", async () => {
    const first = heldTurn(textTurn("first reply"));
    const llm = new ScriptedLlm([first.turn, textTurn("second reply")]);
    await registerFlowServices({ llm });
    const ui = renderFlow();
    const queued = () => messageQueue.list().map((m) => m.message);
    try {
      await type(ui.stdin, "start");
      await type(ui.stdin, ENTER);
      await first.started;
      for (const text of ["alpha", "beta", "gamma", "delta"]) {
        await type(ui.stdin, text);
        await type(ui.stdin, ENTER);
      }
      expect(queued()).toEqual(["alpha", "beta", "gamma", "delta"]);

      // Down on the empty prompt highlights the first message
      await type(ui.stdin, DOWN);
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("+/- move"),
        "the reorder hint",
        ui.lastFrame,
      );
      expect(ui.lastFrame()).toContain("› 1. alpha");

      // - moves it down twice; the highlight follows it
      await type(ui.stdin, "-");
      await type(ui.stdin, "-");
      expect(queued()).toEqual(["beta", "gamma", "alpha", "delta"]);
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("› 3. alpha"),
        "the highlight on the moved message",
        ui.lastFrame,
      );

      // Down to delta, + moves it up one
      await type(ui.stdin, DOWN);
      await type(ui.stdin, "+");
      expect(queued()).toEqual(["beta", "gamma", "delta", "alpha"]);

      // Delete removes it; the highlight stays at that place
      await type(ui.stdin, DELETE);
      expect(queued()).toEqual(["beta", "gamma", "alpha"]);
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("› 3. alpha"),
        "the highlight after deleting",
        ui.lastFrame,
      );

      // Esc leaves the queue and does not stop the agent
      await type(ui.stdin, ESC);
      await waitUntil(
        () => !(ui.lastFrame() ?? "").includes("+/- move"),
        "the queue to be left",
        ui.lastFrame,
      );
      expect(first.wasAborted()).toBe(false);
      expect(messageQueue.isPaused()).toBe(false);

      // Sent merged, in the new order, when the turn ends
      first.release();
      await waitUntil(
        () => llm.requests.length === 2,
        "the queued messages to be sent",
        ui.lastFrame,
      );
      const sent = llm.requests[1].messages.filter((m) => m.role === "user");
      expect(messageText(sent.at(-1)!)).toBe("beta\n\ngamma\n\nalpha");
    } finally {
      ui.unmount();
    }
  });

  it("Enter on a selected message takes just that one back into the prompt", async () => {
    const first = heldTurn(textTurn("first reply"));
    const llm = new ScriptedLlm([first.turn, textTurn("second reply")]);
    await registerFlowServices({ llm });
    const ui = renderFlow();
    try {
      await type(ui.stdin, "start");
      await type(ui.stdin, ENTER);
      await first.started;
      await type(ui.stdin, "keep me");
      await type(ui.stdin, ENTER);
      await type(ui.stdin, "edit me");
      await type(ui.stdin, ENTER);

      await type(ui.stdin, DOWN);
      await type(ui.stdin, DOWN);
      await type(ui.stdin, ENTER);
      expect(messageQueue.list().map((m) => m.message)).toEqual(["keep me"]);
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("edit me"),
        "the message back in the prompt",
        ui.lastFrame,
      );
      first.release();
    } finally {
      ui.unmount();
    }
  });

  it("rewinding with the edit picker keeps the queue, paused, instead of dropping it", async () => {
    const second = heldTurn(textTurn("never finished"));
    const llm = new ScriptedLlm([
      textTurn("reply one"),
      second.turn,
      textTurn("reply to the edit"),
    ]);
    await registerFlowServices({ llm });
    const ui = renderFlow();
    try {
      await type(ui.stdin, "start");
      await type(ui.stdin, ENTER);
      await waitUntil(
        () => ui.allOutput().includes("reply one"),
        "the first reply",
        ui.lastFrame,
      );
      await type(ui.stdin, "second");
      await type(ui.stdin, ENTER);
      await second.started;
      await type(ui.stdin, "carefully thought out");
      await type(ui.stdin, ENTER);
      expect(messageQueue.getQueueLength()).toBe(1);

      // Esc stops the agent; two more open the edit picker
      await type(ui.stdin, ESC);
      await waitUntil(
        () => messageQueue.isPaused(),
        "the queue to pause",
        ui.lastFrame,
      );
      await type(ui.stdin, ESC);
      await type(ui.stdin, ESC);
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("Edit Message"),
        "the edit picker",
        ui.lastFrame,
      );
      // Edit the selected message and send it
      await type(ui.stdin, ENTER);
      await type(ui.stdin, " again");
      await type(ui.stdin, ENTER);
      await waitUntil(
        () => llm.requests.length === 3,
        "the edited message to be sent",
        ui.lastFrame,
      );
      await waitUntil(
        () => ui.allOutput().includes("reply to the edit"),
        "the reply to the edit",
        ui.lastFrame,
      );

      // The queued message is still there, paused, not sent with the edit
      expect(messageQueue.list().map((m) => m.message)).toEqual([
        "carefully thought out",
      ]);
      expect(messageQueue.isPaused()).toBe(true);
      const sent = llm.requests[2].messages.filter((m) => m.role === "user");
      expect(messageText(sent.at(-1)!)).not.toContain("carefully");
      await tick(300);
      expect(llm.requests).toHaveLength(3);
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
