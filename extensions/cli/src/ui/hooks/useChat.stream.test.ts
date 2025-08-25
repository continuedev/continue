import { describe, expect, it, vi } from "vitest";

import type { ChatHistoryItem } from "../../../../../core/index.js";

import { createStreamCallbacks } from "./useChat.stream.helpers.js";

describe("useChat streaming", () => {
  it("should progressively update assistant message content during streaming", () => {
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
    
    // Simulate streaming content
    callbacks.onContent("Hello");
    expect(setChatHistory).toHaveBeenCalledTimes(1);
    expect(chatHistory).toHaveLength(1);
    expect(chatHistory[0].message.content).toBe("Hello");
    
    callbacks.onContent(" world");
    expect(setChatHistory).toHaveBeenCalledTimes(2);
    expect(chatHistory).toHaveLength(1);
    expect(chatHistory[0].message.content).toBe("Hello world");
    
    callbacks.onContent("!");
    expect(setChatHistory).toHaveBeenCalledTimes(3);
    expect(chatHistory).toHaveLength(1);
    expect(chatHistory[0].message.content).toBe("Hello world!");
    
    // Complete the streaming
    callbacks.onContentComplete("Hello world!");
    expect(setChatHistory).toHaveBeenCalledTimes(4);
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
    expect(chatHistory).toHaveLength(1);
    expect(chatHistory[0].message.content).toBe("Let me help you with that.");
    
    // Complete content before tool call
    callbacks.onContentComplete("Let me help you with that.");
    
    // Now a tool call
    callbacks.onToolStart("Read", { file_path: "/test.txt" });
    expect(chatHistory).toHaveLength(1);
    expect(chatHistory[0].toolCallStates).toHaveLength(1);
    expect(chatHistory[0].toolCallStates![0].status).toBe("calling");
    
    // Tool result
    callbacks.onToolResult("File contents", "Read");
    expect(chatHistory[0].toolCallStates![0].status).toBe("done");
    
    // More content after tool creates a new message 
    // (because the previous message has tool calls)
    callbacks.onContent("Based on the file");
    expect(chatHistory).toHaveLength(2);
    expect(chatHistory[1].message.role).toBe("assistant");
    expect(chatHistory[1].message.content).toBe("Based on the file");
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
    expect(chatHistory).toHaveLength(2);
    expect(chatHistory[1].message.role).toBe("assistant");
    expect(chatHistory[1].message.content).toBe("Hi there");
  });
});