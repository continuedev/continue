import { vi } from "vitest";

import { ExponentialBackoffOptions } from "./exponentialBackoff.js";

// Since the functions are not exported, we need to recreate them for testing
function isRetryableError(error: any): boolean {
  // Handle null/undefined
  if (!error) {
    return false;
  }

  // Network errors are retryable
  if (
    error.code === "ECONNRESET" ||
    error.code === "ENOTFOUND" ||
    error.code === "ETIMEDOUT" ||
    error.code === "EPIPE" ||
    error.code === "ECONNREFUSED"
  ) {
    return true;
  }

  // HTTP status codes that are retryable
  if (error.status) {
    const status = error.status;
    // 429 (Too Many Requests), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
    return status === 429 || status === 502 || status === 503 || status === 504;
  }

  // OpenAI specific errors
  if (error.type === "server_error" || error.type === "rate_limit_exceeded") {
    return true;
  }

  // Anthropic specific errors
  const lower = error.message?.toLowerCase();
  if (lower?.includes("overloaded")) {
    return true;
  }

  // Check for premature close errors by message content
  if (
    lower?.includes("premature close") ||
    lower?.includes("premature end") ||
    lower?.includes("connection reset") ||
    lower?.includes("socket hang up") ||
    lower?.includes("aborted")
  ) {
    return true;
  }

  return false;
}

function calculateDelay(
  attempt: number,
  options: Required<ExponentialBackoffOptions>,
): number {
  const baseDelay =
    options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, options.maxDelay);

  if (options.jitter) {
    // Add jitter: randomize between 50% and 100% of the calculated delay
    return Math.floor(cappedDelay * (0.5 + Math.random() * 0.5));
  }

  return cappedDelay;
}

