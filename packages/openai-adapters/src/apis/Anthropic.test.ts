import { describe, expect, it } from "vitest";

import { CACHING_STRATEGIES } from "./AnthropicCachingStrategies.js";
import { addCacheControlToLastTwoUserMessages } from "./AnthropicUtils.js";
import { AnthropicApi } from "./Anthropic.js";

describe("AnthropicApi", () => {
  describe("_convertBody applies cache_control to last two user messages", () => {
    const api = new AnthropicApi({
      provider: "anthropic",
      apiKey: "test-key",
      cachingStrategy: "systemAndTools",
    });

    it("adds cache_control to the last two user messages", () => {
      const body = api._convertToCleanAnthropicBody({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "First user message" },
          { role: "assistant", content: "First response" },
          { role: "user", content: "Second user message" },
          { role: "assistant", content: "Second response" },
          { role: "user", content: "Third user message" },
        ],
      });

      const result = CACHING_STRATEGIES["systemAndTools"](body);
      addCacheControlToLastTwoUserMessages(result.messages);

      // The last user message (index 4 = "Third user message") should have cache_control
      const lastUserMsg = result.messages[4];
      expect(lastUserMsg.role).toBe("user");
      expect(Array.isArray(lastUserMsg.content)).toBe(true);
      if (Array.isArray(lastUserMsg.content)) {
        const textPart = lastUserMsg.content.find(
          (p: any) => p.type === "text",
        );
        expect((textPart as any)?.cache_control).toEqual({ type: "ephemeral" });
      }

      // The second-to-last user message (index 2 = "Second user message") should also have cache_control
      const secondLastUserMsg = result.messages[2];
      expect(secondLastUserMsg.role).toBe("user");
      expect(Array.isArray(secondLastUserMsg.content)).toBe(true);
      if (Array.isArray(secondLastUserMsg.content)) {
        const textPart = secondLastUserMsg.content.find(
          (p: any) => p.type === "text",
        );
        expect((textPart as any)?.cache_control).toEqual({ type: "ephemeral" });
      }

      // The first user message (index 0 = "First user message") should NOT have cache_control
      const firstUserMsg = result.messages[0];
      expect(firstUserMsg.role).toBe("user");
      expect(Array.isArray(firstUserMsg.content)).toBe(true);
      if (Array.isArray(firstUserMsg.content)) {
        const textPart = firstUserMsg.content.find(
          (p: any) => p.type === "text",
        );
        expect((textPart as any)?.cache_control).toBeUndefined();
      }
    });

    it("handles conversations with only one user message", () => {
      const body = api._convertToCleanAnthropicBody({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Only user message" },
        ],
      });

      const result = CACHING_STRATEGIES["systemAndTools"](body);
      addCacheControlToLastTwoUserMessages(result.messages);

      const userMsg = result.messages[0];
      expect(userMsg.role).toBe("user");
      expect(Array.isArray(userMsg.content)).toBe(true);
      if (Array.isArray(userMsg.content)) {
        const textPart = userMsg.content.find((p: any) => p.type === "text");
        expect((textPart as any)?.cache_control).toEqual({ type: "ephemeral" });
      }
    });

    it("still caches user messages even when caching strategy is none", () => {
      const body = new AnthropicApi({
        provider: "anthropic",
        apiKey: "test-key",
        cachingStrategy: "none",
      })._convertToCleanAnthropicBody({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
          { role: "user", content: "How are you?" },
        ],
      });

      const result = CACHING_STRATEGIES["none"](body);
      addCacheControlToLastTwoUserMessages(result.messages);

      // User message caching is applied regardless of strategy
      const lastUserMsg = result.messages[2];
      expect(lastUserMsg.role).toBe("user");
      if (Array.isArray(lastUserMsg.content)) {
        const textPart = lastUserMsg.content.find(
          (p: any) => p.type === "text",
        );
        expect((textPart as any)?.cache_control).toEqual({ type: "ephemeral" });
      }
    });
  });
});
