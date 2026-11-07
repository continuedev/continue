import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { MessageQueue } from "../../stream/messageQueue.js";
import { QueuedMessages } from "../components/QueuedMessages.js";
import { useQueueView } from "../hooks/useChat.queue.helpers.js";
import { sendRemoteInterrupt } from "../hooks/useChat.remote.helpers.js";

import { MockRemoteServer } from "./mockRemoteServer.js";

/** The same wiring TUIChat uses: the display reads the queue, nothing else. */
const QueueHarness: React.FC<{ queue: MessageQueue }> = ({ queue }) => {
  const view = useQueueView(queue);
  return (
    <QueuedMessages
      items={view.items}
      paused={view.paused}
      steerRequested={view.steerRequested}
    />
  );
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("queued messages display mirrors the queue", () => {
  it("numbers queued messages, oldest first", async () => {
    const queue = new MessageQueue();
    const { lastFrame, unmount } = render(<QueueHarness queue={queue} />);
    try {
      await queue.enqueueMessage("first");
      await queue.enqueueMessage("second");
      await flush();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Queued (2)");
      expect(frame).toContain("1. first");
      expect(frame).toContain("2. second");
    } finally {
      unmount();
    }
  });

  it("shows exactly what is left after a batch is taken", async () => {
    const queue = new MessageQueue();
    await queue.enqueueMessage("plain");
    await queue.enqueueMessage("/compact");
    await queue.enqueueMessage("later");
    const { lastFrame, unmount } = render(<QueueHarness queue={queue} />);
    try {
      queue.takeNextBatch(); // "plain" goes out; the command waits its turn
      await flush();
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("plain");
      expect(frame).toContain("1. /compact");
      expect(frame).toContain("2. later");
    } finally {
      unmount();
    }
  });

  it("follows update, remove, take-back and clear", async () => {
    const queue = new MessageQueue();
    await queue.enqueueMessage("a");
    await queue.enqueueMessage("b");
    const { lastFrame, unmount } = render(<QueueHarness queue={queue} />);
    try {
      const [a, b] = queue.list();
      queue.update(a.id, "a, edited");
      await flush();
      expect(lastFrame()).toContain("1. a, edited");

      queue.remove(b.id);
      await flush();
      expect(lastFrame()).not.toContain("2. b");
      expect(lastFrame()).toContain("Queued (1)");

      queue.takeAll(); // Up arrow takes everything back into the input
      await flush();
      expect(lastFrame()).not.toContain("Queued");

      await queue.enqueueMessage("c");
      queue.clear(); // editing an earlier message or /clear
      await flush();
      expect(lastFrame()).not.toContain("Queued");
    } finally {
      unmount();
    }
  });

  it("stays visible, marked paused, after an interrupt", async () => {
    const queue = new MessageQueue();
    await queue.enqueueMessage("keep me");
    const { lastFrame, unmount } = render(<QueueHarness queue={queue} />);
    try {
      queue.pause();
      await flush();
      expect(lastFrame()).toContain("1. keep me");
      expect(lastFrame()).toContain("paused");
      expect(queue.takeNextBatch()).toEqual([]);
    } finally {
      unmount();
    }
  });

  it("says when the queue will go at the next tool boundary", async () => {
    const queue = new MessageQueue();
    await queue.enqueueMessage("steer");
    const { lastFrame, unmount } = render(<QueueHarness queue={queue} />);
    try {
      queue.requestSteer();
      await flush();
      expect(lastFrame()).toContain("after the current tool calls");
    } finally {
      unmount();
    }
  });

  it("renders nothing for an empty queue", () => {
    const { lastFrame, unmount } = render(<QueuedMessages items={[]} />);
    try {
      expect(lastFrame()).toBe("");
    } finally {
      unmount();
    }
  });
});

describe("remote interrupt", () => {
  it("pauses the server run with POST /pause instead of an empty message", async () => {
    const server = new MockRemoteServer({ responses: ["x".repeat(500)] });
    const port = await server.start();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const remoteUrl = `http://localhost:${port}`;
      await fetch(`${remoteUrl}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hi" }),
      });

      await sendRemoteInterrupt(remoteUrl);

      expect(server.pauseRequests).toBe(1);
      expect(fetchSpy).toHaveBeenLastCalledWith(`${remoteUrl}/pause`, {
        method: "POST",
      });
      const state = await (await fetch(`${remoteUrl}/state`)).json();
      expect(state.isProcessing).toBe(false);
    } finally {
      fetchSpy.mockRestore();
      await server.stop();
    }
  });
});
