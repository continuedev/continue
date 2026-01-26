import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { convertToUnifiedHistory } from "core/util/messageConversion.js";
import type { ChatCompletionChunk } from "openai/resources/chat/completions.mjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { streamChatResponse } from "./streamChatResponse.js";

// Mock all dependencies
vi.mock("../compaction.js", () => ({
  compactChatHistory: vi.fn(),
  pruneLastMessage: vi.fn((history) => history.slice(0, -1)),
  shouldAutoCompact: vi.fn(),
  getAutoCompactMessage: vi.fn(() => "Auto-compacting..."),
}));

vi.mock("../session.js", () => ({
  updateSessionHistory: vi.fn(),
  trackSessionUsage: vi.fn(),
}));

vi.mock("../util/tokenizer.js", () => ({
  countChatHistoryItemTokens: vi.fn(() => 100),
  validateContextLength: vi.fn(() => ({ isValid: true })),
}));

vi.mock("../telemetry/telemetryService.js", () => ({
  telemetryService: {
    logApiRequest: vi.fn(),
    recordResponseTime: vi.fn(),
    recordTokenUsage: vi.fn(),
    recordCost: vi.fn(),
  },
}));

vi.mock("../telemetry/posthogService.js", () => ({
  posthogService: {
    capture: vi.fn(),
  },
}));

vi.mock("../util/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../services/index.js", () => ({
  services: {
    systemMessage: {
      getSystemMessage: vi.fn(() => Promise.resolve("System message")),
    },
    toolPermissions: {
      getState: vi.fn(() => ({ currentMode: "enabled" })),
      isHeadless: vi.fn(() => false),
    },
    chatHistory: {
      isReady: vi.fn(() => true),
      getHistory: vi.fn(() => []),
      setHistory: vi.fn(),
      addUserMessage: vi.fn(),
    },
  },
}));

vi.mock("./handleToolCalls.js", () => ({
  handleToolCalls: vi.fn(() => Promise.resolve(false)),
  getRequestTools: vi.fn(() => Promise.resolve([])),
}));

vi.mock("./streamChatResponse.compactionHelpers.js", () => ({
  handlePreApiCompaction: vi.fn((chatHistory) =>
    Promise.resolve({ chatHistory, wasCompacted: false }),
  ),
  handlePostToolValidation: vi.fn((_, chatHistory) =>
    Promise.resolve({ chatHistory, wasCompacted: false }),
  ),
  handleNormalAutoCompaction: vi.fn((chatHistory) =>
    Promise.resolve({ chatHistory, wasCompacted: false }),
  ),
}));

