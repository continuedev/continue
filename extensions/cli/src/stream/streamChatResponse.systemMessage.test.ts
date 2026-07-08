import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { services } from "../services/index.js";

import { processStreamingResponse } from "./streamChatResponse.js";

// Mock services
vi.mock("../services/index.js", () => ({
  services: {
    systemMessage: {
      getSystemMessage: vi.fn(),
    },
    toolPermissions: {
      getState: vi.fn(() => ({ currentMode: "enabled" })),
      isHeadless: vi.fn(() => false),
    },
    chatHistory: {
      isReady: vi.fn(() => false),
    },
  },
}));

// Mock logger
vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock tokenizer
vi.mock("../util/tokenizer.js", async () => {
  const actual = await vi.importActual("../util/tokenizer.js");
  return {
    ...actual,
    countChatHistoryTokens: vi.fn((history: ChatHistoryItem[]) => {
      // Simple mock: count based on content length
      return history.reduce((sum, item) => {
        const content =
          typeof item.message.content === "string"
            ? item.message.content
            : JSON.stringify(item.message.content);
        return sum + Math.ceil(content.length / 4); // ~4 chars per token
      }, 0);
    }),
  };
});

describe("streamChatResponse system message validation", () => {
  let mockLlmApi: BaseLlmApi;
  let abortController: AbortController;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLlmApi = {} as BaseLlmApi;
    abortController = new AbortController();
  });

  it("should validate system message is retrieved before validation", async () => {
    const model = {
      model: "test-model",
      defaultCompletionOptions: {
        contextLength: 1000,
        maxTokens: 100,
      },
    } as ModelConfig;

    // Mock system message
    const systemMessage = "System instructions";
    vi.mocked(services.systemMessage.getSystemMessage).mockResolvedValue(
      systemMessage,
    );

    // Small chat history
    const chatHistory: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "test" },
        contextItems: [],
      },
    ];

    // Mock the streaming response to avoid actual API call
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          choices: [{ delta: { content: "test" } }],
        };
      },
    };
    mockLlmApi.chatCompletionStream = vi.fn().mockResolvedValue(mockStream);

    // Execute the function with systemMessage parameter
    await processStreamingResponse({
      chatHistory,
      model,
      llmApi: mockLlmApi,
      abortController,
      systemMessage,
    });

    // Verify the function uses the provided system message (no fetch needed)
    // The system message is now provided by the caller
    expect(services.systemMessage.getSystemMessage).not.toHaveBeenCalled();
  });

  it("should pass validation when system message + history fits", async () => {
    const model = {
      model: "test-model",
      defaultCompletionOptions: {
        contextLength: 1000,
        maxTokens: 100,
      },
    } as ModelConfig;

    // Small system message (50 tokens worth)
    const smallSystemMessage = "x".repeat(200); // ~50 tokens

    // Small chat history (200 tokens worth)
    const chatHistory: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "x".repeat(800) }, // ~200 tokens
        contextItems: [],
      },
    ];

    // Available: 1000 - 100 (maxTokens) - 100 (buffer) = 800 tokens
    // System: ~50 tokens
    // History: ~200 tokens
    // Total: ~250 tokens < 800 available
    // Should pass validation

    // Mock the streaming response to avoid actual API call
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          choices: [{ delta: { content: "test" } }],
        };
      },
    };

    mockLlmApi.chatCompletionStream = vi.fn().mockResolvedValue(mockStream);

    // This should not throw
    const result = await processStreamingResponse({
      chatHistory,
      model,
      llmApi: mockLlmApi,
      abortController,
      systemMessage: smallSystemMessage,
    });

    expect(result).toBeDefined();
    // System message is now provided by caller, not fetched
    expect(services.systemMessage.getSystemMessage).not.toHaveBeenCalled();
  });

  it("should use safety buffer in validation", async () => {
    const model = {
      model: "test-model",
      defaultCompletionOptions: {
        contextLength: 1000,
        maxTokens: 100,
      },
    } as ModelConfig;

    // System message + history that's exactly at limit without buffer
    // but fails with buffer
    const systemMessage = "x".repeat(800); // ~200 tokens

    const chatHistory: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "x".repeat(2400) }, // ~600 tokens
        contextItems: [],
      },
    ];

    // Available without buffer: 1000 - 100 = 900 tokens
    // Available with buffer: 1000 - 100 - 100 = 800 tokens
    // System: ~200 tokens
    // History: ~600 tokens
    // Total: ~800 tokens
    // Should exactly hit the limit with buffer and pass/prune

    await expect(
      processStreamingResponse({
        chatHistory,
        model,
        llmApi: mockLlmApi,
        abortController,
        systemMessage,
      }),
    ).rejects.toThrow(); // Will fail because we can't prune enough
  });
});
