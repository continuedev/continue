import {
  withExponentialBackoff,
  RETRY_AFTER_HEADER,
} from "./withExponentialBackoff";
const MAX_RETRIES = 4;
const INITIAL_DELAY = 0.01; // so  the tests run fast

describe("withExponentialBackoff", () => {
  //   beforeEach(() => {
  //     jest.useFakeTimers();
  //     jest.clearAllMocks();
  //   });

  //   afterEach(() => {
  //     jest.useRealTimers();
  //   });

  it("should return result on first successful API call", async () => {
    const apiCall = jest.fn().mockResolvedValue("success");

    const result = await withExponentialBackoff(apiCall, MAX_RETRIES);

    expect(result).toBe("success");
    expect(apiCall).toHaveBeenCalledTimes(1);
  });
  it("should retry on API rate limit and succeed", async () => {
    const apiCall = jest
      .fn()
      .mockRejectedValueOnce({
        response: {
          status: 429,
          headers: new Map([[RETRY_AFTER_HEADER, "1"]]),
        },
      })
      .mockResolvedValue("success");

    const start = Date.now();

    const result = await withExponentialBackoff(apiCall, MAX_RETRIES);

    const duration = (Date.now() - start) / 1000;

    expect(result).toBe("success");
    expect(apiCall).toHaveBeenCalledTimes(2);
    expect(duration).toBeGreaterThanOrEqual(1);
  });
  it("should stop retrying after maxRetries and throw error", async () => {
    const apiCall = jest.fn().mockRejectedValue({
      response: {
        status: 429,
        headers: new Map(),
      },
    });

    await expect(
      withExponentialBackoff(apiCall, MAX_RETRIES, INITIAL_DELAY),
    ).rejects.toThrow("Failed to make API call after multiple retries");
    expect(apiCall).toHaveBeenCalledTimes(MAX_RETRIES);
  });

  it("should throw on non-rate limit errors", async () => {
    const apiCall = jest.fn().mockRejectedValue(new Error("Server Error"));

    await expect(withExponentialBackoff(apiCall, MAX_RETRIES)).rejects.toThrow(
      "Server Error",
    );
    expect(apiCall).toHaveBeenCalledTimes(1);
  });
});
