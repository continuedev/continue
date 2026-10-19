import { describe, expect, it } from "vitest";
import { ChatMessage } from "../index.js";
import { compileChatMessages } from "./countTokens.js";

describe("compileChatMessages", () => {
  it("should preserve the latest user message when pruning during a tool sequence loop", () => {
    const toolCall = {
      id: "call_123",
      type: "function" as const,
      function: {
        name: "test_tool",
        arguments: "{}",
      },
    };

    const messages: ChatMessage[] = [
      { role: "system", content: "You are a helpful assistant." },
      {
        role: "user",
        content: "Initial user prompt that started the session.",
      },
      {
        role: "assistant",
        content: "Calling tool...",
        toolCalls: [toolCall],
      },
      {
        role: "tool",
        content: "x".repeat(3000), // Large tool output causing context pressure
        toolCallId: "call_123",
      },
    ];

    const result = compileChatMessages({
      modelName: "gpt-4",
      msgs: messages,
      knownContextLength: 4000,
      maxTokens: 500,
      supportsImages: false,
    });

    const userMessage = result.compiledChatMessages.find(
      (m) => m.role === "user",
    );
    expect(userMessage).toBeDefined();
    expect(userMessage?.content).toBe(
      "Initial user prompt that started the session.",
    );

    // Ensure system message is preserved
    const systemMessage = result.compiledChatMessages.find(
      (m) => m.role === "system",
    );
    expect(systemMessage).toBeDefined();

    // Ensure tool sequence is preserved
    const toolMessage = result.compiledChatMessages.find(
      (m) => m.role === "tool",
    );
    expect(toolMessage).toBeDefined();
  });

  it("should preserve latest user message and prune older intermediate turns", () => {
    const toolCall1 = {
      id: "call_1",
      type: "function" as const,
      function: { name: "search", arguments: "{}" },
    };
    const toolCall2 = {
      id: "call_2",
      type: "function" as const,
      function: { name: "search", arguments: "{}" },
    };

    const messages: ChatMessage[] = [
      { role: "system", content: "You are a helpful assistant." },
      {
        role: "user",
        content:
          "Turn 1 user request that is very old and long: " + "a".repeat(4000),
      },
      { role: "assistant", content: "Turn 1 response." },
      { role: "user", content: "Turn 2 user request: do task B." },
      {
        role: "assistant",
        content: "Calling search...",
        toolCalls: [toolCall2],
      },
      {
        role: "tool",
        content: "Search results for task B: " + "b".repeat(500),
        toolCallId: "call_2",
      },
    ];

    const result = compileChatMessages({
      modelName: "gpt-4",
      msgs: messages,
      knownContextLength: 800,
      maxTokens: 100,
      supportsImages: false,
    });

    // Old Turn 1 should be pruned under tight budget
    const hasTurn1 = result.compiledChatMessages.some(
      (m) =>
        typeof m.content === "string" &&
        m.content.includes("Turn 1 user request"),
    );
    expect(hasTurn1).toBe(false);

    // Latest user message (Turn 2) MUST be preserved
    const turn2User = result.compiledChatMessages.find(
      (m) =>
        typeof m.content === "string" &&
        m.content.includes("Turn 2 user request"),
    );
    expect(turn2User).toBeDefined();
    expect(result.didPrune).toBe(true);
  });
});
