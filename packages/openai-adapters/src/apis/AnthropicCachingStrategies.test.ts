import {
  CACHING_STRATEGIES,
  CachingStrategy,
  CachingStrategyName,
  getAvailableStrategies,
  getStrategyDescription,
} from "./AnthropicCachingStrategies.js";

describe("AnthropicCachingStrategies", () => {
  describe("noCachingStrategy", () => {
    it("should return the body unchanged", () => {
      const body = { system: "test", messages: [] };
      const result = CACHING_STRATEGIES.none(body);
      expect(result).toBe(body);
    });

    it("should not modify complex objects", () => {
      const body = {
        system: [{ text: "test" }],
        tools: [{ name: "test" }],
        messages: [{ content: "test" }],
      };
      const result = CACHING_STRATEGIES.none(body);
      expect(result).toBe(body);
    });
  });

  describe("systemOnlyStrategy", () => {
    it("should add cache_control to system messages array", () => {
      const body = {
        system: [{ text: "system message 1" }, { text: "system message 2" }],
        messages: [{ content: "user message" }],
      };

      const result = CACHING_STRATEGIES.systemOnly(body);

      expect(result.system).toEqual([
        { text: "system message 1", cache_control: { type: "ephemeral" } },
        { text: "system message 2", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.messages).toEqual(body.messages);
    });

    it("should return body unchanged if system is not an array", () => {
      const body = {
        system: "string system message",
        messages: [{ content: "user message" }],
      };

      const result = CACHING_STRATEGIES.systemOnly(body);
      expect(result).toEqual(body);
    });

    it("should return body unchanged if system is undefined", () => {
      const body = {
        messages: [{ content: "user message" }],
      };

      const result = CACHING_STRATEGIES.systemOnly(body);
      expect(result).toEqual(body);
    });

    it("should not add more than 5 cached messages", () => {
      const body = {
        system: [
          { text: "system message 1" },
          { text: "system message 2" },
          { text: "system message 3" },
          { text: "system message 4" },
          { text: "system message 5" },
        ],
        messages: [{ content: "user message" }],
      };

      const result = CACHING_STRATEGIES.systemOnly(body);

      expect(result.system).toEqual([
        { text: "system message 1", cache_control: { type: "ephemeral" } },
        { text: "system message 2", cache_control: { type: "ephemeral" } },
        { text: "system message 3", cache_control: { type: "ephemeral" } },
        { text: "system message 4", cache_control: { type: "ephemeral" } },
        { text: "system message 5" },
      ]);
      expect(result.messages).toEqual(body.messages);
    });
  });

  describe("systemAndToolsStrategy", () => {
    it("should add cache_control to both system and tools", () => {
      const body = {
        system: [{ text: "system message" }],
        tools: [{ name: "tool1" }, { name: "tool2" }],
        messages: [{ content: "user message" }],
      };

      const result = CACHING_STRATEGIES.systemAndTools(body);

      expect(result.system).toEqual([
        { text: "system message", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.tools).toEqual([
        { name: "tool1" },
        { name: "tool2", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.messages).toEqual(body.messages);
    });

    it("should handle missing system messages", () => {
      const body = {
        tools: [{ name: "tool1" }],
        messages: [{ content: "user message" }],
      };

      const result = CACHING_STRATEGIES.systemAndTools(body);

      expect(result.tools).toEqual([
        { name: "tool1", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.messages).toEqual(body.messages);
    });

    it("should handle missing tools", () => {
      const body = {
        system: [{ text: "system message" }],
        messages: [{ content: "user message" }],
      };

      const result = CACHING_STRATEGIES.systemAndTools(body);

      expect(result.system).toEqual([
        { text: "system message", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.messages).toEqual(body.messages);
    });

    it("should handle non-array system and tools", () => {
      const body = {
        system: "string system",
        tools: "string tools",
        messages: [{ content: "user message" }],
      };

      const result = CACHING_STRATEGIES.systemAndTools(body);
      expect(result).toEqual(body);
    });

    it("should add only 4 cache controls in total to both system and tools", () => {
      const body = {
        system: [
          { text: "system message 1" },
          { text: "system message 2" },
          { text: "system message 3" },
          { text: "system message 4" },
        ],
        tools: [{ name: "tool1" }, { name: "tool2" }],
        messages: [{ content: "user message" }],
      };

      const result = CACHING_STRATEGIES.systemAndTools(body);

      expect(result.system).toEqual([
        { text: "system message 1", cache_control: { type: "ephemeral" } },
        { text: "system message 2", cache_control: { type: "ephemeral" } },
        { text: "system message 3", cache_control: { type: "ephemeral" } },
        { text: "system message 4", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.tools).toEqual(body.tools);
      expect(result.messages).toEqual(body.messages);
    });
  });

  describe("optimizedStrategy", () => {
    it("should cache system messages and tools", () => {
      const body = {
        system: [{ text: "system message" }],
        tools: [{ name: "tool1" }],
        messages: [{ content: "short message" }],
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.system).toEqual([
        { text: "system message", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.tools).toEqual([
        { name: "tool1", cache_control: { type: "ephemeral" } },
      ]);
    });

    it("should cache large string messages (>500 tokens)", () => {
      const largeContent = "a".repeat(2100); // ~525 tokens
      const body = {
        messages: [{ content: largeContent }],
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.messages).toEqual([
        {
          content: [
            {
              type: "text",
              text: largeContent,
              cache_control: { type: "ephemeral" },
            },
          ],
        },
      ]);
    });

    it("should not cache small string messages (<500 tokens)", () => {
      const smallContent = "a".repeat(100); // ~25 tokens
      const body = {
        messages: [{ content: smallContent }],
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.messages).toEqual([{ content: smallContent }]);
    });

    it("should cache large text items in array content", () => {
      const largeText = "a".repeat(2100); // ~525 tokens
      const smallText = "a".repeat(100); // ~25 tokens
      const body = {
        messages: [
          {
            content: [
              { type: "text", text: largeText },
              { type: "text", text: smallText },
              { type: "image", data: "image_data" },
            ],
          },
        ],
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.messages).toEqual([
        {
          content: [
            {
              type: "text",
              text: largeText,
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: smallText },
            { type: "image", data: "image_data" },
          ],
        },
      ]);
    });

    it("should add maximum 4 cache control blocks", () => {
      const body = {
        system: [{ text: "system message 1" }, { text: "system message 2" }],
        tools: [{ name: "tool" }],
        messages: [
          { content: "small content" },
          { content: "a".repeat(2100) },
          { content: "b".repeat(2100) },
          {
            content: [
              { type: "text", text: "c".repeat(2100) },
              { type: "image", data: "image" },
            ],
          },
        ],
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.system).toEqual([
        { text: "system message 1", cache_control: { type: "ephemeral" } },
        { text: "system message 2", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.tools).toEqual([
        { name: "tool", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.messages[0]).toEqual({ content: "small content" });
      expect(result.messages[1]).toEqual({
        content: [
          {
            type: "text",
            text: "a".repeat(2100),
            cache_control: { type: "ephemeral" },
          },
        ],
      });
      expect(result.messages[2].content).toEqual(body.messages[2].content);
      expect(result.messages[3].content).toEqual(body.messages[3].content);
    });

    it("should handle complex message structure", () => {
      const body = {
        system: [{ text: "system" }],
        tools: [{ name: "tool" }],
        messages: [
          { content: "small content" },
          { content: "a".repeat(2100) }, // large content
          {
            content: [
              { type: "text", text: "a".repeat(2100) }, // large text
              { type: "image", data: "image" },
            ],
          },
        ],
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.system).toEqual([
        { text: "system", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.tools).toEqual([
        { name: "tool", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.messages[0]).toEqual({ content: "small content" });
      expect(result.messages[1]).toEqual({
        content: [
          {
            type: "text",
            text: "a".repeat(2100),
            cache_control: { type: "ephemeral" },
          },
        ],
      });
      expect(result.messages[2].content[0]).toEqual({
        type: "text",
        text: "a".repeat(2100),
        cache_control: { type: "ephemeral" },
      });
    });

    it("should handle empty or missing messages", () => {
      const body = {
        system: [{ text: "system" }],
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.system).toEqual([
        { text: "system", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.messages).toBeUndefined();
    });

    it("should handle non-array messages", () => {
      const body = {
        system: [{ text: "system" }],
        messages: "not an array",
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.system).toEqual([
        { text: "system", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.messages).toBe("not an array");
    });
  });

  describe("estimateTokenCount", () => {
    it("should estimate token count correctly", () => {
      // Test through the optimized strategy's behavior
      const smallContent = "a".repeat(100); // ~25 tokens
      const largeContent = "a".repeat(2100); // ~525 tokens

      const bodySmall = { messages: [{ content: smallContent }] };
      const bodyLarge = { messages: [{ content: largeContent }] };

      const resultSmall = CACHING_STRATEGIES.optimized(bodySmall);
      const resultLarge = CACHING_STRATEGIES.optimized(bodyLarge);

      // Small content should not be cached (remains string)
      expect(resultSmall.messages[0].content).toBe(smallContent);

      // Large content should be cached (converted to array)
      expect(Array.isArray(resultLarge.messages[0].content)).toBe(true);
    });
  });

  describe("getAvailableStrategies", () => {
    it("should return all strategy names", () => {
      const strategies = getAvailableStrategies();
      expect(strategies).toEqual([
        "none",
        "systemOnly",
        "systemAndTools",
        "optimized",
      ]);
    });
  });

  describe("getStrategyDescription", () => {
    it("should return correct descriptions for all strategies", () => {
      expect(getStrategyDescription("none")).toBe(
        "No caching - baseline for comparison",
      );
      expect(getStrategyDescription("systemOnly")).toBe(
        "Cache only system messages (current implementation)",
      );
      expect(getStrategyDescription("systemAndTools")).toBe(
        "Cache system messages and tool definitions (high impact)",
      );
      expect(getStrategyDescription("optimized")).toBe(
        "Intelligent caching - system, tools, and large content (best performance)",
      );
    });
  });

  describe("CACHING_STRATEGIES", () => {
    it("should contain all expected strategies", () => {
      expect(Object.keys(CACHING_STRATEGIES)).toEqual([
        "none",
        "systemOnly",
        "systemAndTools",
        "optimized",
      ]);
    });

    it("should have all strategies as functions", () => {
      Object.values(CACHING_STRATEGIES).forEach((strategy) => {
        expect(typeof strategy).toBe("function");
      });
    });
  });

  describe("CachingStrategy type", () => {
    it("should accept valid caching strategy functions", () => {
      const customStrategy: CachingStrategy = (body) => ({
        ...body,
        custom: true,
      });

      const input = { test: "value" };
      const result = customStrategy(input);

      expect(result).toEqual({ test: "value", custom: true });
    });
  });

  describe("CachingStrategyName type", () => {
    it("should work with valid strategy names", () => {
      const strategyNames: CachingStrategyName[] = [
        "none",
        "systemOnly",
        "systemAndTools",
        "optimized",
      ];

      strategyNames.forEach((name) => {
        expect(typeof CACHING_STRATEGIES[name]).toBe("function");
      });
    });
  });
});
