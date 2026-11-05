import { describe, expect, it } from "vitest";
import {
  bedrockCachePoint,
  bedrockCacheTtl,
  bedrockSupportsOneHourCache,
  bedrockUsageToCompletionUsage,
  splitCacheWrites,
} from "./bedrockHelpers.js";
import {
  AUTO_ESCALATE_AT_REQUEST,
  AutoCacheTtl,
  requestedCacheTtl,
  resolveCacheTtl,
} from "./cacheTtl.js";

const MIN = 60 * 1000;

describe("resolveCacheTtl", () => {
  it("takes the per-request value first, then the configured one", () => {
    expect(resolveCacheTtl("5m", "1h")).toBe("5m");
    expect(resolveCacheTtl(undefined, "1h")).toBe("1h");
    expect(resolveCacheTtl("1h", undefined)).toBe("1h");
  });

  it("treats auto and anything unrecognised as the provider's default", () => {
    expect(resolveCacheTtl("auto", "auto")).toBeUndefined();
    expect(resolveCacheTtl(undefined, "2h")).toBeUndefined();
    expect(resolveCacheTtl(undefined, undefined)).toBeUndefined();
  });
});

describe("bedrock one-hour allowlist (the adapter's copy)", () => {
  it.each([
    ["us.anthropic.claude-haiku-4-5-20251001-v1:0", true],
    ["global.anthropic.claude-sonnet-4-6", true],
    ["anthropic.claude-opus-4-5-20251101-v1:0", true],
    ["us.anthropic.claude-sonnet-4-5-20250929-v1:0", false],
    ["anthropic.claude-sonnet-4-20250514-v1:0", false],
    ["anthropic.claude-3-haiku-20240307-v1:0", false],
    ["us.amazon.nova-pro-v1:0", false],
    ["openai.gpt-oss-120b", false],
  ])("%s -> %s", (id, expected) => {
    expect(bedrockSupportsOneHourCache(id)).toBe(expected);
  });

  it("sends ttl only when 1h is asked for and the model accepts it", () => {
    expect(bedrockCacheTtl("us.anthropic.claude-sonnet-4-6", "1h")).toBe("1h");
    expect(
      bedrockCacheTtl("us.anthropic.claude-sonnet-4-5-20250929-v1:0", "1h"),
    ).toBeUndefined();
    expect(
      bedrockCacheTtl("us.anthropic.claude-sonnet-4-6", "5m"),
    ).toBeUndefined();
  });

  it("builds a cache point with ttl only for 1h", () => {
    expect(bedrockCachePoint(undefined)).toEqual({
      cachePoint: { type: "default" },
    });
    expect(bedrockCachePoint("1h")).toEqual({
      cachePoint: { type: "default", ttl: "1h" },
    });
  });
});

describe("AutoCacheTtl", () => {
  it("starts on 5 minutes and stays there for quick requests", () => {
    const auto = new AutoCacheTtl();
    let t = 1_000_000;
    for (let i = 1; i < AUTO_ESCALATE_AT_REQUEST; i++) {
      expect(auto.next(t)).toBe("5m");
      t += 30 * 1000;
    }
  });

  it("moves to 1 hour at the fifth request and stays", () => {
    const auto = new AutoCacheTtl();
    let t = 0;
    const seen: string[] = [];
    for (let i = 0; i < 7; i++) {
      seen.push(auto.next(t));
      t += 10 * 1000;
    }
    expect(seen).toEqual(["5m", "5m", "5m", "5m", "1h", "1h", "1h"]);
  });

  it("moves to 1 hour after a pause of more than 5 and up to 55 minutes", () => {
    const auto = new AutoCacheTtl();
    expect(auto.next(0)).toBe("5m");
    expect(auto.next(6 * MIN)).toBe("1h");
    expect(auto.next(6 * MIN + 1000)).toBe("1h");
  });

  it("does not move for a gap of exactly 5 minutes or over 55", () => {
    const a = new AutoCacheTtl();
    a.next(0);
    expect(a.next(5 * MIN)).toBe("5m");
    const b = new AutoCacheTtl();
    b.next(0);
    expect(b.next(56 * MIN)).toBe("5m");
    const c = new AutoCacheTtl();
    c.next(0);
    expect(c.next(55 * MIN)).toBe("1h");
  });
});

describe("requestedCacheTtl", () => {
  it("is undefined when the request carries no cache points", () => {
    expect(requestedCacheTtl("1h", new AutoCacheTtl(), false)).toBeUndefined();
  });

  it("does not advance Auto for a request without cache points", () => {
    const auto = new AutoCacheTtl();
    for (let i = 0; i < 10; i++) requestedCacheTtl("auto", auto, false, i);
    expect(requestedCacheTtl("auto", auto, true, 11)).toBe("5m");
  });

  it("passes 5m and 1h through, and asks Auto for auto", () => {
    const auto = new AutoCacheTtl();
    expect(requestedCacheTtl("1h", auto, true)).toBe("1h");
    expect(requestedCacheTtl("5m", auto, true)).toBe("5m");
    expect(requestedCacheTtl("auto", auto, true, 0)).toBe("5m");
    expect(requestedCacheTtl(undefined, auto, true)).toBeUndefined();
  });
});

describe("cache writes by lifetime", () => {
  it("sums cacheDetails into 5-minute and 1-hour writes", () => {
    expect(
      splitCacheWrites([
        { ttl: "5m", inputTokens: 100 },
        { ttl: "1h", inputTokens: 400 },
        { ttl: "1h", inputTokens: 50 },
        { ttl: "24h", inputTokens: 7 },
      ]),
    ).toEqual({ write5m: 100, write1h: 450 });
  });

  it("is undefined when Bedrock sent no split (nothing written)", () => {
    expect(splitCacheWrites(undefined)).toBeUndefined();
    expect(splitCacheWrites([])).toBeUndefined();
  });

  it("adds the split to the usage only when there is one", () => {
    const withSplit = bedrockUsageToCompletionUsage({
      inputTokens: 5,
      cacheWriteInputTokens: 500,
      cacheDetails: [{ ttl: "1h", inputTokens: 500 }],
    });
    expect(withSplit.prompt_tokens_details).toMatchObject({
      cache_write_tokens: 500,
      cache_write_tokens_5m: 0,
      cache_write_tokens_1h: 500,
    });
    const without = bedrockUsageToCompletionUsage({
      inputTokens: 5,
      cacheWriteInputTokens: 500,
    });
    expect("cache_write_tokens_1h" in without.prompt_tokens_details).toBe(
      false,
    );
  });
});
