import { vi } from "vitest";

import { createMinimalTestContext } from "../test-helpers/ui-test-context.js";

import { withExponentialBackoff } from "./exponentialBackoff.js";

describe("withExponentialBackoff", () => {
  let context: any;
  let abortController: AbortController;

  beforeEach(() => {
    context = createMinimalTestContext();
    abortController = new AbortController();
    vi.clearAllMocks();
  });

  afterEach(() => {
    context.cleanup();
  });

  it("should successfully yield all values from generator", async () => {
    const mockData = ["chunk1", "chunk2", "chunk3"];
    const generatorFactory = vi.fn(async (retryAbortSignal: AbortSignal) => {
      return (async function* () {
        for (const chunk of mockData) {
          yield chunk;
        }
      })();
    });

    const results: string[] = [];
    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal,
    );

    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(mockData);
    expect(generatorFactory).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable errors during generator creation", async () => {
    let callCount = 0;
    const generatorFactory = vi.fn(async (retryAbortSignal: AbortSignal) => {
      callCount++;
      if (callCount === 1) {
        const error = new Error("Connection reset");
        (error as any).code = "ECONNRESET";
        throw error;
      }
      return (async function* () {
        yield "success";
      })();
    });

    const results: string[] = [];
    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal,
      {
        maxRetries: 2,
        initialDelay: 10, // Short delay for testing
      },
    );

    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(["success"]);
    expect(generatorFactory).toHaveBeenCalledTimes(2);
  });

  it("should not retry on non-retryable errors", async () => {
    const generatorFactory = vi.fn(async (retryAbortSignal: AbortSignal) => {
      const error = new Error("Bad request");
      (error as any).status = 400;
      throw error;
    });

    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal,
    );

    await expect(async () => {
      for await (const chunk of generator) {
        // Should not reach here
      }
    }).rejects.toThrow("Bad request");

    expect(generatorFactory).toHaveBeenCalledTimes(1);
  });

  it("should handle abort signal", async () => {
    const generatorFactory = vi.fn(async (retryAbortSignal: AbortSignal) => {
      return (async function* () {
        yield "should-not-yield";
      })();
    });

    // Abort immediately
    abortController.abort();

    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal,
    );

    await expect(async () => {
      for await (const chunk of generator) {
        // Should not reach here
      }
    }).rejects.toThrow("Request aborted");

    expect(generatorFactory).toHaveBeenCalledTimes(0);
  });
});
