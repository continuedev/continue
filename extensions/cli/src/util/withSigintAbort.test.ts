import { vi } from "vitest";

import { withSigintAbort } from "./withSigintAbort.js";

describe("withSigintAbort", () => {
  it("aborts the active operation on SIGINT and prevents its late effect", async () => {
    const listenersBefore = process.listeners("SIGINT");
    const lateEffect = vi.fn();
    let finishOperation: (() => void) | undefined;
    let operationSignal: AbortSignal | undefined;

    const operation = withSigintAbort(async (abortController) => {
      operationSignal = abortController.signal;
      await new Promise<void>((resolve) => {
        finishOperation = resolve;
      });

      if (!abortController.signal.aborted) {
        lateEffect();
      }

      return "finished";
    });

    const addedListeners = process
      .listeners("SIGINT")
      .filter((listener) => !listenersBefore.includes(listener));

    expect(addedListeners).toHaveLength(1);
    addedListeners[0]("SIGINT");
    finishOperation?.();

    await expect(operation).resolves.toBe("finished");
    expect(operationSignal?.aborted).toBe(true);
    expect(lateEffect).not.toHaveBeenCalled();
    expect(process.listeners("SIGINT")).toEqual(listenersBefore);
  });

  it("removes its SIGINT listener when the operation rejects", async () => {
    const listenersBefore = process.listeners("SIGINT");
    const expectedError = new Error("stream failed");

    await expect(
      withSigintAbort(async () => {
        throw expectedError;
      }),
    ).rejects.toBe(expectedError);

    expect(process.listeners("SIGINT")).toEqual(listenersBefore);
  });
});
