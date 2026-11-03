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
const bedrockSonnet = model(
  "bedrock",
  "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
);
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
    [model("vertexai", "claude-sonnet-4-5@20250929"), false],
    [model("openrouter", "anthropic/claude-sonnet-4.5"), false],
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
