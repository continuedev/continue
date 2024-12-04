// core/util/withExponentialBackoff.test.ts

import {
  withExponentialBackoff,
  RETRY_AFTER_HEADER,
} from "./withExponentialBackoff";

// Helper function to simulate delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("withExponentialBackoff", () => {
  it("should return result immediately if apiCall is successful", async () => {
    const mockApiCall = jest.fn().mockResolvedValue("success");

    const result = await withExponentialBackoff(mockApiCall);
    expect(result).toBe("success");
    expect(mockApiCall).toHaveBeenCalledTimes(1);
  });

  it("should retry on API error 429 and eventually succeed", async () => {
    // Mock an API function that returns HTTP 429 twice then succeeds
    const mockApiCall = jest
      .fn()
      .mockRejectedValueOnce({
        response: { status: 429, headers: new Map() },
      })
      .mockRejectedValueOnce({
        response: { status: 429, headers: new Map() },
      })
      .mockResolvedValue("success");

    const result = await withExponentialBackoff(mockApiCall, 3, 0.001); // Use a short delay for testing
    expect(result).toBe("success");
    expect(mockApiCall).toHaveBeenCalledTimes(3);
  });

  it("should respect Retry-After header value for delay", async () => {
    const mockApiCall = jest
      .fn()
      .mockRejectedValueOnce({
        response: {
          status: 429,
          headers: new Map([[RETRY_AFTER_HEADER, "1"]]),
        },
      })
      .mockResolvedValue("success");

    const startTime = Date.now();
    const result = await withExponentialBackoff(mockApiCall, 2, 1);
    const endTime = Date.now();

    expect(result).toBe("success");
    expect(endTime - startTime).toBeGreaterThanOrEqual(1000); // At least 1 second delay
    expect(mockApiCall).toHaveBeenCalledTimes(2);
  });

  it("should throw error after maxRetries are exhausted", async () => {
    const mockApiCall = jest.fn().mockRejectedValue(new Error("Network Error"));

    await expect(withExponentialBackoff(mockApiCall, 3, 0.001)).rejects.toThrow(
      "Network Error",
    );
    expect(mockApiCall).toHaveBeenCalledTimes(3);
  });

  it("should throw the error immediately if it is not rate limit reached error", async () => {
    const mockApiCall = jest
      .fn()
      .mockRejectedValue(new Error("Unexpected Error"));

    await expect(withExponentialBackoff(mockApiCall, 3, 0.001)).rejects.toThrow(
      "Unexpected Error",
    );
    expect(mockApiCall).toHaveBeenCalledTimes(1);
  });
});
