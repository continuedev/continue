import { describe, expect, it } from "vitest";
import { withResponseInfo } from "./cacheStats";

const usage = { promptTokens: 5, completionTokens: 7 };

describe("withResponseInfo", () => {
  it("attaches what the provider sent", () => {
    expect(
      withResponseInfo(usage, {
        stopReason: "tool_use",
        latencyMs: 812,
        requestId: "req-1",
      }),
    ).toEqual({
      ...usage,
      response: { stopReason: "tool_use", latencyMs: 812, requestId: "req-1" },
    });
  });

  it("leaves the usage untouched when the provider sent nothing", () => {
    const same = withResponseInfo(usage, {});
    expect(same).toBe(usage);
    expect("response" in same).toBe(false);
  });

  it("keeps a latency of zero, and drops empty or invalid values", () => {
    expect(withResponseInfo(usage, { latencyMs: 0 }).response).toEqual({
      latencyMs: 0,
    });
    expect(
      withResponseInfo(usage, {
        stopReason: "",
        latencyMs: Number.NaN,
        requestId: null,
      }),
    ).toBe(usage);
    expect(
      withResponseInfo(usage, { latencyMs: Infinity, stopReason: null }),
    ).toBe(usage);
  });

  it("does not change the usage it was given", () => {
    const before = JSON.stringify(usage);
    withResponseInfo(usage, { stopReason: "end_turn" });
    expect(JSON.stringify(usage)).toBe(before);
  });
});