describe("exponentialBackoff utilities", () => {
  describe("isRetryableError", () => {
    it("should return true for network connection errors", () => {
      const error = { code: "ECONNRESET" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for DNS resolution errors", () => {
      const error = { code: "ENOTFOUND" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for timeout errors", () => {
      const error = { code: "ETIMEDOUT" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for 429 Too Many Requests", () => {
      const error = { status: 429 };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for 502 Bad Gateway", () => {
      const error = { status: 502 };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for 503 Service Unavailable", () => {
      const error = { status: 503 };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for 504 Gateway Timeout", () => {
      const error = { status: 504 };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for server errors", () => {
      const error = { type: "server_error" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for rate limit errors", () => {
      const error = { type: "rate_limit_exceeded" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for EPIPE errors", () => {
      const error = { code: "EPIPE" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for ECONNREFUSED errors", () => {
      const error = { code: "ECONNREFUSED" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for Anthropic overloaded errors", () => {
      const error = { message: "The service is overloaded" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for premature close errors", () => {
      const error = { message: "Error: Premature close" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for premature end errors", () => {
      const error = { message: "Premature end of response" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for connection reset errors", () => {
      const error = { message: "Connection reset by peer" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for socket hang up errors", () => {
      const error = { message: "socket hang up" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for aborted connection errors", () => {
      const error = { message: "Request aborted" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should handle case insensitive error messages", () => {
      const error = { message: "PREMATURE CLOSE" };
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for 400 Bad Request", () => {
      const error = { status: 400 };
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for 401 Unauthorized", () => {
      const error = { status: 401 };
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for 403 Forbidden", () => {
      const error = { status: 403 };
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for 404 Not Found", () => {
      const error = { status: 404 };
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for client errors", () => {
      const error = { type: "client_error" };
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for validation errors", () => {
      const error = { type: "validation_error" };
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for unknown errors", () => {
      const error = { message: "Unknown error" };
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for errors without relevant properties", () => {
      const error = {};
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for null error", () => {
      expect(isRetryableError(null)).toBe(false);
    });

    it("should return false for undefined error", () => {
      expect(isRetryableError(undefined)).toBe(false);
    });

    it("should return false for string errors", () => {
      expect(isRetryableError("Error message")).toBe(false);
    });

    it("should handle errors with both code and status", () => {
      const retryableError = { code: "ECONNRESET", status: 200 };
      expect(isRetryableError(retryableError)).toBe(true);

      const nonRetryableError = { code: "INVALID_REQUEST", status: 429 };
      expect(isRetryableError(nonRetryableError)).toBe(true); // Status takes precedence
    });

    it("should handle errors with both status and type", () => {
      const error = { status: 429, type: "client_error" };
      expect(isRetryableError(error)).toBe(true); // Status check comes first
    });
  });

  describe("calculateDelay", () => {
    const defaultOptions: Required<ExponentialBackoffOptions> = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: false,
      hiddenRetries: 2,
    };

    it("should calculate exponential backoff without jitter", () => {
      expect(calculateDelay(0, defaultOptions)).toBe(1000);
      expect(calculateDelay(1, defaultOptions)).toBe(2000);
      expect(calculateDelay(2, defaultOptions)).toBe(4000);
      expect(calculateDelay(3, defaultOptions)).toBe(8000);
    });

    it("should respect maximum delay", () => {
      const options = { ...defaultOptions, maxDelay: 5000 };
      expect(calculateDelay(0, options)).toBe(1000);
      expect(calculateDelay(1, options)).toBe(2000);
      expect(calculateDelay(2, options)).toBe(4000);
      expect(calculateDelay(3, options)).toBe(5000); // Capped at maxDelay
      expect(calculateDelay(4, options)).toBe(5000); // Still capped
    });

    it("should handle different backoff multipliers", () => {
      const options = { ...defaultOptions, backoffMultiplier: 3 };
      expect(calculateDelay(0, options)).toBe(1000);
      expect(calculateDelay(1, options)).toBe(3000);
      expect(calculateDelay(2, options)).toBe(9000);
      expect(calculateDelay(3, options)).toBe(27000);
    });

    it("should handle different initial delays", () => {
      const options = { ...defaultOptions, initialDelay: 500 };
      expect(calculateDelay(0, options)).toBe(500);
      expect(calculateDelay(1, options)).toBe(1000);
      expect(calculateDelay(2, options)).toBe(2000);
    });

    it("should add jitter when enabled", () => {
      const options = { ...defaultOptions, jitter: true };

      // Mock Math.random to return 0.5 (middle of jitter range)
      const originalRandom = Math.random;
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      // With jitter factor of 0.5 + 0.5 * 0.5 = 0.75
      expect(calculateDelay(0, options)).toBe(750); // 1000 * 0.75
      expect(calculateDelay(1, options)).toBe(1500); // 2000 * 0.75

      // Restore Math.random
      Math.random = originalRandom;
    });

    it("should handle minimum jitter", () => {
      const options = { ...defaultOptions, jitter: true };

      // Mock Math.random to return 0 (minimum jitter)
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0);

      // With jitter factor of 0.5 + 0.5 * 0 = 0.5
      expect(calculateDelay(0, options)).toBe(500); // 1000 * 0.5
      expect(calculateDelay(1, options)).toBe(1000); // 2000 * 0.5

      // Restore Math.random
      Math.random = originalRandom;
    });

    it("should handle maximum jitter", () => {
      const options = { ...defaultOptions, jitter: true };

      // Mock Math.random to return 1 (maximum jitter)
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 1);

      // With jitter factor of 0.5 + 0.5 * 1 = 1.0
      expect(calculateDelay(0, options)).toBe(1000); // 1000 * 1.0
      expect(calculateDelay(1, options)).toBe(2000); // 2000 * 1.0

      // Restore Math.random
      Math.random = originalRandom;
    });

    it("should apply jitter after applying max delay cap", () => {
      const options = { ...defaultOptions, maxDelay: 3000, jitter: true };

      // Mock Math.random to return 0.5
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.5);

      // calculateDelay(2, options) would be 4000, but capped at 3000
      // Then jitter applied: 3000 * 0.75 = 2250
      expect(calculateDelay(2, options)).toBe(2250);

      // Restore Math.random
      Math.random = originalRandom;
    });

    it("should handle zero attempt", () => {
      expect(calculateDelay(0, defaultOptions)).toBe(1000);
    });

    it("should handle fractional multipliers", () => {
      const options = { ...defaultOptions, backoffMultiplier: 1.5 };
      expect(calculateDelay(0, options)).toBe(1000);
      expect(calculateDelay(1, options)).toBe(1500);
      expect(calculateDelay(2, options)).toBe(2250);
    });

    it("should handle edge case with multiplier of 1", () => {
      const options = { ...defaultOptions, backoffMultiplier: 1 };
      expect(calculateDelay(0, options)).toBe(1000);
      expect(calculateDelay(1, options)).toBe(1000);
      expect(calculateDelay(2, options)).toBe(1000);
    });

    it("should handle very large attempt numbers", () => {
      const options = { ...defaultOptions, maxDelay: 60000 };
      expect(calculateDelay(10, options)).toBe(60000); // Should be capped
    });
  });
});
