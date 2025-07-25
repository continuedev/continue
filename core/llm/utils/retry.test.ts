import { retryAsync, withLLMRetry, withRetry } from "./retry";

// Mock console.warn to avoid noise in tests
const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

describe("Retry Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("retryAsync", () => {
    it("should succeed on first attempt", async () => {
      const mockFn = jest.fn().mockResolvedValue("success");

      const result = await retryAsync(mockFn);

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const error = new Error("ECONNRESET");
      (error as any).code = "ECONNRESET";
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 10, // Very short delay for testing
      });

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-retryable errors", async () => {
      const error = new Error("Bad Request");
      (error as any).status = 400;
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(retryAsync(mockFn)).rejects.toThrow("Bad Request");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should respect max attempts", async () => {
      const error = new Error("ECONNRESET");
      (error as any).code = "ECONNRESET";
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(
        retryAsync(mockFn, {
          maxAttempts: 3,
          baseDelay: 10,
        }),
      ).rejects.toThrow("ECONNRESET");
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it("should throw the last error when all retries are exhausted", async () => {
      const firstError = new Error("First error");
      (firstError as any).code = "ECONNRESET";
      const secondError = new Error("Second error");
      (secondError as any).code = "ECONNRESET";
      const lastError = new Error("Last error");
      (lastError as any).code = "ECONNRESET";

      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(firstError)
        .mockRejectedValueOnce(secondError)
        .mockRejectedValueOnce(lastError);

      await expect(
        retryAsync(mockFn, {
          maxAttempts: 3,
          baseDelay: 10,
        }),
      ).rejects.toThrow("Last error");
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it("should handle HTTP 429 errors", async () => {
      const error = new Error("Too Many Requests");
      (error as any).status = 429;
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 10,
      });

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should handle HTTP 5xx errors", async () => {
      const error = new Error("Internal Server Error");
      (error as any).status = 500;
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 10,
      });

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should handle AWS SDK errors", async () => {
      const error = new Error("Throttling");
      error.name = "ThrottlingException";
      (error as any).$fault = "client";
      (error as any).$metadata = {
        httpStatusCode: 429,
        requestId: "test-request-id",
      };
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 10,
      });

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should not retry AbortError", async () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(retryAsync(mockFn)).rejects.toThrow("Aborted");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should use custom shouldRetry function", async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error("Custom Error"));
      const customShouldRetry = jest.fn().mockReturnValue(true);

      await expect(
        retryAsync(mockFn, {
          maxAttempts: 2,
          shouldRetry: customShouldRetry,
          baseDelay: 10,
        }),
      ).rejects.toThrow("Custom Error");

      expect(customShouldRetry).toHaveBeenCalledWith(expect.any(Error), 1);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("withRetry decorator functional usage", () => {
    it("should work when applied manually to methods", async () => {
      const testClass = {
        attempts: 0,

        async testMethod(): Promise<string> {
          this.attempts++;
          if (this.attempts < 3) {
            const error = new Error("ECONNRESET");
            (error as any).code = "ECONNRESET";
            throw error;
          }
          return "success";
        },
      };

      // Apply decorator manually
      const decorator = withRetry({
        maxAttempts: 3,
        baseDelay: 10,
      });
      const descriptor = decorator(testClass, "testMethod", {
        value: testClass.testMethod,
        writable: true,
        enumerable: false,
        configurable: true,
      });

      if (descriptor?.value) {
        testClass.testMethod = descriptor.value;
      }

      const result = await testClass.testMethod();

      expect(result).toBe("success");
      expect(testClass.attempts).toBe(3);
    });

    it("should throw the last error when all retries are exhausted", async () => {
      const testClass = {
        attempts: 0,

        async testMethod(): Promise<string> {
          this.attempts++;
          if (this.attempts === 1) {
            const error = new Error("First decorator error");
            (error as any).code = "ECONNRESET";
            throw error;
          } else if (this.attempts === 2) {
            const error = new Error("Second decorator error");
            (error as any).code = "ECONNRESET";
            throw error;
          } else {
            const error = new Error("Last decorator error");
            (error as any).code = "ECONNRESET";
            throw error;
          }
        },
      };

      // Apply decorator manually
      const decorator = withRetry({
        maxAttempts: 3,
        baseDelay: 10,
      });
      const descriptor = decorator(testClass, "testMethod", {
        value: testClass.testMethod,
        writable: true,
        enumerable: false,
        configurable: true,
      });

      if (descriptor?.value) {
        testClass.testMethod = descriptor.value;
      }

      await expect(testClass.testMethod()).rejects.toThrow(
        "Last decorator error",
      );
      expect(testClass.attempts).toBe(3);
    });
  });

  describe("withLLMRetry decorator functional usage", () => {
    it("should use LLM-specific defaults", async () => {
      const testLLM = {
        attempts: 0,

        async streamChat(): Promise<string> {
          this.attempts++;
          if (this.attempts < 2) {
            const error = new Error("Too Many Requests");
            (error as any).status = 429;
            throw error;
          }
          return "success";
        },
      };

      // Apply decorator manually
      const decorator = withLLMRetry({ baseDelay: 10 });
      const descriptor = decorator(testLLM, "streamChat", {
        value: testLLM.streamChat,
        writable: true,
        enumerable: false,
        configurable: true,
      });

      if (descriptor?.value) {
        testLLM.streamChat = descriptor.value;
      }

      const result = await testLLM.streamChat();

      expect(result).toBe("success");
      expect(testLLM.attempts).toBe(2);
    });
  });

  describe("exponential backoff with jitter", () => {
    it("should increase delay exponentially", async () => {
      const delays: number[] = [];
      const error = new Error("ECONNRESET");
      (error as any).code = "ECONNRESET";
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(
        retryAsync(mockFn, {
          maxAttempts: 3,
          baseDelay: 1000,
          jitterFactor: 0, // No jitter for predictable testing
          onRetry: (error, attempt, delay) => {
            delays.push(delay);
          },
        }),
      ).rejects.toThrow();

      // First retry should be ~1000ms, second should be ~2000ms
      expect(delays).toHaveLength(2);
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
    });

    it("should respect maxDelay", async () => {
      const delays: number[] = [];
      const error = new Error("ECONNRESET");
      (error as any).code = "ECONNRESET";
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(
        retryAsync(mockFn, {
          maxAttempts: 4,
          baseDelay: 1000,
          maxDelay: 2500,
          jitterFactor: 0,
          onRetry: (error, attempt, delay) => {
            delays.push(delay);
          },
        }),
      ).rejects.toThrow();

      // Delays should be: 1000, 2000, 2500 (capped)
      expect(delays).toEqual([1000, 2000, 2500]);
    });
  });

  describe("rate limiting headers", () => {
    it("should respect retry-after header in seconds", async () => {
      const delays: number[] = [];
      const error = new Error("Too Many Requests");
      (error as any).status = 429;
      (error as any).headers = { "retry-after": "1" }; // 1 second for fast testing
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 100, // 100ms fallback
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        },
      });

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
      // Should use header value (1000ms) not exponential backoff (100ms)
      expect(delays[0]).toBeGreaterThan(940); // 1000ms with wider tolerance for jitter and system performance
      expect(delays[0]).toBeLessThan(1080);
    });

    it("should respect x-ratelimit-reset header", async () => {
      const delays: number[] = [];
      const error = new Error("Rate limited");
      (error as any).status = 429;
      (error as any).headers = { "x-ratelimit-reset": "0.5" }; // 500ms for fast testing
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 100,
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        },
      });

      expect(result).toBe("success");
      // Should use header value (500ms) not exponential backoff (100ms)
      expect(delays[0]).toBeGreaterThan(470); // 500ms with wider tolerance for jitter and system performance
      expect(delays[0]).toBeLessThan(540);
    });

    it("should handle HTTP date format in retry-after header", async () => {
      const delays: number[] = [];
      const futureDate = new Date(Date.now() + 2000); // 2 seconds from now to avoid timing issues
      const error = new Error("Rate limited");
      (error as any).status = 429;
      (error as any).headers = { "retry-after": futureDate.toUTCString() };
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 100,
        maxDelay: 300, // Cap at 300ms for fast testing
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        },
      });

      expect(result).toBe("success");
      // Should be capped at maxDelay (300ms) since original would be ~2000ms
      expect(delays[0]).toBeGreaterThan(280);
      expect(delays[0]).toBeLessThan(320);
    });

    it("should fallback to exponential backoff when no headers present", async () => {
      const delays: number[] = [];
      const error = new Error("Server Error");
      (error as any).status = 500;
      // No headers property
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 50, // Fast for testing
        jitterFactor: 0,
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        },
      });

      expect(result).toBe("success");
      // Should use exponential backoff (50ms) since no headers
      expect(delays[0]).toBe(50);
    });

    it("should respect maxDelay even with rate limit headers", async () => {
      const delays: number[] = [];
      const error = new Error("Rate limited");
      (error as any).status = 429;
      (error as any).headers = { "retry-after": "10" }; // 10 seconds requested
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 100,
        maxDelay: 200, // Cap at 200ms for fast testing
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        },
      });

      expect(result).toBe("success");
      // Should be capped at maxDelay (200ms) not header value (10000ms)
      // Jitter is applied before maxDelay cap, so delay should never exceed maxDelay
      expect(delays[0]).toBeGreaterThanOrEqual(190);
      expect(delays[0]).toBeLessThanOrEqual(200);
    });

    it("should handle case-insensitive header names", async () => {
      const delays: number[] = [];
      const error = new Error("Rate limited");
      (error as any).status = 429;
      (error as any).headers = { "Retry-After": "0.3" }; // 300ms for fast testing
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await retryAsync(mockFn, {
        maxAttempts: 2,
        baseDelay: 100,
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        },
      });

      expect(result).toBe("success");
      // Should use header value (300ms)
      expect(delays[0]).toBeGreaterThan(284);
      expect(delays[0]).toBeLessThan(316);
    });
  });
});
