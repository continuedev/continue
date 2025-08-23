import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { handleAutoCompaction } from "./streamChatResponse.autoCompaction.js";

// Mock dependencies
vi.mock("./compaction.js", () => ({
  compactChatHistory: vi.fn(),
}));

vi.mock("./session.js", () => ({
  saveSession: vi.fn(),
}));

vi.mock("./util/tokenizer.js", () => ({
  shouldAutoCompact: vi.fn(),
  getAutoCompactMessage: vi.fn(),
}));

vi.mock("./util/formatError.js", () => ({
  formatError: vi.fn((error) => error.message || String(error)),
}));

vi.mock("./util/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

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
  const mockChatHistory: ChatCompletionMessageParam[] = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return original history when auto-compaction is not needed", async () => {
    const { shouldAutoCompact } = await import("./util/tokenizer.js");
    vi.mocked(shouldAutoCompact).mockReturnValue(false);

    const result = await handleAutoCompaction(
      mockChatHistory,
      mockModel,
      mockLlmApi,
      {},
    );

    expect(result).toEqual({
      chatHistory: mockChatHistory,
      compactionIndex: null,
    });

    expect(shouldAutoCompact).toHaveBeenCalledWith(mockChatHistory, mockModel);
  });

  it("should perform auto-compaction when context limit is approaching", async () => {
    const { shouldAutoCompact, getAutoCompactMessage } = await import("./util/tokenizer.js");
    const { compactChatHistory } = await import("./compaction.js");
    const { saveSession } = await import("./session.js");

    vi.mocked(shouldAutoCompact).mockReturnValue(true);
    vi.mocked(getAutoCompactMessage).mockReturnValue("Auto-compacting...");
    
    const mockCompactionResult = {
      compactedHistory: [
        { role: "system", content: "You are a helpful assistant." } as ChatCompletionMessageParam,
        { role: "assistant", content: "[COMPACTED HISTORY]\nConversation summary..." } as ChatCompletionMessageParam,
      ],
      compactionIndex: 1,
      compactionContent: "Conversation summary...",
    };

    vi.mocked(compactChatHistory).mockResolvedValue(mockCompactionResult);

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

    expect(shouldAutoCompact).toHaveBeenCalledWith(mockChatHistory, mockModel);
    expect(getAutoCompactMessage).toHaveBeenCalledWith(mockModel);
    expect(compactChatHistory).toHaveBeenCalledWith(
      mockChatHistory,
      mockModel,
      mockLlmApi,
      expect.any(Object),
    );
    expect(saveSession).toHaveBeenCalledWith(mockCompactionResult.compactedHistory);
    
    expect(mockCallbacks.onSystemMessage).toHaveBeenCalledWith("Auto-compacting...");
    expect(mockCallbacks.onSystemMessage).toHaveBeenCalledWith("✓ Chat history auto-compacted successfully.");

    expect(result).toEqual({
      chatHistory: mockCompactionResult.compactedHistory,
      compactionIndex: mockCompactionResult.compactionIndex,
    });
  });

  it("should handle compaction errors gracefully", async () => {
    const { shouldAutoCompact, getAutoCompactMessage } = await import("./util/tokenizer.js");
    const { compactChatHistory } = await import("./compaction.js");
    const { logger } = await import("./util/logger.js");

    vi.mocked(shouldAutoCompact).mockReturnValue(true);
    vi.mocked(getAutoCompactMessage).mockReturnValue("Auto-compacting...");
    vi.mocked(compactChatHistory).mockRejectedValue(new Error("Compaction failed"));

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
    expect(result).toEqual({
      chatHistory: mockChatHistory,
      compactionIndex: null,
    });
  });

  it("should not call system message callback in headless mode", async () => {
    const { shouldAutoCompact, getAutoCompactMessage } = await import("./util/tokenizer.js");
    const { compactChatHistory } = await import("./compaction.js");

    vi.mocked(shouldAutoCompact).mockReturnValue(true);
    vi.mocked(getAutoCompactMessage).mockReturnValue("Auto-compacting...");
    
    const mockCompactionResult = {
      compactedHistory: [{ role: "system", content: "System" } as ChatCompletionMessageParam],
      compactionIndex: 0,
      compactionContent: "Summary",
    };

    vi.mocked(compactChatHistory).mockResolvedValue(mockCompactionResult);

    const mockCallbacks = {
      onSystemMessage: vi.fn(),
    };

    await handleAutoCompaction(
      mockChatHistory,
      mockModel,
      mockLlmApi,
      {
        isHeadless: true,
        callbacks: mockCallbacks,
      },
    );

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
    });
  });
});