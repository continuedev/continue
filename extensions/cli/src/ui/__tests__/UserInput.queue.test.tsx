import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messageQueue } from "../../stream/messageQueue.js";
import { UserInput } from "../UserInput.js";

const UP = "\x1b[A";
const ENTER = "\r";
const CTRL_C = "\u0003";
const NL = "\n";

function renderInput(props: Partial<React.ComponentProps<typeof UserInput>>) {
  const onSubmit = vi.fn();
  const result = render(
    React.createElement(UserInput, {
      onSubmit,
      isWaitingForResponse: false,
      inputMode: true,
      onInterrupt: vi.fn(),
      ...props,
    }),
  );
  return { onSubmit, ...result };
}

describe("UserInput and the message queue", () => {
  beforeEach(() => {
    messageQueue.clear();
    messageQueue.resume();
    vi.useFakeTimers();
  });

  afterEach(() => {
    messageQueue.clear();
    messageQueue.resume();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("queues a message typed while the agent works", () => {
    const { onSubmit, stdin, unmount } = renderInput({
      isWaitingForResponse: true,
    });
    try {
      stdin.write("do this next");
      stdin.write("\r");
      expect(onSubmit).not.toHaveBeenCalled();
      expect(messageQueue.list().map((m) => m.message)).toEqual([
        "do this next",
      ]);
      expect(messageQueue.isSteerRequested()).toBe(false);
    } finally {
      unmount();
    }
  });

  it("steers when Enter is pressed again on the empty prompt", () => {
    const { onSubmit, stdin, unmount } = renderInput({
      isWaitingForResponse: true,
    });
    try {
      stdin.write("use b.ts instead");
      stdin.write("\r");
      stdin.write("\r");
      expect(onSubmit).not.toHaveBeenCalled();
      expect(messageQueue.isSteerRequested()).toBe(true);
      expect(messageQueue.getQueueLength()).toBe(1);
    } finally {
      unmount();
    }
  });

  it("sends a paused queue with Enter on the empty prompt when idle", async () => {
    await messageQueue.enqueueMessage("left over");
    messageQueue.pause();
    const { onSubmit, stdin, unmount } = renderInput({});
    try {
      stdin.write("\r");
      expect(onSubmit).toHaveBeenCalledWith("");
    } finally {
      unmount();
    }
  });

  it("does nothing on an empty Enter with nothing queued", () => {
    const { onSubmit, stdin, unmount } = renderInput({});
    try {
      stdin.write("\r");
      expect(onSubmit).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });

  it("Up takes queued messages back into the input, one per line", async () => {
    await messageQueue.enqueueMessage("first");
    await messageQueue.enqueueMessage("second");
    const { stdin, lastFrame, unmount } = renderInput({
      isWaitingForResponse: true,
    });
    try {
      stdin.write(UP);
      await vi.advanceTimersByTimeAsync(20);
      expect(messageQueue.getQueueLength()).toBe(0);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("first");
      expect(frame).toContain("second");

      // Enter queues the edited text again, as one message
      stdin.write("\r");
      expect(messageQueue.list().map((m) => m.message)).toEqual([
        "first\nsecond",
      ]);
    } finally {
      unmount();
    }
  });

  it("Up keeps an image attached to the text taken back", async () => {
    const image = Buffer.from("png");
    await messageQueue.enqueueMessage(
      "see [Image #1]",
      new Map([["[Image #1]", image]]),
    );
    const { stdin, unmount } = renderInput({ isWaitingForResponse: true });
    try {
      stdin.write(UP);
      await vi.advanceTimersByTimeAsync(20);
      stdin.write("\r");
      const [requeued] = messageQueue.list();
      expect(requeued.message).toBe("see [Image #1]");
      expect(requeued.imageMap?.get("[Image #1]")).toBe(image);
    } finally {
      unmount();
    }
  });

  describe("Ctrl+C after Up took the queue back", () => {
    beforeEach(() => {
      // Ctrl+C also signals the process for the two-stage exit
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("puts the prompt, edits included, back at the front of the queue", async () => {
      await messageQueue.enqueueMessage("first thought");
      await messageQueue.enqueueMessage("second thought");
      const { stdin, unmount } = renderInput({ isWaitingForResponse: true });
      try {
        stdin.write(UP);
        expect(messageQueue.getQueueLength()).toBe(0);
        stdin.write(" and more");
        await messageQueue.enqueueMessage("typed later");

        stdin.write(CTRL_C);
        expect(messageQueue.list().map((m) => m.message)).toEqual([
          "first thought" + NL + "second thought and more",
          "typed later",
        ]);
      } finally {
        unmount();
      }
    });

    it("still just clears an ordinary draft", () => {
      const { stdin, unmount } = renderInput({ isWaitingForResponse: true });
      try {
        stdin.write("a draft");
        stdin.write(CTRL_C);
        expect(messageQueue.getQueueLength()).toBe(0);
      } finally {
        unmount();
      }
    });

    it("does not put back what was already sent", () => {
      const { stdin, unmount } = renderInput({ isWaitingForResponse: true });
      try {
        void messageQueue.enqueueMessage("queued");
        stdin.write(UP);
        stdin.write(ENTER);
        expect(messageQueue.list().map((m) => m.message)).toEqual(["queued"]);
        stdin.write("new draft");
        stdin.write(CTRL_C);
        expect(messageQueue.list().map((m) => m.message)).toEqual(["queued"]);
      } finally {
        unmount();
      }
    });
  });
});
