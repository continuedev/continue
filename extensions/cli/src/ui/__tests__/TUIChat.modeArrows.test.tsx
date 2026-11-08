import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { services } from "../../services/index.js";
import { messageQueue } from "../../stream/messageQueue.js";

import {
  registerFlowServices,
  renderFlow,
  resetFlowState,
  ScriptedLlm,
  type,
  waitUntil,
} from "./TUIChat.flowHarness.js";

const LEFT = "\u001b[D";
const RIGHT = "\u001b[C";

const mode = () => services.toolPermissions.getCurrentMode();

/**
 * Left and Right on an empty prompt, where they move nothing, step back and
 * forward through the modes (as Shift+Tab steps forward). With text in the
 * prompt they move the cursor as before.
 */
describe("TUIChat - Left and Right switch modes on an empty prompt", () => {
  beforeEach(resetFlowState);
  afterEach(resetFlowState);

  it("steps forward with Right and back with Left, wrapping around", async () => {
    await registerFlowServices({ llm: new ScriptedLlm([]) });
    const ui = renderFlow();
    try {
      expect(mode()).toBe("normal");

      await type(ui.stdin, RIGHT);
      await waitUntil(() => mode() === "plan", "plan mode", ui.lastFrame);
      await type(ui.stdin, RIGHT);
      await waitUntil(() => mode() === "auto", "auto mode", ui.lastFrame);
      await type(ui.stdin, RIGHT);
      await waitUntil(
        () => mode() === "normal",
        "back to normal",
        ui.lastFrame,
      );

      await type(ui.stdin, LEFT);
      await waitUntil(
        () => mode() === "auto",
        "auto, going back",
        ui.lastFrame,
      );
      await type(ui.stdin, LEFT);
      await waitUntil(
        () => mode() === "plan",
        "plan, going back",
        ui.lastFrame,
      );
    } finally {
      ui.unmount();
    }
  });

  it("leaves the mode alone while a queued message is selected", async () => {
    await registerFlowServices({ llm: new ScriptedLlm([]) });
    const ui = renderFlow();
    try {
      await messageQueue.enqueueMessage("queued");
      messageQueue.select(messageQueue.list()[0].id);
      await type(ui.stdin, RIGHT);
      expect(mode()).toBe("normal");
    } finally {
      ui.unmount();
    }
  });

  it("moves the cursor instead when the prompt has text", async () => {
    await registerFlowServices({ llm: new ScriptedLlm([]) });
    const ui = renderFlow();
    try {
      await type(ui.stdin, "ab");
      await type(ui.stdin, LEFT);
      await type(ui.stdin, "X");
      await waitUntil(
        () => (ui.lastFrame() ?? "").includes("aXb"),
        "the text typed at the moved cursor",
        ui.lastFrame,
      );
      await type(ui.stdin, RIGHT);
      expect(mode()).toBe("normal");
    } finally {
      ui.unmount();
    }
  });
});
