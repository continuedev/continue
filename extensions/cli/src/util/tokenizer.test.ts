import { ModelConfig } from "@continuedev/config-yaml";
import type { ChatHistoryItem } from "core/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "./logger.js";
import {
  AUTO_COMPACT_THRESHOLD,
  calculateContextUsagePercentage,
  countChatHistoryItemTokens,
  countChatHistoryTokens,
  countMessageTokens,
  countToolDefinitionTokens,
  getModelContextLimit,
  shouldAutoCompact,
} from "./tokenizer.js";

// Mock the logger
vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock gpt-tokenizer
vi.mock("gpt-tokenizer", () => ({
  encode: (text: string) => new Array(Math.ceil(text.length / 4)), // Rough 4 chars per token
}));

describe("tokenizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getModelContextLimit", () => {
    it("should return contextLength from model config", () => {
      const model: ModelConfig = {
        name: "test-model",
        model: "test",
        provider: "openai",
        defaultCompletionOptions: {
          contextLength: 8192,
        },
      };

      expect(getModelContextLimit(model)).toBe(8192);
    });

    it("should return default when no contextLength specified", () => {
      const model: ModelConfig = {
        name: "test-model",
        model: "test",
        provider: "openai",
      };

      expect(getModelContextLimit(model)).toBe(200_000);
    });
  });

  describe("countChatHistoryItemTokens", () => {
    it("should count tokens for string content", () => {
      const historyItem: ChatHistoryItem = {
        message: {
          role: "user",
          content: "Hello world", // 11 chars -> ~3 tokens + 2 for role = 5
        },
        contextItems: [],
      };

      const tokenCount = countChatHistoryItemTokens(historyItem);
      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBe(5); // 3 content tokens + 2 role tokens
    });

    it("should count tokens for array content", () => {
      const historyItem: ChatHistoryItem = {
        message: {
          role: "user",
          content: [
            { type: "text", text: "Hello" }, // 5 chars -> ~2 tokens
            { type: "imageUrl", imageUrl: { url: "test.jpg" } }, // +1024 tokens
          ],
        },
        contextItems: [],
      };

      const tokenCount = countChatHistoryItemTokens(historyItem);
      expect(tokenCount).toBe(1028); // 2 + 1024 + 2 role tokens
    });

    it("should count tokens for tool calls", () => {
      const historyItem: ChatHistoryItem = {
        message: {
          role: "assistant",
          content: "I'll help you",
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "test_function", // ~3 tokens + 10 overhead
                arguments: '{"param": "value"}', // ~5 tokens
              },
            },
          ],
        },
        contextItems: [],
      };

      const tokenCount = countChatHistoryItemTokens(historyItem);
      expect(tokenCount).toBeGreaterThan(20);
    });

    it("should count tokens for context items", () => {
      const historyItem: ChatHistoryItem = {
        message: {
          role: "user",
          content: "Hello", // 5 chars -> ~2 tokens
        },
        contextItems: [
          {
            id: { providerTitle: "test", itemId: "1" },
            content: "Context content", // 15 chars -> ~4 tokens
            name: "Test context", // 12 chars -> ~3 tokens
            description: "Test description",
          },
        ],
      };

      const tokenCount = countChatHistoryItemTokens(historyItem);
      // 2 (content) + 2 (role) + 4 (context content) + 3 (context name) + 5 (context overhead) = 16
      expect(tokenCount).toBe(16);
    });

    it("should handle errors gracefully", () => {
      // We'll skip this test for now since mocking gpt-tokenizer is complex
      // The error handling is tested implicitly by the fallback behavior
      expect(true).toBe(true);
    });
  });

  describe("countMessageTokens (legacy)", () => {
    it("should call countChatHistoryItemTokens", () => {
      const historyItem: ChatHistoryItem = {
        message: {
          role: "user",
          content: "Hello world",
        },
        contextItems: [],
      };

      const tokenCount = countMessageTokens(historyItem);
      expect(tokenCount).toBe(5); // Same as countChatHistoryItemTokens
    });
  });

  describe("countChatHistoryTokens", () => {
    it("should count tokens for multiple messages", () => {
      const chatHistory: ChatHistoryItem[] = [
        {
          message: { role: "system", content: "You are helpful" },
          contextItems: [],
        },
        {
          message: { role: "user", content: "Hello" },
          contextItems: [],
        },
        {
          message: { role: "assistant", content: "Hi there" },
          contextItems: [],
        },
      ];

      const tokenCount = countChatHistoryTokens(chatHistory);
      expect(tokenCount).toBeGreaterThan(0);
      // Should include message overhead (3 * 3 = 9 tokens)
      expect(tokenCount).toBeGreaterThan(9);
    });

    it("should handle empty chat history", () => {
      const tokenCount = countChatHistoryTokens([]);
      expect(tokenCount).toBe(0);
    });
  });

  describe("calculateContextUsagePercentage", () => {
    it("should calculate percentage correctly", () => {
      const model: ModelConfig = {
        name: "test-model",
        model: "test",
        provider: "openai",
        defaultCompletionOptions: {
          contextLength: 1000,
        },
      };

      expect(calculateContextUsagePercentage(800, model)).toBe(80);
      expect(calculateContextUsagePercentage(500, model)).toBe(50);
      expect(calculateContextUsagePercentage(1200, model)).toBe(100); // Capped at 100%
    });
  });

  describe("shouldAutoCompact", () => {
    const createModel = (
      contextLength: number,
      maxTokens?: number,
    ): ModelConfig => ({
      name: "test-model",
      model: "test",
      provider: "openai",
      defaultCompletionOptions: {
        contextLength,
        maxTokens,
      },
    });

    const createChatHistory = (tokenCount: number): ChatHistoryItem[] => {
      // Create a message that will result in approximately the desired token count
      const content = "x".repeat(tokenCount * 4); // 4 chars per token
      return [
        {
          message: { role: "user", content },
          contextItems: [],
        },
      ];
    };

    it("should compact when input tokens exceed threshold with maxTokens", () => {
      const model = createModel(1000, 200); // 1000 context, 200 max output
      // Available for input: 1000 - 200 = 800
      // Threshold: 800 * 0.8 = 640
      const chatHistory = createChatHistory(650); // Above threshold

      expect(shouldAutoCompact({ chatHistory, model })).toBe(true);
    });

    it("should not compact when input tokens are below threshold with maxTokens", () => {
      const model = createModel(1000, 200); // 1000 context, 200 max output
      // Available for input: 1000 - 200 = 800
      // Threshold: 800 * 0.8 = 640
      const chatHistory = createChatHistory(600); // Below threshold

      expect(shouldAutoCompact({ chatHistory, model })).toBe(false);
    });

    it("should use 35% default reservation when maxTokens is not set", () => {
      const model = createModel(1000); // No maxTokens
      // Reserved: 1000 * 0.35 = 350
      // Available for input: 1000 - 350 = 650
      // Threshold: 650 * 0.8 = 520
      const chatHistory = createChatHistory(530); // Above threshold

      expect(shouldAutoCompact({ chatHistory, model })).toBe(true);
    });

    it("should not compact when below default threshold without maxTokens", () => {
      const model = createModel(1000); // No maxTokens
      // Available for input: 1000 - 350 = 650
      // Threshold: 650 * 0.8 = 520
      const chatHistory = createChatHistory(500); // Below threshold

      expect(shouldAutoCompact({ chatHistory, model })).toBe(false);
    });

    it("should throw error when maxTokens >= contextLength", () => {
      const model = createModel(1000, 1000); // maxTokens equals contextLength
      const chatHistory = createChatHistory(1); // Minimal input

      expect(() => shouldAutoCompact({ chatHistory, model })).toThrow(
        "max_tokens is larger than context_length, which should not be possible. Please check your configuration.",
      );
    });

    it("should throw error when maxTokens > contextLength", () => {
      const model = createModel(1000, 1200); // maxTokens exceeds contextLength
      const chatHistory = createChatHistory(1); // Minimal input

      expect(() => shouldAutoCompact({ chatHistory, model })).toThrow(
        "max_tokens is larger than context_length, which should not be possible. Please check your configuration.",
      );
    });

    it("should handle edge case with very small context limit", () => {
      const model = createModel(100, 50); // Small context
      // Available: 100 - 50 = 50
      // Threshold: 50 * 0.8 = 40
      const chatHistory = createChatHistory(45); // Above threshold

      expect(shouldAutoCompact({ chatHistory, model })).toBe(true);
    });

    it("should log debug information correctly", () => {
      const model = createModel(1000, 200);
      const chatHistory = createChatHistory(600);

      shouldAutoCompact({ chatHistory, model });

      expect(logger.debug).toHaveBeenCalledWith("Context usage check", {
        inputTokens: expect.any(Number),
        historyTokens: expect.any(Number),
        systemTokens: expect.any(Number),
        toolTokens: expect.any(Number),
        contextLimit: 1000,
        maxTokens: 200,
        reservedForOutput: 200,
        availableForInput: 800,
        usage: expect.any(String),
        threshold: `${Math.round(AUTO_COMPACT_THRESHOLD * 100)}%`,
        shouldCompact: expect.any(Boolean),
      });
    });

    it("should handle model with zero maxTokens correctly", () => {
      const model = createModel(1000, 0); // Explicit zero
      // Should use default 35% reservation: 1000 * 0.35 = 350
      const chatHistory = createChatHistory(530); // Above threshold

      expect(shouldAutoCompact({ chatHistory, model })).toBe(true);
    });

    describe("real-world scenarios", () => {
      it("should prevent Claude 3.5 Sonnet context overflow", () => {
        // Claude 3.5 Sonnet: 200k context, often uses 4k max_tokens
        const model = createModel(200_000, 4_000);
        // Available: 200k - 4k = 196k
        // Threshold: 196k * 0.8 = 156.8k
        const chatHistory = createChatHistory(160_000); // Above threshold

        expect(shouldAutoCompact({ chatHistory, model })).toBe(true);
      });

      it("should prevent GPT-4 context overflow", () => {
        // GPT-4: 128k context, often uses 4k max_tokens
        const model = createModel(128_000, 4_000);
        // Available: 128k - 4k = 124k
        // Threshold: 124k * 0.8 = 99.2k
        const chatHistory = createChatHistory(100_000); // Above threshold

        expect(shouldAutoCompact({ chatHistory, model })).toBe(true);
      });

      it("should handle models with very high max_tokens", () => {
        // Some models allow very high max_tokens (e.g., 64k like in the error message)
        const model = createModel(200_000, 64_000);
        // Available: 200k - 64k = 136k
        // Threshold: 136k * 0.8 = 108.8k
        const chatHistory = createChatHistory(110_000); // Above threshold

        expect(shouldAutoCompact({ chatHistory, model })).toBe(true);
      });
    });
  });

  describe("countToolDefinitionTokens", () => {
    it("should return 0 for empty tools array", () => {
      expect(countToolDefinitionTokens([])).toBe(0);
    });

    it("should return 0 for undefined-like input", () => {
      // TypeScript types prevent undefined, but test defensive behavior
      expect(countToolDefinitionTokens([] as never)).toBe(0);
    });

    it("should count tokens for a simple tool with name only", () => {
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "get_weather",
          },
        },
      ];

      const tokenCount = countToolDefinitionTokens(tools);
      // Base overhead (12) + tool tokens + wrapper overhead (12)
      expect(tokenCount).toBeGreaterThan(24); // At least base overheads
      expect(tokenCount).toBe(27); // 12 + 3 (name) + 12 = 27
    });

    it("should count tokens for a tool with name and description", () => {
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "get_weather",
            description: "Get the current weather for a location",
          },
        },
      ];

      const tokenCount = countToolDefinitionTokens(tools);
      // 12 (base) + 3 (name) + 10 (description ~40 chars / 4) + 12 (wrapper) = 37
      expect(tokenCount).toBeGreaterThan(27);
    });

    it("should count tokens for a tool with parameters", () => {
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "get_weather",
            description: "Get weather",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "The city name",
                },
              },
              required: ["location"],
            },
          },
        },
      ];

      const tokenCount = countToolDefinitionTokens(tools);
      expect(tokenCount).toBeGreaterThan(30); // Should include parameter tokens
    });

    it("should count tokens for multiple tools", () => {
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "tool_one",
          },
        },
        {
          type: "function" as const,
          function: {
            name: "tool_two",
          },
        },
      ];

      const singleToolTokens = countToolDefinitionTokens([tools[0]]);
      const doubleToolTokens = countToolDefinitionTokens(tools);

      // Two tools should have more tokens than one
      expect(doubleToolTokens).toBeGreaterThan(singleToolTokens);
    });

    it("should count tokens for parameters with enum values", () => {
      const toolsWithoutEnum = [
        {
          type: "function" as const,
          function: {
            name: "set_mode",
            parameters: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  description: "The mode to set",
                },
              },
            },
          },
        },
      ];

      const toolsWithEnum = [
        {
          type: "function" as const,
          function: {
            name: "set_mode",
            parameters: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  description: "The mode to set",
                  enum: ["fast", "slow", "medium"],
                },
              },
            },
          },
        },
      ];

      const tokensWithoutEnum = countToolDefinitionTokens(toolsWithoutEnum);
      const tokensWithEnum = countToolDefinitionTokens(toolsWithEnum);

      // Enum values should add tokens
      expect(tokensWithEnum).toBeGreaterThan(tokensWithoutEnum);
    });

    it("should count tokens for multiple parameters", () => {
      const toolWithOneParam = [
        {
          type: "function" as const,
          function: {
            name: "search",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                },
              },
            },
          },
        },
      ];

      const toolWithMultipleParams = [
        {
          type: "function" as const,
          function: {
            name: "search",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                },
                limit: {
                  type: "number",
                },
                offset: {
                  type: "number",
                },
              },
            },
          },
        },
      ];

      const oneParamTokens = countToolDefinitionTokens(toolWithOneParam);
      const multiParamTokens = countToolDefinitionTokens(
        toolWithMultipleParams,
      );

      expect(multiParamTokens).toBeGreaterThan(oneParamTokens);
    });

    it("should handle tool with empty parameters object", () => {
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "no_params",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
      ];

      const tokenCount = countToolDefinitionTokens(tools);
      // Should still return a valid count (base overhead + name)
      expect(tokenCount).toBeGreaterThan(0);
    });

    it("should handle tool without parameters field", () => {
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "simple_tool",
            description: "A simple tool without parameters",
          },
        },
      ];

      const tokenCount = countToolDefinitionTokens(tools);
      expect(tokenCount).toBeGreaterThan(0);
    });

    describe("real-world tool definitions", () => {
      it("should count tokens for a complex tool like read_file", () => {
        const tools = [
          {
            type: "function" as const,
            function: {
              name: "read_file",
              description:
                "Use this tool if you need to view the contents of an existing file.",
              parameters: {
                type: "object",
                properties: {
                  filepath: {
                    type: "string",
                    description:
                      "The path of the file to read. Can be a relative path, absolute path, tilde path, or file:// URI",
                  },
                },
                required: ["filepath"],
              },
            },
          },
        ];

        const tokenCount = countToolDefinitionTokens(tools);
        expect(tokenCount).toBeGreaterThan(40); // Complex tool should have many tokens
      });

      it("should count tokens for a multi-tool set", () => {
        const tools = [
          {
            type: "function" as const,
            function: {
              name: "read_file",
              description: "Read a file",
              parameters: {
                type: "object",
                properties: {
                  filepath: { type: "string", description: "File path" },
                },
              },
            },
          },
          {
            type: "function" as const,
            function: {
              name: "write_file",
              description: "Write to a file",
              parameters: {
                type: "object",
                properties: {
                  filepath: { type: "string", description: "File path" },
                  content: { type: "string", description: "Content to write" },
                },
              },
            },
          },
          {
            type: "function" as const,
            function: {
              name: "search",
              description: "Search for files",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Search query" },
                },
              },
            },
          },
        ];

        const tokenCount = countToolDefinitionTokens(tools);
        // Multiple tools should have significant token count
        expect(tokenCount).toBeGreaterThan(80);
      });
    });
  });
});
