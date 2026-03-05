import { beforeEach, describe, expect, it } from "@jest/globals";
import { ChatMessage, ThinkingChatMessage } from "../../index.js";
import DeepSeek from "./DeepSeek.js";

describe("DeepSeek Unit Tests", () => {
  let deepSeek: DeepSeek;

  beforeEach(() => {
    deepSeek = new DeepSeek({
      model: "deepseek-chat",
      apiKey: "test-key",
      apiBase: "https://api.deepseek.com",
    });
  });

  describe("constructor and initialization", () => {
    it("should initialize with correct default options", () => {
      expect(deepSeek.model).toBe("deepseek-chat");
      expect(DeepSeek.providerName).toBe("deepseek");
      expect(DeepSeek.defaultOptions.useLegacyCompletionsEndpoint).toBe(false);
    });

    it("should support reasoning content field", () => {
      expect((deepSeek as any).supportsReasoningContentField).toBe(true);
    });
  });

  describe("_convertModelName", () => {
    it("should convert deepseek-fim-beta to deepseek-chat", () => {
      const result = (deepSeek as any)._convertModelName("deepseek-fim-beta");
      expect(result).toBe("deepseek-chat");
    });

    it("should return other models unchanged", () => {
      expect((deepSeek as any)._convertModelName("deepseek-chat")).toBe("deepseek-chat");
      expect((deepSeek as any)._convertModelName("deepseek-reasoner")).toBe("deepseek-reasoner");
      expect((deepSeek as any)._convertModelName("gpt-4")).toBe("gpt-4");
    });

    it("should handle undefined model", () => {
      const result = (deepSeek as any)._convertModelName(undefined);
      expect(result).toBeUndefined();
    });

    it("should handle empty string", () => {
      const result = (deepSeek as any)._convertModelName("");
      expect(result).toBe("");
    });
  });

  describe("modifyChatBody", () => {
    it("should add stream_options for streaming requests", () => {
      const body = {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      };

      const result = (deepSeek as any).modifyChatBody(body);

      expect(result.stream_options).toEqual({ include_usage: true });
    });

    it("should not add stream_options for non-streaming requests", () => {
      const body = {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      };

      const result = (deepSeek as any).modifyChatBody(body);

      expect(result.stream_options).toBeUndefined();
    });

    it("should preserve existing properties", () => {
      const body = {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
        temperature: 0.7,
        max_tokens: 1000,
      };

      const result = (deepSeek as any).modifyChatBody(body);

      expect(result.temperature).toBe(0.7);
      expect(result.max_tokens).toBe(1000);
      expect(result.stream_options).toEqual({ include_usage: true });
    });
  });

  describe("supportsFim", () => {
    it("should return true for deepseek-fim-beta model", () => {
      const fimDeepSeek = new DeepSeek({
        model: "deepseek-fim-beta",
        apiKey: "test-key",
      });
      expect(fimDeepSeek.supportsFim()).toBe(true);
    });

    it("should return true for deepseek-chat with beta API base", () => {
      const betaDeepSeek = new DeepSeek({
        model: "deepseek-chat",
        apiBase: "https://api.deepseek.com/beta",
        apiKey: "test-key",
      });
      expect(betaDeepSeek.supportsFim()).toBe(true);
    });

    it("should return false for deepseek-chat without beta API", () => {
      expect(deepSeek.supportsFim()).toBe(false);
    });

    it("should return false for other models", () => {
      const otherDeepSeek = new DeepSeek({
        model: "deepseek-reasoner",
        apiKey: "test-key",
      });
      expect(otherDeepSeek.supportsFim()).toBe(false);
    });

    it("should handle case-sensitive beta detection", () => {
      const betaDeepSeek = new DeepSeek({
        model: "deepseek-chat",
        apiBase: "https://api.deepseek.com/BETA",
        apiKey: "test-key",
      });
      expect(betaDeepSeek.supportsFim()).toBe(false); // Should be case-sensitive
    });
  });

  describe("support methods", () => {
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

  describe("useOpenAIAdapterFor configuration", () => {
    it("should include correct request types", () => {
      const adapterTypes = (deepSeek as any).useOpenAIAdapterFor;
      expect(adapterTypes).toContain("chat");
      expect(adapterTypes).toContain("streamChat");
      expect(adapterTypes).toContain("streamFim");
      expect(adapterTypes).toContain("list");
    });
  });

  describe("_pairLoneThinkingMessages edge cases", () => {
    it("should handle null content in thinking messages", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: null } as any,
        { role: "user", content: "Hello" },
      ];
      const result = (deepSeek as any)._pairLoneThinkingMessages(messages);
      expect(result).toEqual([
        { role: "thinking", content: null },
        { role: "assistant", content: "" },
        { role: "user", content: "Hello" },
      ]);
    });

    it("should handle undefined content in thinking messages", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: undefined } as any,
        { role: "user", content: "Hello" },
      ];
      const result = (deepSeek as any)._pairLoneThinkingMessages(messages);
      expect(result).toEqual([
        { role: "thinking", content: undefined },
        { role: "assistant", content: "" },
        { role: "user", content: "Hello" },
      ]);
    });

    it("should handle last message being thinking", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Hello" },
        { role: "thinking", content: "Processing" } as ThinkingChatMessage,
      ];
      const result = (deepSeek as any)._pairLoneThinkingMessages(messages);
      expect(result).toEqual([
        { role: "user", content: "Hello" },
        { role: "thinking", content: "Processing" },
        { role: "assistant", content: "" },
      ]);
    });

    it("should handle complex tool call scenarios", () => {
      const complexMessages: ChatMessage[] = [
        { role: "user", content: "Complex task" },
        { role: "thinking", content: "First thinking" } as ThinkingChatMessage,
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "1", type: "function", function: { name: "tool1", arguments: "{}" } }],
        },
        { role: "tool", content: "Result 1", toolCallId: "1" },
        { role: "thinking", content: "Second thinking" } as ThinkingChatMessage,
        { role: "assistant", content: "Final response" },
      ];

      const result = (deepSeek as any)._pairLoneThinkingMessages(complexMessages);

      expect(result).toEqual([
        { role: "user", content: "Complex task" },
        { role: "thinking", content: "First thinking" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "1", type: "function", function: { name: "tool1", arguments: "{}" } }],
        },
        { role: "tool", content: "Result 1", toolCallId: "1" },
        { role: "thinking", content: "Second thinking" },
        { role: "assistant", content: "Final response" }, // Already present, no insertion
      ]);
    });

    it("should handle multiple consecutive thinking messages", () => {
      const messages: ChatMessage[] = [
        { role: "thinking", content: "T1" } as ThinkingChatMessage,
        { role: "thinking", content: "T2" } as ThinkingChatMessage,
        { role: "thinking", content: "T3" } as ThinkingChatMessage,
        { role: "user", content: "Hello" },
      ];

      const result = (deepSeek as any)._pairLoneThinkingMessages(messages);

      expect(result).toEqual([
        { role: "thinking", content: "T1" },
        { role: "assistant", content: "" },
        { role: "thinking", content: "T2" },
        { role: "assistant", content: "" },
        { role: "thinking", content: "T3" },
        { role: "assistant", content: "" },
        { role: "user", content: "Hello" },
      ]);
    });
  });

  describe("default options validation", () => {
    it("should have correct base chat system message", () => {
      expect(DeepSeek.defaultOptions.baseChatSystemMessage).toContain("DeepSeek");
      expect(DeepSeek.defaultOptions.baseChatSystemMessage).toContain("Continue");
    });

    it("should have edit prompt template", () => {
      expect(DeepSeek.defaultOptions.promptTemplates?.edit).toBeDefined();
      expect(typeof DeepSeek.defaultOptions.promptTemplates?.edit).toBe("function");
    });
  });
});
