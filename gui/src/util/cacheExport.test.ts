import { describe, expect, it } from "vitest";
import {
  buildCacheExport,
  CACHE_EXPORT_VERSION,
  cacheExportText,
  promptShape,
} from "./cacheExport";
import { entry } from "./cacheLedger.testUtils";
import { AUTO_ESCALATE_AT_REQUEST } from "./promptCache";
import type { RequestFailure } from "./requestFailures";

const stops = (...reasons: Array<string | undefined>) =>
  reasons.map((stopReason, i) =>
    entry({ at: i * 1000, ...(stopReason && { stopReason }) }),
  );

describe("promptShape", () => {
  it("is undefined for an empty ledger", () => {
    expect(promptShape([])).toBeUndefined();
  });

  it("counts a request that stops for a reason other than tool_use as a whole prompt", () => {
    const s = promptShape(stops("end_turn", "end_turn", "end_turn"))!;
    expect(s.callsPerPrompt).toEqual([1, 1, 1]);
    expect(s.prompts).toBe(3);
  });

  it("joins calls that follow a tool_use into the same prompt", () => {
    const s = promptShape(
      stops(
        "tool_use",
        "tool_use",
        "end_turn",
        "tool_use",
        "end_turn",
        "end_turn",
      ),
    )!;
    expect(s.callsPerPrompt).toEqual([3, 2, 1]);
    expect(s.max).toBe(3);
  });

  it("takes a ledger that ends mid-loop as an unfinished prompt", () => {
    const s = promptShape(stops("end_turn", "tool_use", "tool_use"))!;
    expect(s.callsPerPrompt).toEqual([1, 3 - 1]);
  });

  it("reports the median for an even and an odd number of prompts", () => {
    // prompts of 1 and 3 calls: the median of two is their mean
    expect(
      promptShape(stops("end_turn", "tool_use", "tool_use", "end_turn"))!
        .median,
    ).toBe(2);
    // prompts of 1, 2 and 4 calls: the middle one
    expect(
      promptShape(
        stops(
          "end_turn",
          "tool_use",
          "end_turn",
          "tool_use",
          "tool_use",
          "tool_use",
          "end_turn",
        ),
      )!.median,
    ).toBe(2);
    // prompts of 1 and 2 calls: a mean that is not a whole number
    expect(promptShape(stops("end_turn", "tool_use", "end_turn"))!.median).toBe(
      1.5,
    );
  });

  it("counts the prompts that alone reach the Auto threshold", () => {
    const loop = Array(AUTO_ESCALATE_AT_REQUEST - 1).fill("tool_use");
    const s = promptShape(stops(...loop, "end_turn", "end_turn"))!;
    expect(s.callsPerPrompt).toEqual([AUTO_ESCALATE_AT_REQUEST, 1]);
    expect(s.promptsReachingThreshold).toBe(1);
  });

  it("says how many requests had no stop reason, and treats each as a prompt's end", () => {
    const s = promptShape(stops(undefined, "tool_use", undefined))!;
    expect(s.unknownStops).toBe(2);
    expect(s.callsPerPrompt).toEqual([1, 2]);
  });
});

const failure = (kind: RequestFailure["kind"]): RequestFailure => ({
  at: 5,
  provider: "bedrock",
  model: "m",
  kind,
});

describe("buildCacheExport", () => {
  const ledger = [
    entry({ at: 1, requestId: "req-1", stopReason: "end_turn", read: 10 }),
  ];

  it("copies the ledger, the failures and the counts, and stamps the version", () => {
    const x = buildCacheExport(ledger, [failure("throttled")], 123);
    expect(x.version).toBe(CACHE_EXPORT_VERSION);
    expect(x.exportedAt).toBe(123);
    expect(x.requests).toEqual(ledger);
    expect(x.failures).toEqual([failure("throttled")]);
    expect(x.failureCounts).toEqual({ throttled: 1, overloaded: 0, other: 0 });
    expect(x.autoEscalateAtRequest).toBe(AUTO_ESCALATE_AT_REQUEST);
    expect(x.summary?.requests).toBe(1);
    expect(x.promptShape?.prompts).toBe(1);
  });

  it("handles a session with nothing recorded", () => {
    const x = buildCacheExport(undefined, undefined, 0);
    expect(x.requests).toEqual([]);
    expect(x.failures).toEqual([]);
    expect(x.summary).toBeUndefined();
    expect(x.promptShape).toBeUndefined();
  });

  it("round-trips through JSON", () => {
    const text = cacheExportText(ledger, undefined, 9);
    expect(JSON.parse(text).requests[0].requestId).toBe("req-1");
  });

  it("holds only the fields the ledger defines, none that could carry message content", () => {
    const allowed = new Set([
      "at",
      "mode",
      "provider",
      "model",
      "cachingOn",
      "ttl",
      "oneHour",
      "uncached",
      "read",
      "write5m",
      "write1h",
      "output",
      "pruned",
      "missCauses",
      "stopReason",
      "latencyMs",
      "requestId",
    ]);
    const full = entry({
      pruned: true,
      missCauses: ["the model changed"],
      stopReason: "end_turn",
      latencyMs: 12,
      requestId: "r",
    });
    for (const key of Object.keys(
      JSON.parse(cacheExportText([full], [], 0)).requests[0],
    )) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});
