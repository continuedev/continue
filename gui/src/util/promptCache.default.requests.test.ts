import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import {
  cachingIsDefaulted,
  effectiveCacheSetting,
  promptCacheStatus,
  resolvePromptCache,
} from "./promptCache";

const base = {
  title: "m",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};
const m = (extra: object = {}): ModelDescription =>
  ({ ...base, ...extra }) as ModelDescription;
const NOW = 1_000_000_000_000;

describe("effectiveCacheSetting: where it must not apply", () => {
  it("leaves config alone when it says anything about caching", () => {
    for (const extra of [
      { completionOptions: { promptCaching: false } },
      { completionOptions: { promptCaching: true } },
      { cacheBehavior: { cacheConversation: false } },
    ]) {
      expect(
        effectiveCacheSetting(m(extra), undefined, "agent"),
      ).toBeUndefined();
    }
  });

  it("does not apply to models the cache button does not cover", () => {
    for (const other of [
      m({ provider: "openai", model: "gpt-4o" }),
      m({ provider: "bedrock", model: "us.amazon.nova-pro-v1:0" }),
      m({ provider: "ollama", model: "llama3" }),
    ]) {
      expect(effectiveCacheSetting(other, undefined, "agent")).toBeUndefined();
    }
  });

  it("applies to a Claude model on Bedrock", () => {
    const bedrock = m({
      provider: "bedrock",
      model: "us.anthropic.claude-sonnet-4-6",
    });
    expect(effectiveCacheSetting(bedrock, undefined, "agent")).toBe("auto");
  });

  it("copes with no model", () => {
    expect(effectiveCacheSetting(null, undefined, "agent")).toBeUndefined();
    expect(effectiveCacheSetting(undefined, "5m", "agent")).toBe("5m");
  });
});

describe("cachingIsDefaulted", () => {
  it("is true only when the default is what puts caching on", () => {
    expect(cachingIsDefaulted(m(), undefined, "agent")).toBe(true);
    expect(cachingIsDefaulted(m(), undefined, "chat")).toBe(false);
    expect(cachingIsDefaulted(m(), "auto", "agent")).toBe(false);
    expect(cachingIsDefaulted(m(), "off", "agent")).toBe(false);
    const on = m({ completionOptions: { promptCaching: true } });
    expect(cachingIsDefaulted(on, undefined, "agent")).toBe(false);
  });
});

describe("the default reaches the request", () => {
  const resolve = (mode: string, chosen?: "off") => {
    const setting = effectiveCacheSetting(m(), chosen, mode);
    return resolvePromptCache(m(), setting, { escalated: false }, NOW, mode);
  };

  it("sends caching on with a lifetime in Agent when nothing is set", () => {
    expect(resolve("agent").options).toEqual({
      promptCaching: true,
      promptCacheTtl: "5m",
    });
  });

  it("sends nothing about caching in Chat", () => {
    expect(resolve("chat").options).toEqual({});
  });

  it("sends promptCaching false when the user picked Off", () => {
    expect(resolve("agent", "off").options).toEqual({ promptCaching: false });
  });

  it("moves to 1 hour at the fifth request, as Auto does", () => {
    const setting = effectiveCacheSetting(m(), undefined, "agent");
    const r = resolvePromptCache(
      m(),
      setting,
      { escalated: false, requests: 4, lastRequestAt: NOW - 1000 },
      NOW,
      "agent",
    );
    expect(r.options.promptCacheTtl).toBe("1h");
  });

  it("makes the status say caching is on in Agent and off in Chat", () => {
    const on = effectiveCacheSetting(m(), undefined, "agent");
    expect(promptCacheStatus(m(), on, { escalated: false }, NOW).on).toBe(true);
    const off = effectiveCacheSetting(m(), undefined, "chat");
    expect(promptCacheStatus(m(), off, { escalated: false }, NOW).on).toBe(
      false,
    );
  });
});
