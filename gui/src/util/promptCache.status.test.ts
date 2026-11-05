import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import {
  configEnablesPromptCaching,
  formatTimeLeft,
  modelSupportsOneHourCache,
  modelSupportsPromptCacheControl,
  promptCacheStatus,
  promptCacheTooltip,
} from "./promptCache";

const MIN = 60 * 1000;
const t0 = 1_000_000_000;

function model(provider: string, id: string): ModelDescription {
  return { title: id, provider, model: id, underlyingProviderName: provider };
}

const sonnet = model("anthropic", "claude-sonnet-4-6");
const bedrockSonnet = model("bedrock", "us.anthropic.claude-sonnet-4-6");
const bedrockOld = model(
  "bedrock",
  "anthropic.claude-3-7-sonnet-20250219-v1:0",
);
const cold = { escalated: false };
const warm5m = { escalated: false, lastRequestAt: t0, lastTtl: "5m" as const };

describe("modelSupportsPromptCacheControl", () => {
  it.each([
    [sonnet, true],
    [bedrockSonnet, true],
    [model("bedrock", "amazon.nova-pro-v1:0"), false],
    [model("openai", "gpt-4o"), false],
    [model("vertexai", "claude-sonnet-4-5@20250929"), true],
    [model("vertexai", "gemini-2.5-pro"), false],
    [model("openrouter", "anthropic/claude-sonnet-4.5"), true],
    [model("openrouter", "openai/gpt-4o"), false],
  ])("%j", (m, expected) => {
    expect(modelSupportsPromptCacheControl(m)).toBe(expected);
  });

  it("is false when there is no model", () => {
    expect(modelSupportsPromptCacheControl(undefined)).toBe(false);
    expect(modelSupportsPromptCacheControl(null)).toBe(false);
  });
});

describe("modelSupportsOneHourCache", () => {
  it("is true for Anthropic and for allowlisted Bedrock models", () => {
    expect(modelSupportsOneHourCache(sonnet)).toBe(true);
    expect(modelSupportsOneHourCache(bedrockSonnet)).toBe(true);
  });

  it("follows the allowlist on OpenRouter", () => {
    expect(
      modelSupportsOneHourCache(
        model("openrouter", "anthropic/claude-sonnet-4.5"),
      ),
    ).toBe(true);
    expect(
      modelSupportsOneHourCache(
        model("openrouter", "anthropic/claude-3.5-sonnet"),
      ),
    ).toBe(false);
  });

  it("is false for Bedrock models that only take 5 minutes", () => {
    expect(modelSupportsOneHourCache(bedrockOld)).toBe(false);
  });
});

describe("configEnablesPromptCaching", () => {
  it("is off by default", () => {
    expect(configEnablesPromptCaching(sonnet)).toBe(false);
  });

  it("follows promptCaching, then cacheBehavior", () => {
    expect(
      configEnablesPromptCaching({
        ...sonnet,
        completionOptions: { promptCaching: true },
      }),
    ).toBe(true);
    expect(
      configEnablesPromptCaching({
        ...sonnet,
        cacheBehavior: { cacheConversation: true },
      }),
    ).toBe(true);
    expect(
      configEnablesPromptCaching({
        ...sonnet,
        completionOptions: { promptCaching: false },
        cacheBehavior: { cacheConversation: true },
      }),
    ).toBe(false);
  });
});

