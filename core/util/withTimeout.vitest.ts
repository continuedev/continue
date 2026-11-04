import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimeoutError, withTimeout } from "./withTimeout";

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("passes through a value that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve(3), 100, "x")).resolves.toBe(3);
  });

  it("passes through a rejection", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 100, "x"),
    ).rejects.toThrow("boom");
  });

  it("rejects with a TimeoutError when nothing arrives", async () => {
    const pending = withTimeout(new Promise<void>(() => {}), 100, "Storage");
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(101);
    await assertion;
  });
});