describe("streamChatResponse - auto-continuation after compaction", () => {
  const mockModel: ModelConfig = {
    provider: "openai",
    name: "gpt-4",
    model: "gpt-4",
    defaultCompletionOptions: {
      contextLength: 8192,
      maxTokens: 2048,
    },
  } as any;

  let mockLlmApi: BaseLlmApi;
  let mockAbortController: AbortController;
  let chatHistory: ChatHistoryItem[];
  let chunks: ChatCompletionChunk[];
  let responseCount: number;

  function contentChunk(content: string): ChatCompletionChunk {
    return {
      id: "test",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          delta: { content },
          finish_reason: null,
        },
      ],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    responseCount = 0;
    chunks = [contentChunk("Initial response")];
    chatHistory = convertToUnifiedHistory([{ role: "user", content: "Hello" }]);

    mockLlmApi = {
      chatCompletionStream: vi.fn().mockImplementation(async function* () {
        responseCount++;
        for (const chunk of chunks) {
          yield chunk;
        }
      }),
    } as unknown as BaseLlmApi;

    mockAbortController = {
      signal: { aborted: false },
      abort: vi.fn(),
    } as unknown as AbortController;
  });

  it("should automatically continue after compaction when no tool calls remain", async () => {
    const { services } = await import("../services/index.js");
    const { handleNormalAutoCompaction } = await import(
      "./streamChatResponse.compactionHelpers.js"
    );
    const { logger } = await import("../util/logger.js");

    // Track history modifications
    const historyUpdates: string[] = [];
    vi.mocked(services.chatHistory.addUserMessage).mockImplementation((msg) => {
      historyUpdates.push(msg);
      return {
        message: { role: "user", content: msg },
        contextItems: [],
      };
    });

    // First call: compaction happens
    // Second call (after continuation): no compaction
    let compactionCallCount = 0;
    vi.mocked(handleNormalAutoCompaction).mockImplementation(() => {
      compactionCallCount++;
      return Promise.resolve({
        chatHistory,
        wasCompacted: compactionCallCount === 1, // Only first call has compaction
      });
    });

    // Simulate: first response completes (no tool calls), triggering auto-continue
    let callCount = 0;
    mockLlmApi.chatCompletionStream = vi
      .fn()
      .mockImplementation(async function* () {
        callCount++;
        if (callCount === 1) {
          // First call: just content, no tool calls (shouldContinue = false)
          yield contentChunk("First response");
        } else if (callCount === 2) {
          // Second call: after auto-continuation
          yield contentChunk("Continued after compaction");
        }
      }) as any;

    await streamChatResponse(
      chatHistory,
      mockModel,
      mockLlmApi,
      mockAbortController,
    );

    // Verify "continue" message was added
    expect(historyUpdates).toContain("continue");

    // Verify logging occurred
    expect(logger.debug).toHaveBeenCalledWith(
      "Auto-compaction occurred during this turn - automatically continuing session",
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "Added continuation message after compaction",
    );

    // Verify the LLM was called multiple times (continuing the conversation)
    expect(callCount).toBeGreaterThan(1);
  });

  it("should not auto-continue if compaction occurs with tool calls pending", async () => {
    const { services } = await import("../services/index.js");
    const { handleNormalAutoCompaction } = await import(
      "./streamChatResponse.compactionHelpers.js"
    );
    const { handleToolCalls } = await import("./handleToolCalls.js");

    const historyUpdates: string[] = [];
    vi.mocked(services.chatHistory.addUserMessage).mockImplementation((msg) => {
      historyUpdates.push(msg);
      return {
        message: { role: "user", content: msg },
        contextItems: [],
      };
    });

    // Compaction happens
    vi.mocked(handleNormalAutoCompaction).mockResolvedValue({
      chatHistory,
      wasCompacted: true,
    });

    // But tool calls are still being processed (shouldContinue = true)
    // This is simulated by having handleToolCalls return true (shouldReturn)
    vi.mocked(handleToolCalls).mockResolvedValue(true);

    // Mock tool calls in response
    mockLlmApi.chatCompletionStream = vi
      .fn()
      .mockImplementation(async function* () {
        yield {
          id: "test",
          object: "chat.completion.chunk",
          created: Date.now(),
          model: "test-model",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_123",
                    type: "function",
                    function: {
                      name: "ReadFile",
                      arguments: '{"filepath": "/test"}',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
      }) as any;

    await streamChatResponse(
      chatHistory,
      mockModel,
      mockLlmApi,
      mockAbortController,
    );

    // Should NOT auto-continue because tool calls are pending
    expect(historyUpdates).not.toContain("continue");
  });

  it("should not create infinite loops - flag is reset after continuation", async () => {
    const { services } = await import("../services/index.js");
    const { handleNormalAutoCompaction } = await import(
      "./streamChatResponse.compactionHelpers.js"
    );

    const historyUpdates: string[] = [];
    vi.mocked(services.chatHistory.addUserMessage).mockImplementation((msg) => {
      historyUpdates.push(msg);
      return {
        message: { role: "user", content: msg },
        contextItems: [],
      };
    });

    // Track calls - compaction happens on 1st turn, then again on 2nd turn
    let normalCompactionCallCount = 0;
    vi.mocked(handleNormalAutoCompaction).mockImplementation(() => {
      normalCompactionCallCount++;
      // Compaction happens on first two calls
      return Promise.resolve({
        chatHistory,
        wasCompacted: normalCompactionCallCount <= 1,
      });
    });

    let streamCallCount = 0;
    mockLlmApi.chatCompletionStream = vi
      .fn()
      .mockImplementation(async function* () {
        streamCallCount++;
        yield contentChunk(`Response ${streamCallCount}`);
      }) as any;

    await streamChatResponse(
      chatHistory,
      mockModel,
      mockLlmApi,
      mockAbortController,
    );

    // Should only add "continue" once
    // The flag is reset after the first continuation
    const continueCount = historyUpdates.filter(
      (msg) => msg === "continue",
    ).length;
    expect(continueCount).toBeLessThanOrEqual(1);

    // Should have called the LLM at least once
    expect(streamCallCount).toBeGreaterThanOrEqual(1);
  });
});
