import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import {
  AUTO_ESCALATE_MIN_GAP_MS,
  promptCacheStatus,
  resolvePromptCache,
} from "./promptCache";

const MIN = 60 * 1000;
const t0 = 1_000_000_000;

const sonnet: ModelDescription = {
  title: "sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};

const withTtl = (ttl: "auto" | "5m" | "1h"): ModelDescription => ({
  ...sonnet,
  completionOptions: { promptCaching: true },
  cacheBehavior: { ttl },
});

describe("resolvePromptCache with cacheBehavior.ttl", () => {
  it("leaves a fixed config lifetime to the provider but tracks it", () => {
    const r = resolvePromptCache(
      withTtl("1h"),
      undefined,
      { escalated: false },
      t0,
    );
    expect(r.options).toEqual({});
    expect(r.nextState.lastTtl).toBe("1h");
  });

  it("does not track anything when config does not enable caching", () => {
    const off = { ...sonnet, cacheBehavior: { ttl: "1h" as const } };
    const state = { escalated: false };
    const r = resolvePromptCache(off, undefined, state, t0);
    expect(r.options).toEqual({});
    expect(r.nextState).toBe(state);
  });

  it('config "auto" starts at 5 minutes and escalates after a pause', () => {
    const m = withTtl("auto");
    const first = resolvePromptCache(m, undefined, { escalated: false }, t0);
    expect(first.options).toEqual({ promptCacheTtl: "5m" });
    const second = resolvePromptCache(
      m,
      undefined,
      first.nextState,
      t0 + AUTO_ESCALATE_MIN_GAP_MS + MIN,
    );
    expect(second.options).toEqual({ promptCacheTtl: "1h" });
  });

  it("a toolbar choice beats the config lifetime", () => {
    const r = resolvePromptCache(withTtl("1h"), "5m", { escalated: false }, t0);
    expect(r.options).toEqual({ promptCaching: true, promptCacheTtl: "5m" });
  });

  it("the status shows the configured lifetime", () => {
    const s = promptCacheStatus(
      withTtl("1h"),
      undefined,
      { escalated: false },
      t0,
    );
    expect(s.ttl).toBe("1h");
  });
});
