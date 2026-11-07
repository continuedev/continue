import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RETRY_POLICY,
  parseRetryAfter,
  retryableFailure,
  retryDelayMs,
  RetryWaitTooLongError,
  withRetryPolicy,
} from "./retryPolicy";

const now = Date.parse("2026-11-07T20:00:00Z");

const httpError = (status: number, retryAfter?: string) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: {
      status,
      headers: {
        get: (n: string) => (n === "retry-after" ? retryAfter : null),
      },
    },
  });

describe("parseRetryAfter (RFC 9110 §10.2.3)", () => {
  it("reads delay-seconds", () => {
    expect(parseRetryAfter("120", now)).toBe(120_000);
    expect(parseRetryAfter(" 0 ", now)).toBe(0);
  });

  it("reads an HTTP-date, and a past date as no wait", () => {
    expect(parseRetryAfter("Sat, 07 Nov 2026 20:00:30 GMT", now)).toBe(30_000);
    expect(parseRetryAfter("Fri, 31 Dec 1999 23:59:59 GMT", now)).toBe(0);
  });

  it("accepts a fraction some servers send, and ignores nonsense", () => {
    expect(parseRetryAfter("0.5", now)).toBe(500);
    expect(parseRetryAfter("soon", now)).toBeUndefined();
    expect(parseRetryAfter("-5", now)).toBeUndefined();
    expect(parseRetryAfter(undefined, now)).toBeUndefined();
  });
});

describe("retryableFailure", () => {
  it("retries a rate limit, an unavailable and an overloaded server", () => {
    expect(retryableFailure(httpError(429)).retry).toBe(true);
    expect(retryableFailure(httpError(503)).retry).toBe(true);
    expect(retryableFailure(httpError(529)).retry).toBe(true);
    expect(
      retryableFailure(new Error("Error streaming response: overloaded_error"))
        .retry,
    ).toBe(true);
    expect(
      retryableFailure(
        Object.assign(new Error("Rate exceeded"), {
          name: "ThrottlingException",
          $metadata: { httpStatusCode: 400 },
        }),
      ).retry,
    ).toBe(true);
  });

  it("does not retry what would fail again", () => {
    expect(retryableFailure(httpError(400)).retry).toBe(false);
    expect(retryableFailure(httpError(401)).retry).toBe(false);
    expect(retryableFailure(new Error("invalid tool schema")).retry).toBe(
      false,
    );
  });

  it("reads Retry-After from a Response or from SDK error headers", () => {
    expect(retryableFailure(httpError(429, "7"), now).retryAfterMs).toBe(7000);
    const sdk = Object.assign(new Error("429"), {
      status: 429,
      headers: { "Retry-After": "3" },
    });
    expect(retryableFailure(sdk, now).retryAfterMs).toBe(3000);
  });
});

describe("retryDelayMs", () => {
  it("doubles with full jitter, capped", () => {
    const policy = {
      ...DEFAULT_RETRY_POLICY,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
    };
    expect(retryDelayMs(0, policy, undefined, () => 1)).toBe(1000);
    expect(retryDelayMs(2, policy, undefined, () => 1)).toBe(4000);
    expect(retryDelayMs(6, policy, undefined, () => 1)).toBe(5000);
    expect(retryDelayMs(2, policy, undefined, () => 0.5)).toBe(2000);
  });

  it("uses the server's Retry-After when given", () => {
    expect(retryDelayMs(0, DEFAULT_RETRY_POLICY, 1234)).toBe(1234);
  });
});

describe("withRetryPolicy", () => {
  const fast = {
    maxAttempts: 4,
    baseDelayMs: 1,
    maxDelayMs: 50,
    maxTotalWaitMs: 200,
  };

  it("retries a rate limit until it succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce("ok");
    await expect(withRetryPolicy(fn, { policy: fast })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last failure, with the count, when tries run out", async () => {
    const fn = vi.fn().mockRejectedValue(httpError(429));
    const err: any = await withRetryPolicy(fn, { policy: fast }).catch(
      (e: any) => e,
    );
    expect(err.message).toMatch(/after 4 retries: HTTP 429/);
    expect(err.cause.message).toBe("HTTP 429");
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("reports a long Retry-After at once instead of hanging", async () => {
    const fn = vi.fn().mockRejectedValue(httpError(429, "3600"));
    const err: any = await withRetryPolicy(fn, { policy: fast }).catch(
      (e: any) => e,
    );
    expect(err).toBeInstanceOf(RetryWaitTooLongError);
    expect(err.message).toContain("3600 s");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("stops at once when the request is cancelled", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw httpError(429);
    });
    await expect(
      withRetryPolicy(fn, { policy: fast, signal: controller.signal }),
    ).rejects.toThrow("HTTP 429");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry other failures", async () => {
    const fn = vi.fn().mockRejectedValue(httpError(400));
    await expect(withRetryPolicy(fn, { policy: fast })).rejects.toThrow(
      "HTTP 400",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
