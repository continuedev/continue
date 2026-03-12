import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  withExponentialBackoff,
  APIError,
  RETRY_AFTER_HEADER,
} from "./withExponentialBackoff";

describe("withExponentialBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("successful calls", () => {
    it("should return result on first successful call", async () => {
      const apiCall = vi.fn().mockResolvedValue("success");

      const promise = withExponentialBackoff(apiCall);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it("should return result after retry on rate limit", async () => {
      const rateLimitError = new Error("Rate limited") as APIError;
      rateLimitError.response = {
        status: 429,
        headers: new Headers(),
      } as Response;

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const promise = withExponentialBackoff(apiCall);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it("should handle different return types", async () => {
      const objectApiCall = vi.fn().mockResolvedValue({ data: "test" });
      const arrayApiCall = vi.fn().mockResolvedValue([1, 2, 3]);
      const nullApiCall = vi.fn().mockResolvedValue(null);

      const objPromise = withExponentialBackoff(objectApiCall);
      const arrPromise = withExponentialBackoff(arrayApiCall);
      const nullPromise = withExponentialBackoff(nullApiCall);

      await vi.runAllTimersAsync();

      expect(await objPromise).toEqual({ data: "test" });
      expect(await arrPromise).toEqual([1, 2, 3]);
      expect(await nullPromise).toBeNull();
    });
  });

  describe("rate limit handling", () => {
    it("should detect rate limit from response status 429", async () => {
      const rateLimitError = new Error("Rate limited") as APIError;
      rateLimitError.response = {
        status: 429,
        headers: new Headers(),
      } as Response;

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const promise = withExponentialBackoff(apiCall);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it("should detect rate limit from error message containing 429", async () => {
      const error = new Error('API error: {"code": 429}');

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const promise = withExponentialBackoff(apiCall);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it("should use Retry-After header when present", async () => {
      const headers = new Headers();
      headers.set(RETRY_AFTER_HEADER, "5");

      const rateLimitError = new Error("Rate limited") as APIError;
      rateLimitError.response = {
        status: 429,
        headers,
      } as Response;

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const promise = withExponentialBackoff(apiCall);

      // First call fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(apiCall).toHaveBeenCalledTimes(1);

      // Should wait 5 seconds as per Retry-After header
      await vi.advanceTimersByTimeAsync(4999);
      expect(apiCall).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(apiCall).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe("success");
    });

    it("should use exponential backoff when no Retry-After header", async () => {
      const rateLimitError = new Error("Rate limited") as APIError;
      rateLimitError.response = {
        status: 429,
        headers: new Headers(),
      } as Response;

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const promise = withExponentialBackoff(apiCall, 5, 1);

      // First call fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(apiCall).toHaveBeenCalledTimes(1);

      // First retry after 1 second (2^0 * initialDelay)
      await vi.advanceTimersByTimeAsync(1000);
      expect(apiCall).toHaveBeenCalledTimes(2);

      // Second retry after 2 seconds (2^1 * initialDelay)
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiCall).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe("success");
    });
  });

  describe("non-rate-limit errors", () => {
    it("should throw immediately for non-429 errors", async () => {
      const error = new Error("Server error") as APIError;
      error.response = {
        status: 500,
        headers: new Headers(),
      } as Response;

      const apiCall = vi.fn().mockRejectedValue(error);

      await expect(withExponentialBackoff(apiCall)).rejects.toThrow(
        "Server error",
      );
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it("should throw for network errors", async () => {
      const error = new Error("Network failure");

      const apiCall = vi.fn().mockRejectedValue(error);

      await expect(withExponentialBackoff(apiCall)).rejects.toThrow(
        "Network failure",
      );
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it("should throw for errors without response property", async () => {
      const error = new Error("Some error");

      const apiCall = vi.fn().mockRejectedValue(error);

      await expect(withExponentialBackoff(apiCall)).rejects.toThrow(
        "Some error",
      );
      expect(apiCall).toHaveBeenCalledTimes(1);
    });
  });

  describe("max retries", () => {
    it("should throw after max retries exceeded", async () => {
      const rateLimitError = new Error("Rate limited") as APIError;
      rateLimitError.response = {
        status: 429,
        headers: new Headers(),
      } as Response;

      const apiCall = vi.fn().mockRejectedValue(rateLimitError);

      // Use a small delay to make tests faster
      const promise = withExponentialBackoff(apiCall, 3, 0.001);

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(
        "Failed to make API call after 3 retries",
      );
      expect(apiCall).toHaveBeenCalledTimes(3);
    });

    it("should respect custom maxTries parameter", async () => {
      const rateLimitError = new Error("Rate limited") as APIError;
      rateLimitError.response = {
        status: 429,
        headers: new Headers(),
      } as Response;

      const apiCall = vi.fn().mockRejectedValue(rateLimitError);

      const promise = withExponentialBackoff(apiCall, 2, 0.001);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(
        "Failed to make API call after 2 retries",
      );
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it("should use default maxTries of 5", async () => {
      const rateLimitError = new Error("Rate limited") as APIError;
      rateLimitError.response = {
        status: 429,
        headers: new Headers(),
      } as Response;

      const apiCall = vi.fn().mockRejectedValue(rateLimitError);

      // Create a custom version with small delay for testing
      const promise = withExponentialBackoff(apiCall, 5, 0.001);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(
        "Failed to make API call after 5 retries",
      );
      expect(apiCall).toHaveBeenCalledTimes(5);
    });
  });

  describe("delay configuration", () => {
    it("should respect custom initialDelaySeconds", async () => {
      const rateLimitError = new Error("Rate limited") as APIError;
      rateLimitError.response = {
        status: 429,
        headers: new Headers(),
      } as Response;

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const promise = withExponentialBackoff(apiCall, 5, 2);

      // First call fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(apiCall).toHaveBeenCalledTimes(1);

      // Should wait 2 seconds (2^0 * 2)
      await vi.advanceTimersByTimeAsync(1999);
      expect(apiCall).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(apiCall).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe("success");
    });
  });

  describe("edge cases", () => {
    it("should handle error with null message", async () => {
      const error = new Error() as APIError;
      error.message = null as unknown as string;
      error.response = {
        status: 429,
        headers: new Headers(),
      } as Response;

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const promise = withExponentialBackoff(apiCall);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
    });

    it("should handle error with undefined message", async () => {
      const error = new Error() as APIError;
      error.message = undefined as unknown as string;
      error.response = {
        status: 429,
        headers: new Headers(),
      } as Response;

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const promise = withExponentialBackoff(apiCall);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
    });
  });
});
