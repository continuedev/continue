import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { processSlashCommandResult } from "./useChat.helpers.js";

describe("useChat clear command", () => {
  let mockSetChatHistory: ReturnType<typeof vi.fn>;
  let mockSetMessages: ReturnType<typeof vi.fn>;
  let mockExit: ReturnType<typeof vi.fn>;
  let mockOnClear: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetChatHistory = vi.fn();
    mockSetMessages = vi.fn();
    mockExit = vi.fn();
    mockOnClear = vi.fn();
  });

  it("should call onClear callback when processing clear command", () => {
    const chatHistory: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];

    const result = {
      clear: true,
      output: "Chat history cleared",
    };

    processSlashCommandResult({
      result,
      chatHistory,
      setChatHistory: mockSetChatHistory,
      setMessages: mockSetMessages,
      exit: mockExit,
      onShowConfigSelector: vi.fn(),
      onClear: mockOnClear,
    });

    // Verify that onClear was called
    expect(mockOnClear).toHaveBeenCalledOnce();

    // Verify that chat history was reset (keeping only system message)
    expect(mockSetChatHistory).toHaveBeenCalledWith([
      { role: "system", content: "You are a helpful assistant" },
    ]);

    // Verify that messages were cleared
    expect(mockSetMessages).toHaveBeenCalledWith([]);
  });

  it("should not call onClear if callback is not provided", () => {
    const chatHistory: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
    ];

    const result = {
      clear: true,
    };

    // Should not throw when onClear is undefined
    expect(() => {
      processSlashCommandResult({
        result,
        chatHistory,
        setChatHistory: mockSetChatHistory,
        setMessages: mockSetMessages,
        exit: mockExit,
        onShowConfigSelector: vi.fn(),
        // onClear is not provided
      });
    }).not.toThrow();

    // Verify that history and messages are still reset
    expect(mockSetChatHistory).toHaveBeenCalledWith([
      { role: "system", content: "You are a helpful assistant" },
    ]);
    expect(mockSetMessages).toHaveBeenCalledWith([]);
  });

  it("should preserve system message when clearing", () => {
    const systemMessage: ChatCompletionMessageParam = {
      role: "system",
      content: "Custom system message",
    };
    const chatHistory: ChatCompletionMessageParam[] = [
      systemMessage,
      { role: "user", content: "Test message" },
      { role: "assistant", content: "Test response" },
    ];

    const result = { clear: true };

    processSlashCommandResult({
      result,
      chatHistory,
      setChatHistory: mockSetChatHistory,
      setMessages: mockSetMessages,
      exit: mockExit,
      onShowConfigSelector: vi.fn(),
      onClear: mockOnClear,
    });

    // Should keep only the system message
    expect(mockSetChatHistory).toHaveBeenCalledWith([systemMessage]);
    expect(mockOnClear).toHaveBeenCalledOnce();
  });

  it("should handle clear with empty chat history", () => {
    const chatHistory: ChatCompletionMessageParam[] = [];
    const result = { clear: true };

    processSlashCommandResult({
      result,
      chatHistory,
      setChatHistory: mockSetChatHistory,
      setMessages: mockSetMessages,
      exit: mockExit,
      onShowConfigSelector: vi.fn(),
      onClear: mockOnClear,
    });

    // Should set empty history when no system message exists
    expect(mockSetChatHistory).toHaveBeenCalledWith([]);
    expect(mockSetMessages).toHaveBeenCalledWith([]);
    expect(mockOnClear).toHaveBeenCalledOnce();
  });
});
