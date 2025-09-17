import { MessageCreateParams, ToolUnion } from "@anthropic-ai/sdk/resources";
import {
  CACHING_STRATEGIES,
  CachingStrategyName,
  getAvailableStrategies,
  getStrategyDescription,
} from "./AnthropicCachingStrategies.js";

const body_params = {
  model: "claude",
  stream: true,
  max_tokens: 8192,
};

const makeTool = (name: string): ToolUnion => ({
  name,
  input_schema: {
    type: "object",
  },
});

describe("AnthropicCachingStrategies", () => {
  describe("noCachingStrategy", () => {
    it("should return the body unchanged", () => {
      const body: MessageCreateParams = {
        system: "test",
        messages: [],
        ...body_params,
      };
      const result = CACHING_STRATEGIES.none(body);
      expect(result).toBe(body);
    });

    it("should not modify complex objects", () => {
      const body: MessageCreateParams = {
        system: [{ type: "text", text: "test" }],
        tools: [makeTool("test")],
        messages: [{ role: "user", content: "test" }],
        ...body_params,
      };
      const result = CACHING_STRATEGIES.none(body);
      expect(result).toBe(body);
    });
  });

  describe("systemOnlyStrategy", () => {
    it("should add cache_control to system messages array", () => {
      const body: MessageCreateParams = {
        system: [
          { type: "text", text: "system message 1" },
          { type: "text", text: "system message 2" },
        ],
        messages: [{ role: "user", content: "user message" }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.systemOnly(body);

      expect(result.system).toEqual([
        {
          type: "text",
          text: "system message 1",
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: "system message 2",
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.messages).toEqual(body.messages);
    });

    it("should return body unchanged if system is not an array", () => {
      const body: MessageCreateParams = {
        system: "string system message",
        messages: [{ role: "user", content: "user message" }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.systemOnly(body);
      expect(result).toEqual(body);
    });

    it("should return body unchanged if system is undefined", () => {
      const body: MessageCreateParams = {
        messages: [{ role: "user", content: "user message" }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.systemOnly(body);
      expect(result).toEqual(body);
    });

    it("should not add more than 5 cached messages", () => {
      const body: MessageCreateParams = {
        system: [
          { type: "text", text: "system message 1" },
          { type: "text", text: "system message 2" },
          { type: "text", text: "system message 3" },
          { type: "text", text: "system message 4" },
          { type: "text", text: "system message 5" },
        ],
        messages: [{ role: "user", content: "user message" }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.systemOnly(body);

      expect(result.system).toEqual([
        {
          type: "text",
          text: "system message 1",
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: "system message 2",
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: "system message 3",
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: "system message 4",
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: "system message 5" },
      ]);
      expect(result.messages).toEqual(body.messages);
    });
  });

  describe("systemAndToolsStrategy", () => {
    it("should add cache_control to both system and tools", () => {
      const body: MessageCreateParams = {
        system: [{ type: "text", text: "system message" }],
        tools: [makeTool("tool1"), makeTool("tool2")],
        messages: [{ role: "user", content: "user message" }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.systemAndTools(body);

      expect(result.system).toEqual([
        {
          type: "text",
          text: "system message",
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.tools).toEqual([
        {
          name: "tool1",
          input_schema: {
            type: "object",
          },
        },
        {
          name: "tool2",
          input_schema: {
            type: "object",
          },
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.messages).toEqual(body.messages);
    });

    it("should handle missing system messages", () => {
      const body: MessageCreateParams = {
        tools: [makeTool("tool1")],
        messages: [{ role: "user", content: "user message" }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.systemAndTools(body);

      expect(result.tools).toEqual([
        {
          name: "tool1",
          input_schema: {
            type: "object",
          },
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.messages).toEqual(body.messages);
    });

    it("should handle missing tools", () => {
      const body: MessageCreateParams = {
        system: [{ type: "text", text: "system message" }],
        messages: [{ role: "user", content: "user message" }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.systemAndTools(body);

      expect(result.system).toEqual([
        {
          type: "text",
          text: "system message",
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.messages).toEqual(body.messages);
    });

    it("should add only 4 cache controls in total to both system and tools", () => {
      const body: MessageCreateParams = {
        system: [
          { type: "text", text: "system message 1" },
          { type: "text", text: "system message 2" },
          { type: "text", text: "system message 3" },
          { type: "text", text: "system message 4" },
        ],
        tools: [makeTool("tool1"), makeTool("tool2")],
        messages: [{ role: "user", content: "user message" }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.systemAndTools(body);

      expect(result.system).toEqual([
        {
          type: "text",
          text: "system message 1",
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: "system message 2",
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: "system message 3",
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: "system message 4",
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.tools).toEqual(body.tools);
      expect(result.messages).toEqual(body.messages);
    });
  });

  describe("optimizedStrategy", () => {
    it("should cache system messages and tools", () => {
      const body: MessageCreateParams = {
        system: [{ type: "text", text: "system message" }],
        tools: [makeTool("tool1")],
        messages: [{ role: "user", content: "short message" }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.system).toEqual([
        {
          type: "text",
          text: "system message",
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.tools).toEqual([
        {
          name: "tool1",
          input_schema: {
            type: "object",
          },
          cache_control: { type: "ephemeral" },
        },
      ]);
    });

    it("should cache large string messages (>500 tokens)", () => {
      const largeContent = "a".repeat(2100); // ~525 tokens
      const body: MessageCreateParams = {
        messages: [{ role: "user", content: largeContent }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.messages).toEqual([
        {
          role: "user",
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
      const body: MessageCreateParams = {
        messages: [{ role: "user", content: smallContent }],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.messages).toEqual([
        { role: "user", content: smallContent },
      ]);
    });

    it("should cache large text items in array content but only once per message", () => {
      const largeText = "a".repeat(2100); // ~525 tokens
      const anotherLargeText = "b".repeat(2100); // Also ~525 tokens
      const smallText = "a".repeat(100); // ~25 tokens
      const body: MessageCreateParams = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: largeText },
              { type: "text", text: anotherLargeText },
              { type: "text", text: smallText },
              {
                type: "image",
                source: {
                  data: "image_data",
                  media_type: "image/jpeg",
                  type: "base64",
                },
              },
            ],
          },
        ],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.optimized(body);

      // Only the first large text item should get cache_control
      expect(result.messages).toEqual([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: largeText,
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: anotherLargeText },
            { type: "text", text: smallText },
            {
              type: "image",
              source: {
                data: "image_data",
                media_type: "image/jpeg",
                type: "base64",
              },
            },
          ],
        },
      ]);
    });

    it("should add maximum 4 cache control blocks", () => {
      const body: MessageCreateParams = {
        system: [
          { type: "text", text: "system message 1" },
          { type: "text", text: "system message 2" },
        ],
        tools: [makeTool("tool")],
        messages: [
          { role: "user", content: "small content" },
          { role: "user", content: "a".repeat(2100) },
          { role: "user", content: "b".repeat(2100) },
          {
            role: "user",
            content: [
              { type: "text", text: "c".repeat(2100) },
              {
                type: "image",
                source: {
                  data: "image_data",
                  media_type: "image/jpeg",
                  type: "base64",
                },
              },
            ],
          },
        ],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.system).toEqual([
        {
          type: "text",
          text: "system message 1",
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: "system message 2",
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.tools).toEqual([
        {
          name: "tool",
          input_schema: {
            type: "object",
          },
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.messages[0]).toEqual({
        role: "user",
        content: "small content",
      });

      expect(result.messages[1]).toEqual({
        role: "user",
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
      const body: MessageCreateParams = {
        system: [{ type: "text", text: "system" }],
        tools: [makeTool("tool")],
        messages: [
          { role: "user", content: "small content" },
          { role: "user", content: "a".repeat(2100) }, // large content
          {
            role: "user",
            content: [
              { type: "text", text: "a".repeat(2100) }, // large text
              {
                type: "image",
                source: {
                  data: "image_data",
                  media_type: "image/jpeg",
                  type: "base64",
                },
              },
            ],
          },
        ],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.system).toEqual([
        { type: "text", text: "system", cache_control: { type: "ephemeral" } },
      ]);
      expect(result.tools).toEqual([
        {
          name: "tool",
          input_schema: {
            type: "object",
          },
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(result.messages[0]).toEqual({
        role: "user",
        content: "small content",
      });
      expect(result.messages[1]).toEqual({
        role: "user",
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
      const body: MessageCreateParams = {
        system: [{ type: "text", text: "system" }],
        messages: [],
        ...body_params,
      };

      const result = CACHING_STRATEGIES.optimized(body);

      expect(result.system).toEqual([
        { type: "text", text: "system", cache_control: { type: "ephemeral" } },
      ]);
    });
  });

  describe("estimateTokenCount", () => {
    it("should estimate token count correctly", () => {
      // Test through the optimized strategy's behavior
      const smallContent = "a".repeat(100); // ~25 tokens
      const largeContent = "a".repeat(2100); // ~525 tokens

      const bodySmall: MessageCreateParams = {
        messages: [{ role: "user", content: smallContent }],
        ...body_params,
      };
      const bodyLarge: MessageCreateParams = {
        messages: [{ role: "user", content: largeContent }],
        ...body_params,
      };

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
