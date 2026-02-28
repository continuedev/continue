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

  describe("_pairLoneThinkingMessages", () => {
    // Helper method to access private method for testing
    const pairLoneThinkingMessages = (
      messages: ChatMessage[],
    ): ChatMessage[] => {
      // Use type assertion to access private method
      return (deepSeek as any)._pairLoneThinkingMessages(messages);
    };

    it("should return empty array for empty input", () => {
      expect(pairLoneThinkingMessages([])).toEqual([]);
    });

    it("should not modify messages without thinking", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "How are you?" },
        { role: "assistant", content: "Fine" },
      ];
      expect(pairLoneThinkingMessages(messages)).toEqual(messages);
    });

    it("should insert empty assistant after lone thinking message", () => {
      const messages: ChatMessage[] = [
        {
          role: "thinking",
          content: "I need to respond",
        } as ThinkingChatMessage,
        { role: "user", content: "Hello" },
      ];
      const result = pairLoneThinkingMessages(messages);
      expect(result).toEqual([
        { role: "thinking", content: "I need to respond" },
        { role: "assistant", content: "" },
        { role: "user", content: "Hello" },
      ]);
    });

    it("should not insert assistant if thinking followed by assistant", () => {
      const messages: ChatMessage[] = [
        {
          role: "thinking",
          content: "I need to respond",
        } as ThinkingChatMessage,
        { role: "assistant", content: "Hello there" },
      ];
      expect(pairLoneThinkingMessages(messages)).toEqual(messages);
    });

    it("should handle multiple lone thinking messages", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: "T1" } as ThinkingChatMessage,
        { role: "thinking", content: "T2" } as ThinkingChatMessage,
        { role: "user", content: "Hello" },
        { role: "thinking", content: "T3" } as ThinkingChatMessage,
        { role: "assistant", content: "Hi" },
      ];
      const result = pairLoneThinkingMessages(messages);
      expect(result).toEqual([
        { role: "thinking", content: "T1" },
        { role: "assistant", content: "" },
        { role: "thinking", content: "T2" },
        { role: "assistant", content: "" },
        { role: "user", content: "Hello" },
        { role: "thinking", content: "T3" },
        { role: "assistant", content: "Hi" },
      ]);
    });

    it("should handle thinking messages in tool call loops", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Get weather" },
        {
          role: "thinking",
          content: "Need to call tool",
        } as ThinkingChatMessage,
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
      const result = pairLoneThinkingMessages(messages);
      expect(result).toEqual([
        { role: "user", content: "Get weather" },
        { role: "thinking", content: "Need to call tool" },
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
        { role: "thinking", content: "Now respond" },
        { role: "assistant", content: "It's sunny" },
      ]);
    });

    it("should handle system messages", () => {
      const messages: ChatMessage[] = [
        { role: "system", content: "Be helpful" },
        { role: "thinking", content: "Processing" } as ThinkingChatMessage,
        { role: "user", content: "Hello" },
      ];
      const result = pairLoneThinkingMessages(messages);
      expect(result).toEqual([
        { role: "system", content: "Be helpful" },
        { role: "thinking", content: "Processing" },
        { role: "assistant", content: "" },
        { role: "user", content: "Hello" },
      ]);
    });

    it("should handle tool messages (no insertion)", () => {
      const messages: ChatMessage[] = [
        { role: "tool", content: "Result", toolCallId: "1" },
        { role: "thinking", content: "Next" } as ThinkingChatMessage,
        { role: "assistant", content: "Ok" },
      ];
      const result = pairLoneThinkingMessages(messages);
      expect(result).toEqual([
        { role: "tool", content: "Result", toolCallId: "1" },
        { role: "thinking", content: "Next" },
        { role: "assistant", content: "Ok" },
      ]);
    });
  });

  describe("provider configuration", () => {
    it("should have correct provider name", () => {
      expect(DeepSeek.providerName).toBe("deepseek");
      expect(deepSeek.providerName).toBe("deepseek");
    });

    it("should support reasoning content field", () => {
      expect((deepSeek as any).supportsReasoningContentField).toBe(true);
      expect((deepSeek as any).supportsReasoningField).toBe(false);
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
