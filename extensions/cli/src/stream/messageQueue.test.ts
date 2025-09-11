import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { messageQueue } from "./messageQueue.js";

describe("messageQueue", () => {
  beforeEach(() => {
    // Drain any leftover items from previous tests
    while (messageQueue.getAllQueuedMessages()) {}
  });

  it("enqueues and emits messageQueued", async () => {
    const event = new Promise<any>((resolve) =>
      messageQueue.once("messageQueued", resolve),
    );

    const ok = await messageQueue.enqueueMessage("hello world");
    expect(ok).toBe(true);
    expect(messageQueue.getQueueLength()).toBe(1);

    const queued = await event;
    expect(queued.message).toBe("hello world");
  });

  it("combines messages, merges image maps, writes history, and clears queue", async () => {
    const bufA = Buffer.from("A");
    const bufB = Buffer.from("B");

    const img1 = new Map<string, Buffer>([["a", bufA]]);
    const img2 = new Map<string, Buffer>([["b", bufB]]);

    const history = { addEntry: vi.fn() } as any;

    await messageQueue.enqueueMessage("one", img1);
    await messageQueue.enqueueMessage("two", img2, history);

    const combined = messageQueue.getAllQueuedMessages();
    expect(combined).toBeTruthy();
    expect(combined!.message).toBe("one\ntwo");
    expect(combined!.imageMap).toBeDefined();
    expect(combined!.imageMap!.get("a")).toEqual(bufA);
    expect(combined!.imageMap!.get("b")).toEqual(bufB);

    // queue should be cleared
    expect(messageQueue.getQueueLength()).toBe(0);

    // input history should receive the combined message
    expect(history.addEntry).toHaveBeenCalledWith("one\ntwo");
  });
});
