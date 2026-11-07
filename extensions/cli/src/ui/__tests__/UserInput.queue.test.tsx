import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messageQueue } from "../../stream/messageQueue.js";
import { UserInput } from "../UserInput.js";

const UP = "\x1b[A";

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
});
