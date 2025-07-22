import { jest } from "@jest/globals";
import { withExponentialBackoff } from "./exponentialBackoff.js";

// Mock the logging functions - use exact file paths that exist
jest.mock("./src/logging", () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("withExponentialBackoff", () => {
  let abortController: AbortController;

  beforeEach(() => {
    abortController = new AbortController();
    jest.clearAllMocks();
  });

  it("should successfully yield all values from generator", async () => {
    const mockData = ["chunk1", "chunk2", "chunk3"];
    const generatorFactory = jest.fn(async () => {
      return (async function* () {
        for (const chunk of mockData) {
          yield chunk;
        }
      })();
    });

    const results: string[] = [];
    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal
    );

    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(mockData);
    expect(generatorFactory).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable errors during generator creation", async () => {
    let callCount = 0;
    const generatorFactory = jest.fn(async () => {
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
      }
    );

    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(["success"]);
    expect(generatorFactory).toHaveBeenCalledTimes(2);
  });

  it("should retry on retryable errors during generator iteration", async () => {
    let callCount = 0;
    const generatorFactory = jest.fn(async () => {
      callCount++;
      return (async function* () {
        if (callCount === 1) {
          yield "first";
          const error = new Error("Rate limit exceeded");
          (error as any).status = 429;
          throw error;
        }
        yield "retry-success";
      })();
    });

    const results: string[] = [];
    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal,
      {
        maxRetries: 2,
        initialDelay: 10,
      }
    );

    for await (const chunk of generator) {
      results.push(chunk);
    }

    // Should get the partial result from first attempt, then the retry result
    expect(results).toEqual(["first", "retry-success"]);
    expect(generatorFactory).toHaveBeenCalledTimes(2);
  });

  it("should not retry on non-retryable errors", async () => {
    const generatorFactory = jest.fn(async () => {
      const error = new Error("Bad request");
      (error as any).status = 400;
      throw error;
    });

    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal
    );

    await expect(async () => {
      for await (const chunk of generator) {
        // Should not reach here
      }
    }).rejects.toThrow("Bad request");

    expect(generatorFactory).toHaveBeenCalledTimes(1);
  });

  it("should throw error after max retries exceeded", async () => {
    const generatorFactory = jest.fn(async () => {
      const error = new Error("Service unavailable");
      (error as any).status = 503;
      throw error;
    });

    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal,
      {
        maxRetries: 2,
        initialDelay: 10,
      }
    );

    await expect(async () => {
      for await (const chunk of generator) {
        // Should not reach here
      }
    }).rejects.toThrow("Service unavailable");

    expect(generatorFactory).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("should handle abort signal during generator creation", async () => {
    const generatorFactory = jest.fn(async () => {
      return (async function* () {
        yield "should-not-yield";
      })();
    });

    // Abort immediately
    abortController.abort();

    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal
    );

    await expect(async () => {
      for await (const chunk of generator) {
        // Should not reach here
      }
    }).rejects.toThrow("Request aborted");

    expect(generatorFactory).toHaveBeenCalledTimes(0);
  });

  it("should handle abort signal during generator iteration", async () => {
    const generatorFactory = jest.fn(async () => {
      return (async function* () {
        yield "first";
        // Simulate a delay where abort can happen
        await new Promise((resolve) => setTimeout(resolve, 50));
        yield "second";
      })();
    });

    const results: string[] = [];
    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal
    );

    const asyncIterator = generator[Symbol.asyncIterator]();

    // Get first chunk
    const firstResult = await asyncIterator.next();
    expect(firstResult.value).toBe("first");
    results.push(firstResult.value);

    // Abort before getting second chunk
    abortController.abort();

    // Should throw on next iteration
    await expect(asyncIterator.next()).rejects.toThrow("Request aborted");

    expect(results).toEqual(["first"]);
  });

  it("should handle empty generator", async () => {
    const generatorFactory = jest.fn(async () => {
      return (async function* () {
        // Empty generator
      })();
    });

    const results: string[] = [];
    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal
    );

    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual([]);
    expect(generatorFactory).toHaveBeenCalledTimes(1);
  });

  it("should handle generator that throws after yielding some values", async () => {
    let callCount = 0;
    const generatorFactory = jest.fn(async () => {
      callCount++;
      return (async function* () {
        if (callCount === 1) {
          yield "first";
          yield "second";
          const error = new Error("Service unavailable");
          (error as any).status = 503;
          throw error;
        }
        yield "retry-first";
        yield "retry-second";
      })();
    });

    const results: string[] = [];
    const generator = withExponentialBackoff(
      generatorFactory,
      abortController.signal,
      {
        maxRetries: 1,
        initialDelay: 10,
      }
    );

    for await (const chunk of generator) {
      results.push(chunk);
    }

    // Should get values from both attempts since we yield as we go
    expect(results).toEqual(["first", "second", "retry-first", "retry-second"]);
    expect(generatorFactory).toHaveBeenCalledTimes(2);
  });

  it("should use custom retry options", async () => {
    let callCount = 0;
    const generatorFactory = jest.fn(async () => {
      callCount++;
      if (callCount <= 2) {
        const error = new Error("Service unavailable");
        (error as any).status = 503;
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
        maxRetries: 3,
        initialDelay: 5,
        maxDelay: 20,
        backoffMultiplier: 3,
        jitter: false,
      }
    );

    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(["success"]);
    expect(generatorFactory).toHaveBeenCalledTimes(3);
  });

  it("should handle different types of retryable errors", async () => {
    const retryableErrors = [
      { code: "ECONNRESET", message: "Connection reset" },
      { code: "ENOTFOUND", message: "Host not found" },
      { code: "ETIMEDOUT", message: "Connection timeout" },
      { status: 429, message: "Too many requests" },
      { status: 502, message: "Bad gateway" },
      { status: 503, message: "Service unavailable" },
      { status: 504, message: "Gateway timeout" },
      { type: "server_error", message: "Server error" },
      { type: "rate_limit_exceeded", message: "Rate limit exceeded" },
    ];

    for (const errorData of retryableErrors) {
      let callCount = 0;
      const generatorFactory = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          const error = new Error(errorData.message);
          Object.assign(error, errorData);
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
          maxRetries: 1,
          initialDelay: 10,
        }
      );

      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toEqual(["success"]);
      expect(generatorFactory).toHaveBeenCalledTimes(2);

      // Reset for next test
      abortController = new AbortController();
      jest.clearAllMocks();
    }
  });
});
