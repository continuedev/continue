import { beforeEach, describe, expect, it } from "vitest";
import { ChatMessage, ThinkingChatMessage } from "../../index.js";
import DeepSeek from "./DeepSeek.js";

describe("DeepSeek", () => {
  let deepSeek: DeepSeek;

  beforeEach(() => {
    deepSeek = new DeepSeek({
      model: "deepseek-reasoner",
      apiKey: "test-key",
    });
  });

  describe("transformMessagesForDeepSeek", () => {
    // Helper method to access private method for testing
    const transformMessages = (messages: ChatMessage[]): ChatMessage[] => {
      // Use type assertion to access private method
      return (deepSeek as any).transformMessagesForDeepSeek(messages);
    };

    it("should return empty array for empty input", () => {
      expect(transformMessages([])).toEqual([]);
    });

    it("should remove thinking messages before last user/assistant/system", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: "T1" } as ThinkingChatMessage,
        { role: "thinking", content: "T2" } as ThinkingChatMessage,
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ]);
    });

    it("should convert thinking after last user/assistant/system to thinking + assistant", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Question" },
        {
          role: "thinking",
          content: "Thinking about answer",
        } as ThinkingChatMessage,
        { role: "assistant", content: "Answer" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" },
      ]);
    });

    it("should handle tool call loops with thinking after last user/assistant", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: "Before loop" } as ThinkingChatMessage,
        { role: "user", content: "Get weather" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "1",
              type: "function",
              function: { name: "get_weather", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "Sunny", toolCallId: "1" },
        { role: "thinking", content: "Now respond" } as ThinkingChatMessage,
        { role: "assistant", content: "It's sunny" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "user", content: "Get weather" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "1",
              type: "function",
              function: { name: "get_weather", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "Sunny", toolCallId: "1" },
        { role: "assistant", content: "It's sunny" },
      ]);
    });

    it("should keep tool and system messages", () => {
      const messages: ChatMessage[] = [
        { role: "system", content: "You are helpful" },
        { role: "thinking", content: "Processing" } as ThinkingChatMessage,
        { role: "tool", content: "Tool result", toolCallId: "123" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "system", content: "You are helpful" },
        { role: "tool", content: "Tool result", toolCallId: "123" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ]);
    });

    it("should handle complex tool call loop with thinking after last user", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: "Initial" } as ThinkingChatMessage,
        { role: "user", content: "Task" },
        { role: "thinking", content: "Need tool A" } as ThinkingChatMessage,
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "1",
              type: "function",
              function: { name: "tool_a", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "Result A", toolCallId: "1" },
        { role: "thinking", content: "Now tool B" } as ThinkingChatMessage,
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "2",
              type: "function",
              function: { name: "tool_b", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "Result B", toolCallId: "2" },
        { role: "thinking", content: "Final" } as ThinkingChatMessage,
        { role: "assistant", content: "Answer" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "user", content: "Task" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "1",
              type: "function",
              function: { name: "tool_a", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "Result A", toolCallId: "1" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "2",
              type: "function",
              function: { name: "tool_b", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "Result B", toolCallId: "2" },
        { role: "assistant", content: "Answer" },
      ]);
    });

    it("should return empty array if no user, assistant or system messages found", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: "Just thinking" } as ThinkingChatMessage,
        { role: "tool", content: "Tool result", toolCallId: "123" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([]);
    });

    it("should handle system as last user/assistant/system message", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: "Before system" } as ThinkingChatMessage,
        { role: "system", content: "System instruction" },
        { role: "thinking", content: "After system" } as ThinkingChatMessage,
        { role: "user", content: "Question" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "system", content: "System instruction" },
        { role: "thinking", content: "After system" } as ThinkingChatMessage,
        { role: "assistant", content: "" },
        { role: "user", content: "Question" },
      ]);
    });

    // NEW TESTS based on our discussion
    it("should handle [T1, Tool1, A1, U, T2, Tool2, T3, Tool3] correctly", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: "T1" } as ThinkingChatMessage,
        { role: "tool", content: "Tool1", toolCallId: "1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "U" },
        { role: "thinking", content: "T2" } as ThinkingChatMessage,
        { role: "tool", content: "Tool2", toolCallId: "2" },
        { role: "thinking", content: "T3" } as ThinkingChatMessage,
        { role: "tool", content: "Tool3", toolCallId: "3" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "tool", content: "Tool1", toolCallId: "1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "U" },
        { role: "thinking", content: "T2" } as ThinkingChatMessage,
        { role: "assistant", content: "" },
        { role: "tool", content: "Tool2", toolCallId: "2" },
        { role: "thinking", content: "T3" } as ThinkingChatMessage,
        { role: "assistant", content: "" },
        { role: "tool", content: "Tool3", toolCallId: "3" },
      ]);
    });

    it("should handle [A1, U1, Tool1, T1, A2, U2, T2, Tool2, T3] correctly", () => {
      const messages: ChatMessage[] = [
        { role: "assistant", content: "A1" },
        { role: "user", content: "U1" },
        { role: "tool", content: "Tool1", toolCallId: "1" },
        { role: "thinking", content: "T1" } as ThinkingChatMessage,
        { role: "assistant", content: "A2" },
        { role: "user", content: "U2" },
        { role: "thinking", content: "T2" } as ThinkingChatMessage,
        { role: "tool", content: "Tool2", toolCallId: "2" },
        { role: "thinking", content: "T3" } as ThinkingChatMessage,
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "assistant", content: "A1" },
        { role: "user", content: "U1" },
        { role: "tool", content: "Tool1", toolCallId: "1" },
        { role: "assistant", content: "A2" },
        { role: "user", content: "U2" },
        { role: "thinking", content: "T2" } as ThinkingChatMessage,
        { role: "assistant", content: "" },
        { role: "tool", content: "Tool2", toolCallId: "2" },
        { role: "thinking", content: "T3" } as ThinkingChatMessage,
        { role: "assistant", content: "" },
      ]);
    });

    it("should handle thinking between user and assistant", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Calculate" },
        { role: "thinking", content: "Thinking" } as ThinkingChatMessage,
        { role: "assistant", content: "42" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "user", content: "Calculate" },
        { role: "assistant", content: "42" },
      ]);
    });

    it("should handle multiple user/assistant messages without thinking", () => {
      const messages: ChatMessage[] = [
        { role: "assistant", content: "A1" },
        { role: "user", content: "U1" },
        { role: "assistant", content: "A2" },
        { role: "user", content: "U2" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "assistant", content: "A1" },
        { role: "user", content: "U1" },
        { role: "assistant", content: "A2" },
        { role: "user", content: "U2" },
      ]);
    });

    it("should handle system message as last user/assistant/system", () => {
      const messages: ChatMessage[] = [
        { role: "system", content: "Be helpful" },
        { role: "thinking", content: "T1" } as ThinkingChatMessage,
        { role: "user", content: "Hi" },
        { role: "thinking", content: "T2" } as ThinkingChatMessage,
        { role: "assistant", content: "Hello" },
      ];

      const result = transformMessages(messages);
      expect(result).toEqual([
        { role: "system", content: "Be helpful" },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
      ]);
    });
  });

  describe("provider configuration", () => {
    it("should have correct provider name", () => {
      expect(DeepSeek.providerName).toBe("deepseek");
      expect(deepSeek.providerName).toBe("deepseek");
    });

    it("should support reasoning field", () => {
      expect((deepSeek as any).supportsReasoningField).toBe(true);
      expect((deepSeek as any).supportsReasoningDetailsField).toBe(false);
    });

    it("should support FIM for deepseek-fim-beta model", () => {
      const fimDeepSeek = new DeepSeek({
        model: "deepseek-fim-beta",
        apiKey: "test-key",
      });
      expect(fimDeepSeek.supportsFim()).toBe(true);
    });

    it("should support FIM for deepseek-chat with beta API base", () => {
      const fimDeepSeek = new DeepSeek({
        model: "deepseek-chat",
        apiBase: "https://api.deepseek.com/beta",
        apiKey: "test-key",
      });
      expect(fimDeepSeek.supportsFim()).toBe(true);
    });

    it("should not support completions", () => {
      expect(deepSeek.supportsCompletions()).toBe(false);
    });

    it("should support prefill", () => {
      expect(deepSeek.supportsPrefill()).toBe(true);
    });

    it("should support list", () => {
      expect(deepSeek.supportsList()).toBe(true);
    });
  });
});
