import { describe, expect, it, vi } from "vitest";

vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLevel: vi.fn(),
    configureHeadlessMode: vi.fn(),
    getLogPath: vi.fn(),
    getSessionId: vi.fn(),
  },
}));

import {
  isQueuedCommand,
  mergeQueuedMessages,
  MessageQueue,
  messageQueue,
  renamePlaceholders,
} from "./messageQueue.js";

async function queueWith(...messages: string[]): Promise<MessageQueue> {
  const queue = new MessageQueue();
  for (const message of messages) {
    await queue.enqueueMessage(message);
  }
  return queue;
}

describe("messageQueue", () => {
  it("enqueues and emits messageQueued", async () => {
    const event = new Promise<any>((resolve) =>
      messageQueue.once("messageQueued", resolve),
    );

    const ok = await messageQueue.enqueueMessage("hello world");
    expect(ok).toBe(true);
    expect(messageQueue.getQueueLength()).toBe(1);

    const queued = await event;
    expect(queued.message).toBe("hello world");
    messageQueue.clear();
  });

  it("gives each message a stable, distinct id", async () => {
    const queue = await queueWith("a", "b");
    const [a, b] = queue.list();
    expect(a.id).not.toBe(b.id);
    queue.remove(a.id);
    expect(queue.list()[0].id).toBe(b.id);
  });

  it("list() is a snapshot, not the live array", async () => {
    const queue = await queueWith("a");
    const snapshot = queue.list();
    snapshot.pop();
    expect(queue.getQueueLength()).toBe(1);
  });

  it("removes, updates and clears by id", async () => {
    const queue = await queueWith("a", "b", "c");
    const [a, b, c] = queue.list();

    expect(queue.update(b.id, "B")).toBe(true);
    expect(queue.remove(a.id)).toBe(true);
    expect(queue.remove("missing")).toBe(false);
    expect(queue.update("missing", "x")).toBe(false);
    expect(queue.list().map((m) => [m.id, m.message])).toEqual([
      [b.id, "B"],
      [c.id, "c"],
    ]);

    queue.clear();
    expect(queue.list()).toEqual([]);
  });

  it("emits changed with the new list on every mutation", async () => {
    const queue = new MessageQueue();
    const seen: string[][] = [];
    queue.on("changed", (items) => seen.push(items.map((m: any) => m.message)));

    await queue.enqueueMessage("a");
    await queue.enqueueMessage("b");
    queue.update(queue.list()[0].id, "A");
    queue.remove(queue.list()[1].id);
    queue.takeAll();

    expect(seen).toEqual([["a"], ["a", "b"], ["A", "b"], ["A"], []]);
  });

  describe("end of turn", () => {
    it("takes every plain message as one batch", async () => {
      const queue = await queueWith("one", "two", "three");
      const batch = queue.takeNextBatch();
      expect(batch.map((m) => m.message)).toEqual(["one", "two", "three"]);
      expect(queue.getQueueLength()).toBe(0);
    });

    it("holds commands back and runs them one at a time, in order", async () => {
      const queue = await queueWith("one", "/compact", "two", "!ls", "three");
      const batches: string[][] = [];
      for (let b = queue.takeNextBatch(); b.length; b = queue.takeNextBatch()) {
        batches.push(b.map((m) => m.message));
      }
      expect(batches).toEqual([
        ["one"],
        ["/compact"],
        ["two"],
        ["!ls"],
        ["three"],
      ]);
    });

    it("sends nothing while paused, and keeps the messages", async () => {
      const queue = await queueWith("one");
      queue.pause();
      expect(queue.takeNextBatch()).toEqual([]);
      expect(queue.getQueueLength()).toBe(1);

      queue.resume();
      expect(queue.takeNextBatch().map((m) => m.message)).toEqual(["one"]);
    });
  });

  describe("steering", () => {
    it("does nothing until steering is requested", async () => {
      const queue = await queueWith("one");
      expect(queue.takeSteerMessages()).toEqual([]);
      expect(queue.getQueueLength()).toBe(1);
    });

    it("hands over plain messages and leaves commands for the end of the turn", async () => {
      const queue = await queueWith("one", "/help", "two");
      expect(queue.requestSteer()).toBe(true);
      expect(queue.isSteerRequested()).toBe(true);

      const taken = queue.takeSteerMessages();
      expect(taken.map((m) => m.message)).toEqual(["one", "two"]);
      expect(queue.list().map((m) => m.message)).toEqual(["/help"]);
      expect(queue.isSteerRequested()).toBe(false);
      // One request delivers once.
      expect(queue.takeSteerMessages()).toEqual([]);
    });

    it("refuses to steer with nothing but commands", async () => {
      const queue = await queueWith("/help");
      expect(queue.requestSteer()).toBe(false);
      expect(queue.isSteerRequested()).toBe(false);
    });

    it("is cancelled by pause, clear and take-back", async () => {
      const queue = await queueWith("one");
      queue.requestSteer();
      queue.pause();
      expect(queue.isSteerRequested()).toBe(false);

      queue.requestSteer();
      expect(queue.isPaused()).toBe(false);
      queue.clear();
      expect(queue.isSteerRequested()).toBe(false);

      await queue.enqueueMessage("two");
      queue.requestSteer();
      queue.takeAll();
      expect(queue.isSteerRequested()).toBe(false);
    });
  });
});

describe("isQueuedCommand", () => {
  it("treats slash and shell commands as commands", () => {
    expect(isQueuedCommand("/compact")).toBe(true);
    expect(isQueuedCommand("  !ls")).toBe(true);
    expect(isQueuedCommand("please fix /src")).toBe(false);
  });
});

describe("mergeQueuedMessages", () => {
  it("returns undefined for nothing", () => {
    expect(mergeQueuedMessages([])).toBeUndefined();
  });

  it("joins messages with blank lines", () => {
    expect(
      mergeQueuedMessages([{ message: "first" }, { message: "second" }]),
    ).toEqual({ message: "first\n\nsecond", imageMap: undefined });
  });

  it("renumbers images so each stays with its own text", () => {
    const a = Buffer.from("a");
    const b = Buffer.from("b");
    const c = Buffer.from("c");
    const merged = mergeQueuedMessages([
      { message: "look [Image #1]", imageMap: new Map([["[Image #1]", a]]) },
      {
        message: "and [Image #1] vs [Image #2]",
        imageMap: new Map([
          ["[Image #1]", b],
          ["[Image #2]", c],
        ]),
      },
    ]);

    expect(merged?.message).toBe(
      "look [Image #1]\n\nand [Image #2] vs [Image #3]",
    );
    expect(merged?.imageMap?.get("[Image #1]")).toBe(a);
    expect(merged?.imageMap?.get("[Image #2]")).toBe(b);
    expect(merged?.imageMap?.get("[Image #3]")).toBe(c);
  });
});

describe("renamePlaceholders", () => {
  it("renames in one pass, so chained renames do not cascade", () => {
    const renames = new Map([
      ["[Image #1]", "[Image #2]"],
      ["[Image #2]", "[Image #3]"],
    ]);
    expect(renamePlaceholders("[Image #1] [Image #2]", renames)).toBe(
      "[Image #2] [Image #3]",
    );
  });
});