describe("promptCacheStatus", () => {
  it("is off when the toolbar says off", () => {
    expect(promptCacheStatus(sonnet, "off", cold, t0).on).toBe(false);
  });

  it("follows config when there is no toolbar choice", () => {
    expect(promptCacheStatus(sonnet, undefined, cold, t0).on).toBe(false);
    const on = { ...sonnet, completionOptions: { promptCaching: true } };
    expect(promptCacheStatus(on, undefined, cold, t0).on).toBe(true);
  });

  it("is cold before any request", () => {
    const s = promptCacheStatus(sonnet, "auto", cold, t0);
    expect(s.on).toBe(true);
    expect(s.warm).toBe(false);
    expect(s.expiresAt).toBeUndefined();
    expect(s.lifetimeMs).toBeUndefined();
  });

  it("reports when the entry expires and how long it lives", () => {
    const s = promptCacheStatus(sonnet, "auto", warm5m, t0 + 2 * MIN);
    expect(s.expiresAt).toBe(t0 + 5 * MIN);
    expect(s.lifetimeMs).toBe(5 * MIN);
    const hour = { escalated: true, lastRequestAt: t0, lastTtl: "1h" as const };
    expect(promptCacheStatus(sonnet, "auto", hour, t0 + MIN).lifetimeMs).toBe(
      60 * MIN,
    );
  });

  it("has no expiry once the entry has lapsed", () => {
    const s = promptCacheStatus(sonnet, "auto", warm5m, t0 + 6 * MIN);
    expect(s.expiresAt).toBeUndefined();
    expect(s.lifetimeMs).toBeUndefined();
  });

  it("is warm within the lifetime and reports the time left", () => {
    const s = promptCacheStatus(sonnet, "auto", warm5m, t0 + 2 * MIN);
    expect(s.warm).toBe(true);
    expect(s.msLeft).toBe(3 * MIN);
  });

  it("expires after the lifetime", () => {
    expect(promptCacheStatus(sonnet, "auto", warm5m, t0 + 5 * MIN).warm).toBe(
      false,
    );
  });

  it("uses the 1-hour lifetime the last request was written with", () => {
    const state = {
      escalated: true,
      lastRequestAt: t0,
      lastTtl: "1h" as const,
    };
    const s = promptCacheStatus(sonnet, "auto", state, t0 + 30 * MIN);
    expect(s.warm).toBe(true);
    expect(s.ttl).toBe("1h");
  });

  it("is never warm when caching is off", () => {
    expect(promptCacheStatus(sonnet, "off", warm5m, t0 + MIN).warm).toBe(false);
  });
});

describe("promptCacheTooltip", () => {
  it("says what off costs", () => {
    const status = promptCacheStatus(sonnet, "off", cold, t0);
    expect(promptCacheTooltip(status, "off")).toContain("off");
    expect(promptCacheTooltip(status, "off")).toContain("full price");
  });

  it("says warm with the time left", () => {
    const status = promptCacheStatus(sonnet, "auto", warm5m, t0 + 2 * MIN);
    const text = promptCacheTooltip(status, "auto");
    expect(text).toContain("warm");
    expect(text).toContain("Auto (5 minutes)");
    expect(text).toContain("3 min");
  });

  it("gives the clock time the entry expires at", () => {
    const status = promptCacheStatus(sonnet, "auto", warm5m, t0 + 2 * MIN);
    const clock = new Intl.DateTimeFormat(undefined, {
      timeStyle: "short",
    }).format(new Date(t0 + 5 * MIN));
    expect(promptCacheTooltip(status, "auto")).toContain(`at ${clock}`);
  });

  it("says nothing is cached once expired", () => {
    const status = promptCacheStatus(sonnet, "5m", warm5m, t0 + 6 * MIN);
    expect(promptCacheTooltip(status, "5m")).toContain("Nothing cached");
  });

  it("names the 1-hour lifetime", () => {
    const state = {
      escalated: true,
      lastRequestAt: t0,
      lastTtl: "1h" as const,
    };
    const status = promptCacheStatus(sonnet, "auto", state, t0 + 10 * MIN);
    expect(promptCacheTooltip(status, "auto")).toContain("Auto (1 hour)");
  });

  it("says the setting comes from config when there is no toolbar choice", () => {
    const on = { ...sonnet, completionOptions: { promptCaching: true } };
    const status = promptCacheStatus(on, undefined, cold, t0);
    expect(promptCacheTooltip(status, undefined)).toContain("from config");
  });
});

