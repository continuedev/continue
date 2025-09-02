import type { ChatHistoryItem } from "core/index.js";
import { describe, expect, it, vi } from "vitest";

import { createStreamCallbacks } from "./useChat.stream.helpers.js";

describe("useChat streaming", () => {
  it("should handle content completion", () => {
    let chatHistory: ChatHistoryItem[] = [];

    const setChatHistory = vi.fn((updater: any) => {
      if (typeof updater === "function") {
        chatHistory = updater(chatHistory);
      } else {
        chatHistory = updater;
      }
    });

    const callbacks = createStreamCallbacks({
      setChatHistory,
      setActivePermissionRequest: vi.fn(),
    });

    // onContent is now empty and doesn't update history
    callbacks.onContent("Hello");
    expect(setChatHistory).toHaveBeenCalledTimes(0);
    expect(chatHistory).toHaveLength(0);

    callbacks.onContent(" world");
    expect(setChatHistory).toHaveBeenCalledTimes(0);
    expect(chatHistory).toHaveLength(0);

    callbacks.onContent("!");
    expect(setChatHistory).toHaveBeenCalledTimes(0);
    expect(chatHistory).toHaveLength(0);

    // Complete the streaming - this adds the message
    callbacks.onContentComplete("Hello world!");
    expect(setChatHistory).toHaveBeenCalledTimes(1);
    expect(chatHistory).toHaveLength(1);
    expect(chatHistory[0].message.content).toBe("Hello world!");
  });

  it("should handle tool calls during streaming", () => {
    let chatHistory: ChatHistoryItem[] = [];

    const setChatHistory = vi.fn((updater: any) => {
      if (typeof updater === "function") {
        chatHistory = updater(chatHistory);
      } else {
        chatHistory = updater;
      }
    });

    const callbacks = createStreamCallbacks({
      setChatHistory,
      setActivePermissionRequest: vi.fn(),
    });

    // Start with some content
    callbacks.onContent("Let me help you with that.");
    expect(chatHistory).toHaveLength(0); // onContent is empty, doesn't add messages

    // Complete content before tool call
    callbacks.onContentComplete("Let me help you with that.");
    expect(chatHistory).toHaveLength(1);
    expect(chatHistory[0].message.content).toBe("Let me help you with that.");

    // Now a tool call - creates a new message
    callbacks.onToolStart("Read", { file_path: "/test.txt" });
    expect(chatHistory).toHaveLength(2); // New message for tool call
    expect(chatHistory[1].toolCallStates).toHaveLength(1);
    expect(chatHistory[1].toolCallStates![0].status).toBe("calling");

    // Tool result
    callbacks.onToolResult("File contents", "Read", "done");
    expect(chatHistory[1].toolCallStates![0].status).toBe("done");

    // More content after tool creates a new message
    callbacks.onContent("Based on the file");
    expect(chatHistory).toHaveLength(2); // onContent is empty, doesn't add

    callbacks.onContentComplete("Based on the file");
    expect(chatHistory).toHaveLength(3); // New message from onContentComplete
    expect(chatHistory[2].message.role).toBe("assistant");
    expect(chatHistory[2].message.content).toBe("Based on the file");
  });

  it("should create new message if last message is not assistant", () => {
    let chatHistory: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "Hello" },
        contextItems: [],
      },
    ];

    const setChatHistory = vi.fn((updater: any) => {
      if (typeof updater === "function") {
        chatHistory = updater(chatHistory);
      } else {
        chatHistory = updater;
      }
    });

    const callbacks = createStreamCallbacks({
      setChatHistory,
      setActivePermissionRequest: vi.fn(),
    });

    callbacks.onContent("Hi there");
    expect(chatHistory).toHaveLength(1); // onContent is empty, doesn't add

    callbacks.onContentComplete("Hi there");
    expect(chatHistory).toHaveLength(2);
    expect(chatHistory[1].message.role).toBe("assistant");
    expect(chatHistory[1].message.content).toBe("Hi there");
  });

  it("should create separate messages for each tool call", () => {
    let chatHistory: ChatHistoryItem[] = [];

    const setChatHistory = vi.fn((updater: any) => {
      if (typeof updater === "function") {
        chatHistory = updater(chatHistory);
      } else {
        chatHistory = updater;
      }
    });

    const callbacks = createStreamCallbacks({
      setChatHistory,
      setActivePermissionRequest: vi.fn(),
    });

    // Add initial content
    callbacks.onContentComplete("Let me check multiple things");
    expect(chatHistory).toHaveLength(1);

    // First tool call - creates new message
    callbacks.onToolStart("Read", { file_path: "/first.txt" });
    expect(chatHistory).toHaveLength(2);
    expect(chatHistory[1].toolCallStates).toHaveLength(1);
    expect(chatHistory[1].toolCallStates![0].toolCall.function.name).toBe(
      "Read",
    );

    // First tool result
    callbacks.onToolResult("First file contents", "Read", "done");
    expect(chatHistory[1].toolCallStates![0].status).toBe("done");

    // Second tool call - creates another new message
    callbacks.onToolStart("Write", {
      file_path: "/second.txt",
      content: "test",
    });
    expect(chatHistory).toHaveLength(3);
    expect(chatHistory[2].toolCallStates).toHaveLength(1);
    expect(chatHistory[2].toolCallStates![0].toolCall.function.name).toBe(
      "Write",
    );

    // Second tool result
    callbacks.onToolResult("Write successful", "Write", "done");
    expect(chatHistory[2].toolCallStates![0].status).toBe("done");

    // Third tool call - creates yet another new message
    callbacks.onToolStart("Read", { file_path: "/third.txt" });
    expect(chatHistory).toHaveLength(4);
    expect(chatHistory[3].toolCallStates).toHaveLength(1);
    expect(chatHistory[3].toolCallStates![0].toolCall.function.name).toBe(
      "Read",
    );

    // Final content after all tools
    callbacks.onContentComplete("All operations completed");
    expect(chatHistory).toHaveLength(5);
    expect(chatHistory[4].message.content).toBe("All operations completed");
  });
});
