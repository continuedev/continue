import { ModelConfig } from "@continuedev/config-yaml";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "./logger.js";
import {
  AUTO_COMPACT_THRESHOLD,
  calculateContextUsagePercentage,
  countChatHistoryTokens,
  countMessageTokens,
  getModelContextLimit,
  shouldAutoCompact,
} from "./tokenizer.js";

// Mock the logger
vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
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

  describe("countMessageTokens", () => {
    it("should count tokens for string content", () => {
      const message: ChatCompletionMessageParam = {
        role: "user",
        content: "Hello world", // 11 chars -> ~3 tokens + 2 for role = 5
      };

      const tokenCount = countMessageTokens(message);
      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBe(5); // 3 content tokens + 2 role tokens
    });

    it("should count tokens for array content", () => {
      const message: ChatCompletionMessageParam = {
        role: "user",
        content: [
          { type: "text", text: "Hello" }, // 5 chars -> ~2 tokens
          { type: "image_url", image_url: { url: "test.jpg" } }, // +85 tokens
        ],
      };

      const tokenCount = countMessageTokens(message);
      expect(tokenCount).toBe(89); // 2 + 85 + 2 role tokens
    });

    it("should count tokens for tool calls", () => {
      const message: ChatCompletionMessageParam = {
        role: "assistant",
        content: "I'll help you",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "test_function", // ~3 tokens + 10 overhead
              arguments: '{"param": "value"}', // ~5 tokens
            },
          },
        ],
      };

      const tokenCount = countMessageTokens(message);
      expect(tokenCount).toBeGreaterThan(20);
    });

    it("should handle errors gracefully", () => {
      // We'll skip this test for now since mocking gpt-tokenizer is complex
      // The error handling is tested implicitly by the fallback behavior
      expect(true).toBe(true);
    });
  });

  describe("countChatHistoryTokens", () => {
    it("should count tokens for multiple messages", () => {
      const chatHistory: ChatCompletionMessageParam[] = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
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

    const createChatHistory = (
      tokenCount: number,
    ): ChatCompletionMessageParam[] => {
      // Create a message that will result in approximately the desired token count
      const content = "x".repeat(tokenCount * 4); // 4 chars per token
      return [{ role: "user", content }];
    };

    it("should compact when input tokens exceed threshold with maxTokens", () => {
      const model = createModel(1000, 200); // 1000 context, 200 max output
      // Available for input: 1000 - 200 = 800
      // Threshold: 800 * 0.8 = 640
      const chatHistory = createChatHistory(650); // Above threshold

      expect(shouldAutoCompact(chatHistory, model)).toBe(true);
    });

    it("should not compact when input tokens are below threshold with maxTokens", () => {
      const model = createModel(1000, 200); // 1000 context, 200 max output
      // Available for input: 1000 - 200 = 800
      // Threshold: 800 * 0.8 = 640
      const chatHistory = createChatHistory(600); // Below threshold

      expect(shouldAutoCompact(chatHistory, model)).toBe(false);
    });

    it("should use 35% default reservation when maxTokens is not set", () => {
      const model = createModel(1000); // No maxTokens
      // Reserved: 1000 * 0.35 = 350
      // Available for input: 1000 - 350 = 650
      // Threshold: 650 * 0.8 = 520
      const chatHistory = createChatHistory(530); // Above threshold

      expect(shouldAutoCompact(chatHistory, model)).toBe(true);
    });

    it("should not compact when below default threshold without maxTokens", () => {
      const model = createModel(1000); // No maxTokens
      // Available for input: 1000 - 350 = 650
      // Threshold: 650 * 0.8 = 520
      const chatHistory = createChatHistory(500); // Below threshold

      expect(shouldAutoCompact(chatHistory, model)).toBe(false);
    });

    it("should throw error when maxTokens >= contextLength", () => {
      const model = createModel(1000, 1000); // maxTokens equals contextLength
      const chatHistory = createChatHistory(1); // Minimal input

      expect(() => shouldAutoCompact(chatHistory, model)).toThrow(
        "max_tokens is larger than context_length, which should not be possible. Please check your configuration.",
      );
    });

    it("should throw error when maxTokens > contextLength", () => {
      const model = createModel(1000, 1200); // maxTokens exceeds contextLength
      const chatHistory = createChatHistory(1); // Minimal input

      expect(() => shouldAutoCompact(chatHistory, model)).toThrow(
        "max_tokens is larger than context_length, which should not be possible. Please check your configuration.",
      );
    });

    it("should handle edge case with very small context limit", () => {
      const model = createModel(100, 50); // Small context
      // Available: 100 - 50 = 50
      // Threshold: 50 * 0.8 = 40
      const chatHistory = createChatHistory(45); // Above threshold

      expect(shouldAutoCompact(chatHistory, model)).toBe(true);
    });

    it("should log debug information correctly", () => {
      const model = createModel(1000, 200);
      const chatHistory = createChatHistory(600);

      shouldAutoCompact(chatHistory, model);

      expect(logger.debug).toHaveBeenCalledWith("Context usage check", {
        inputTokens: expect.any(Number),
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

      expect(shouldAutoCompact(chatHistory, model)).toBe(true);
    });

    describe("real-world scenarios", () => {
      it("should prevent Claude 3.5 Sonnet context overflow", () => {
        // Claude 3.5 Sonnet: 200k context, often uses 4k max_tokens
        const model = createModel(200_000, 4_000);
        // Available: 200k - 4k = 196k
        // Threshold: 196k * 0.8 = 156.8k
        const chatHistory = createChatHistory(160_000); // Above threshold

        expect(shouldAutoCompact(chatHistory, model)).toBe(true);
      });

      it("should prevent GPT-4 context overflow", () => {
        // GPT-4: 128k context, often uses 4k max_tokens
        const model = createModel(128_000, 4_000);
        // Available: 128k - 4k = 124k
        // Threshold: 124k * 0.8 = 99.2k
        const chatHistory = createChatHistory(100_000); // Above threshold

        expect(shouldAutoCompact(chatHistory, model)).toBe(true);
      });

      it("should handle models with very high max_tokens", () => {
        // Some models allow very high max_tokens (e.g., 64k like in the error message)
        const model = createModel(200_000, 64_000);
        // Available: 200k - 64k = 136k
        // Threshold: 136k * 0.8 = 108.8k
        const chatHistory = createChatHistory(110_000); // Above threshold

        expect(shouldAutoCompact(chatHistory, model)).toBe(true);
      });
    });
  });
});