describe("formatTimeLeft", () => {
  it.each([
    [30 * 1000, "30 s"],
    [200, "1 s"],
    [90 * 1000, "2 min"],
    [41 * MIN, "41 min"],
    [60 * MIN, "1 h"],
  ])("%i ms -> %s", (ms, expected) => {
    expect(formatTimeLeft(ms)).toBe(expected);
  });
});

describe("promptCacheTooltip says why Auto switched", () => {
  const status = {
    on: true,
    ttl: "1h" as const,
    warm: false,
  };

  it("after the request count", () => {
    expect(promptCacheTooltip(status, "auto", "requests")).toContain(
      "Auto (1 hour, switched after 5 requests)",
    );
  });

  it("after a pause", () => {
    expect(promptCacheTooltip(status, "auto", "gap")).toContain(
      "Auto (1 hour, switched after a pause)",
    );
  });

  it("says nothing about why when Auto is still on 5 minutes or the lifetime is fixed", () => {
    expect(
      promptCacheTooltip({ ...status, ttl: "5m" }, "auto", "requests"),
    ).toContain("Auto (5 minutes)");
    expect(promptCacheTooltip(status, "1h", "requests")).not.toContain(
      "switched",
    );
  });
});

describe("a prompt below the model's cache minimum", () => {
  const haiku45 = model(
    "bedrock",
    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  ); // caches from 4,096 tokens
  const sonnet55 = model("bedrock", "us.anthropic.claude-sonnet-5-5"); // from 512
  const on = { ...haiku45, completionOptions: { promptCaching: true } };
  const after = (tokens: number) => ({
    escalated: false,
    lastRequestAt: t0,
    lastTtl: "5m" as const,
    lastInputTokens: tokens,
  });

  it("is not warm and says why, when the last request was under the minimum", () => {
    const s = promptCacheStatus(haiku45, "5m", after(3_000), t0 + 1000);
    expect(s.on).toBe(true);
    expect(s.warm).toBe(false);
    expect(s.belowMinimum).toEqual({ tokens: 3_000, minimum: 4_096 });
    expect(s.expiresAt).toBeUndefined();
    const text = promptCacheTooltip(s, "5m");
    expect(text).toContain("Nothing is cached yet");
    expect(text).toContain("3,000");
    expect(text).toContain("4,096");
  });

  it("is warm once the request reaches the minimum", () => {
    const s = promptCacheStatus(haiku45, "5m", after(4_096), t0 + 1000);
    expect(s.belowMinimum).toBeUndefined();
    expect(s.warm).toBe(true);
  });

  it("uses each model's own minimum", () => {
    expect(
      promptCacheStatus(sonnet55, "5m", after(3_000), t0 + 1000).warm,
    ).toBe(true);
    expect(
      promptCacheStatus(sonnet55, "5m", after(400), t0 + 1000).belowMinimum,
    ).toEqual({ tokens: 400, minimum: 512 });
  });

  it("says nothing before a size is known, with caching off, or for an unlisted model", () => {
    const noSize = {
      escalated: false,
      lastRequestAt: t0,
      lastTtl: "5m" as const,
    };
    expect(
      promptCacheStatus(haiku45, "5m", noSize, t0).belowMinimum,
    ).toBeUndefined();
    expect(
      promptCacheStatus(haiku45, "off", after(10), t0 + 1000).belowMinimum,
    ).toBeUndefined();
    expect(
      promptCacheStatus(on, undefined, after(10), t0 + 1000).belowMinimum,
    ).toEqual({ tokens: 10, minimum: 4_096 });
    const future = model("bedrock", "us.anthropic.claude-sonnet-5-6");
    expect(
      promptCacheStatus(future, "5m", after(10), t0 + 1000).belowMinimum,
    ).toBeUndefined();
  });
});
