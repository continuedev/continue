import { describe, expect, it } from "vitest";
import {
  appendFailure,
  classifyRequestFailure,
  countFailures,
  FAILURES_MAX,
  type RequestFailure,
} from "./requestFailures";

describe("classifyRequestFailure", () => {
  it.each([
    ["ThrottlingException: Too many requests, please wait", undefined],
    ["429 Too Many Requests", 429],
    ["Rate limit reached for requests", undefined],
    ["rate_limit_error: This request would exceed your limit", undefined],
    ["Your request was throttled", undefined],
    ["anything", 429],
  ])("calls %j throttled", (message, status) => {
    expect(classifyRequestFailure(message, status)).toBe("throttled");
  });

  it.each([
    ["Overloaded", undefined],
    ['529 {"type":"overloaded_error"}', 529],
    ["anything", 529],
  ])("calls %j overloaded", (message, status) => {
    expect(classifyRequestFailure(message, status)).toBe("overloaded");
  });

  it.each([
    ["500 Internal Server Error", 500],
    ["401 invalid x-api-key", 401],
    ["ServiceQuotaExceededException: quota", undefined],
    ["fetch failed", undefined],
    [undefined, undefined],
  ])("calls %j something else", (message, status) => {
    expect(classifyRequestFailure(message as string | undefined, status)).toBe(
      "other",
    );
  });

  it("does not count a request the user stopped", () => {
    expect(classifyRequestFailure("The operation was aborted")).toBeUndefined();
    expect(classifyRequestFailure("Request cancelled")).toBeUndefined();
  });

  it("keeps a word that merely contains 'abort' as a failure", () => {
    expect(classifyRequestFailure("abortion of 429 retries")).toBe("throttled");
  });
});

const failure = (kind: RequestFailure["kind"], at = 0): RequestFailure => ({
  at,
  provider: "bedrock",
  model: "m",
  kind,
});

describe("failure list", () => {
  it("counts by kind", () => {
    expect(
      countFailures([
        failure("throttled"),
        failure("throttled"),
        failure("other"),
      ]),
    ).toEqual({ throttled: 2, overloaded: 0, other: 1 });
    expect(countFailures(undefined)).toEqual({
      throttled: 0,
      overloaded: 0,
      other: 0,
    });
  });

  it("keeps the newest FAILURES_MAX", () => {
    let list: RequestFailure[] | undefined;
    for (let i = 0; i < FAILURES_MAX + 5; i++) {
      list = appendFailure(list, failure("other", i));
    }
    expect(list).toHaveLength(FAILURES_MAX);
    expect(list![0].at).toBe(5);
    expect(list![FAILURES_MAX - 1].at).toBe(FAILURES_MAX + 4);
  });
});
