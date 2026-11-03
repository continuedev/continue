import { describe, expect, it } from "vitest";
import { markLastToolForCache, resolveCacheParts } from "./anthropicCache";

describe("resolveCacheParts", () => {
  it("caches everything when promptCaching is true", () => {
    expect(resolveCacheParts(true, undefined, true)).toEqual({
      tools: true,
      system: true,
      conversation: true,
    });
  });

  it("does not mark an empty system prompt", () => {
    expect(resolveCacheParts(true, undefined, false).system).toBe(false);
  });

  it("lets an explicit false beat cacheBehavior", () => {
    expect(
      resolveCacheParts(
        false,
        { cacheConversation: true, cacheSystemMessage: true },
        true,
      ),
    ).toEqual({ tools: false, system: false, conversation: false });
  });

  it("falls back to cacheBehavior when promptCaching is unset", () => {
    expect(
      resolveCacheParts(undefined, { cacheConversation: true }, true),
    ).toEqual({ tools: false, system: false, conversation: true });
    expect(
      resolveCacheParts(undefined, { cacheSystemMessage: true }, true),
    ).toEqual({ tools: false, system: true, conversation: false });
  });

  it("caches nothing by default", () => {
    expect(resolveCacheParts(undefined, undefined, true)).toEqual({
      tools: false,
      system: false,
      conversation: false,
    });
  });
});

describe("markLastToolForCache", () => {
  it("marks only the last tool", () => {
    const tools: any[] = [{ name: "a" }, { name: "b" }];
    markLastToolForCache(tools, "1h");
    expect(tools[0].cache_control).toBeUndefined();
    expect(tools[1].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  it("does nothing without tools", () => {
    expect(() => markLastToolForCache(undefined)).not.toThrow();
    expect(() => markLastToolForCache([])).not.toThrow();
  });
});
