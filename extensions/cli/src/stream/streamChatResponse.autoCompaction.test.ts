import type { ChatHistoryItem } from "core/index.js";
import { convertToUnifiedHistory } from "core/util/messageConversion.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleAutoCompaction } from "./streamChatResponse.autoCompaction.js";

// Mock dependencies
vi.mock("../compaction.js", () => ({
  compactChatHistory: vi.fn(),
  shouldAutoCompact: vi.fn(),
  getAutoCompactMessage: vi.fn(),
}));

vi.mock("../session.js", () => ({
  createSession: vi.fn((history) => ({
    sessionId: "test",
    title: "Test",
    workspaceDirectory: "/test",
    history,
  })),
  saveSession: vi.fn(),
  updateSessionHistory: vi.fn(),
  trackSessionUsage: vi.fn(),
}));

vi.mock("../util/tokenizer.js", () => ({
  countChatHistoryItemTokens: vi.fn(() => 100), // Mock return value
}));

vi.mock("../util/formatError.js", () => ({
  formatError: vi.fn((error) => error.message || String(error)),
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
    },
  },
}));

vi.mock("os", async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return {
    ...actual,
    homedir: vi.fn(() => "/home/test"),
  };
});

describe("handleAutoCompaction", () => {
  const mockModel = {
    provider: "openai",
    name: "gpt-4",
    model: "gpt-4",
    defaultCompletionOptions: {
      contextLength: 8192,
      maxTokens: 2048,
    },
  } as any;

  const mockLlmApi = {} as any;
  const mockChatHistory: ChatHistoryItem[] = convertToUnifiedHistory([
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return original history when auto-compaction is not needed", async () => {
    const { shouldAutoCompact } = await import("../compaction.js");
    const mockedShouldAutoCompact = shouldAutoCompact as any;
    mockedShouldAutoCompact.mockReturnValue(false);

    const result = await handleAutoCompaction(
      mockChatHistory,
      mockModel,
      mockLlmApi,
      {},
    );

    expect(result).toEqual({
      chatHistory: mockChatHistory,
      compactionIndex: null,
      wasCompacted: false,
    });

    expect(shouldAutoCompact).toHaveBeenCalledWith({
      chatHistory: mockChatHistory,
      model: mockModel,
      systemMessage: undefined,
      tools: undefined,
    });
  });

  it("should perform auto-compaction when context limit is approaching", async () => {
    const { compactChatHistory, shouldAutoCompact, getAutoCompactMessage } =
      await import("../compaction.js");
    const { updateSessionHistory } = await import("../session.js");

    vi.mocked(shouldAutoCompact).mockReturnValue(true);
    vi.mocked(getAutoCompactMessage).mockReturnValue("Auto-compacting...");

    const mockCompactionResult = {
      compactedHistory: convertToUnifiedHistory([
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "assistant",
          content: "[COMPACTED HISTORY]\nConversation summary...",
        },
      ]),
      compactionIndex: 1,
      compactionContent: "Conversation summary...",
    };

    const mockedCompactChatHistory = compactChatHistory as any;
    mockedCompactChatHistory.mockResolvedValue(mockCompactionResult);

    const mockCallbacks = {
      onSystemMessage: vi.fn(),
    };

    const result = await handleAutoCompaction(
      mockChatHistory,
      mockModel,
      mockLlmApi,
      {
        isHeadless: false,
        callbacks: mockCallbacks,
      },
    );

    expect(shouldAutoCompact).toHaveBeenCalledWith({
      chatHistory: mockChatHistory,
      model: mockModel,
      systemMessage: undefined,
      tools: undefined,
    });
    expect(getAutoCompactMessage).toHaveBeenCalledWith(mockModel);
    expect(compactChatHistory).toHaveBeenCalledWith(
      mockChatHistory,
      mockModel,
      mockLlmApi,
      expect.objectContaining({
        callbacks: expect.any(Object),
        systemMessageTokens: expect.any(Number),
      }),
    );
    expect(updateSessionHistory).toHaveBeenCalledWith(
      mockCompactionResult.compactedHistory,
    );

    expect(mockCallbacks.onSystemMessage).toHaveBeenCalledWith(
      "Auto-compacting...",
    );
    expect(mockCallbacks.onSystemMessage).toHaveBeenCalledWith(
      "Chat history auto-compacted successfully.",
    );

    expect(result).toEqual({
      chatHistory: mockCompactionResult.compactedHistory,
      compactionIndex: mockCompactionResult.compactionIndex,
      wasCompacted: true,
    });
  });

  it("should handle compaction errors gracefully", async () => {
    const { compactChatHistory, shouldAutoCompact, getAutoCompactMessage } =
      await import("../compaction.js");
    const { logger } = await import("../util/logger.js");

    vi.mocked(shouldAutoCompact).mockReturnValue(true);
    vi.mocked(getAutoCompactMessage).mockReturnValue("Auto-compacting...");
    vi.mocked(compactChatHistory).mockRejectedValue(
      new Error("Compaction failed"),
    );

    const mockCallbacks = {
      onSystemMessage: vi.fn(),
    };

    const result = await handleAutoCompaction(
      mockChatHistory,
      mockModel,
      mockLlmApi,
      {
        isHeadless: false,
        callbacks: mockCallbacks,
      },
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Auto-compaction error"),
    );
    expect(mockCallbacks.onSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining("Warning: Auto-compaction error"),
    );

    // Should return original history on error
    expect(result.wasCompacted).toBe(false);
    expect(result).toEqual({
      chatHistory: mockChatHistory,
      compactionIndex: null,
      wasCompacted: false,
    });
  });

  it("should not call system message callback in headless mode", async () => {
    const { compactChatHistory, shouldAutoCompact, getAutoCompactMessage } =
      await import("../compaction.js");

    vi.mocked(shouldAutoCompact).mockReturnValue(true);
    vi.mocked(getAutoCompactMessage).mockReturnValue("Auto-compacting...");

    const mockCompactionResult = {
      compactedHistory: convertToUnifiedHistory([
        { role: "system", content: "System" },
      ]),
      compactionIndex: 0,
      compactionContent: "Summary",
    };

    const mockedCompactChatHistory = compactChatHistory as any;
    mockedCompactChatHistory.mockResolvedValue(mockCompactionResult);

    const mockCallbacks = {
      onSystemMessage: vi.fn(),
    };

    await handleAutoCompaction(mockChatHistory, mockModel, mockLlmApi, {
      isHeadless: true,
      callbacks: mockCallbacks,
    });

    expect(mockCallbacks.onSystemMessage).not.toHaveBeenCalled();
  });

  it("should handle missing model gracefully", async () => {
    const result = await handleAutoCompaction(
      mockChatHistory,
      null as any,
      mockLlmApi,
      {},
    );

    expect(result).toEqual({
      chatHistory: mockChatHistory,
      compactionIndex: null,
      wasCompacted: false,
    });
  });
});
