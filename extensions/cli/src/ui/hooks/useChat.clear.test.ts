import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { convertToUnifiedHistory } from "../../messageConversion.js";

import { processSlashCommandResult } from "./useChat.helpers.js";

describe("useChat clear command", () => {
  let mockSetChatHistory: ReturnType<typeof vi.fn>;
  let mockExit: ReturnType<typeof vi.fn>;
  let mockOnClear: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetChatHistory = vi.fn();
    mockExit = vi.fn();
    mockOnClear = vi.fn();
  });

  it("should call onClear callback when processing clear command", () => {
    const legacyHistory: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];
    const chatHistory = convertToUnifiedHistory(legacyHistory);

    const result = {
      clear: true,
      output: "Chat history cleared",
    };

    processSlashCommandResult({
      result,
      chatHistory,
      setChatHistory: mockSetChatHistory,
      exit: mockExit,
      onShowConfigSelector: vi.fn(),
      onClear: mockOnClear,
    });

    // Verify that onClear was called
    expect(mockOnClear).toHaveBeenCalledOnce();

    // Verify that chat history was reset (keeping only system message)
    expect(mockSetChatHistory).toHaveBeenCalledWith([
      chatHistory[0], // The system message ChatHistoryItem
    ]);

    // Second call should be with the "Chat history cleared" message
    expect(mockSetChatHistory).toHaveBeenLastCalledWith([
      {
        message: {
          role: "system",
          content: "Chat history cleared",
        },
        contextItems: [],
      },
    ]);
  });

  it("should not call onClear if callback is not provided", () => {
    const legacyHistory: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
    ];
    const chatHistory = convertToUnifiedHistory(legacyHistory);

    const result = {
      clear: true,
    };

    // Should not throw when onClear is undefined
    expect(() => {
      processSlashCommandResult({
        result,
        chatHistory,
        setChatHistory: mockSetChatHistory,
        exit: mockExit,
        onShowConfigSelector: vi.fn(),
        // onClear is not provided
      });
    }).not.toThrow();

    // Verify that history is still reset
    expect(mockSetChatHistory).toHaveBeenCalledWith([
      chatHistory[0], // The system message ChatHistoryItem
    ]);
  });

  it("should preserve system message when clearing", () => {
    const systemMessage: ChatCompletionMessageParam = {
      role: "system",
      content: "Custom system message",
    };
    const legacyHistory: ChatCompletionMessageParam[] = [
      systemMessage,
      { role: "user", content: "Test message" },
      { role: "assistant", content: "Test response" },
    ];
    const chatHistory = convertToUnifiedHistory(legacyHistory);
    const systemHistoryItem = chatHistory[0];

    const result = { clear: true };

    processSlashCommandResult({
      result,
      chatHistory,
      setChatHistory: mockSetChatHistory,
      exit: mockExit,
      onShowConfigSelector: vi.fn(),
      onClear: mockOnClear,
    });

    // Should keep only the system message
    expect(mockSetChatHistory).toHaveBeenCalledWith([systemHistoryItem]);
    expect(mockOnClear).toHaveBeenCalledOnce();
  });

  it("should handle clear with empty chat history", () => {
    const legacyHistory: ChatCompletionMessageParam[] = [];
    const chatHistory = convertToUnifiedHistory(legacyHistory);
    const result = { clear: true };

    processSlashCommandResult({
      result,
      chatHistory,
      setChatHistory: mockSetChatHistory,
      exit: mockExit,
      onShowConfigSelector: vi.fn(),
      onClear: mockOnClear,
    });

    // Should set empty history when no system message exists
    expect(mockSetChatHistory).toHaveBeenCalledWith([]);
    expect(mockOnClear).toHaveBeenCalledOnce();
  });
});
