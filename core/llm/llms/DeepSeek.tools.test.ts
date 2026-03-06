import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ChatMessage, ThinkingChatMessage } from "../../index.js";
import DeepSeek from "./DeepSeek.js";
import { runLlmTest } from "./llmTestHarness.js";

describe.skip("DeepSeek Tools and Thinking Integration Tests", () => {
  let deepSeek: DeepSeek;

  beforeEach(() => {
    deepSeek = new DeepSeek({
      model: "deepseek-reasoner",
      apiKey: "test-api-key",
      apiBase: "https://api.deepseek.com",
    });
  });

  describe("Tool calls with thinking messages", () => {
    it("should handle thinking followed by tool call", async () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Get the weather" },
        {
          role: "thinking",
          content: "I need to call the weather API",
        } as ThinkingChatMessage,
      ];

      const tools = [
        {
          type: "function" as const,
          function: {
            name: "get_weather",
            description: "Get weather information",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string" },
              },
            },
          },
        },
      ];

      await runLlmTest({
        llm: deepSeek,
        methodToTest: "streamChat",
        params: [messages, new AbortController().signal, { tools }],
        expectedRequest: {
          url: "https://api.deepseek.com/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            model: "deepseek-reasoner",
            messages: [
              { role: "user", content: "Get the weather" },
              { role: "thinking", content: "I need to call the weather API" },
              { role: "assistant", content: "" }, // Auto-inserted
            ],
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: 2048,
            tools,
          },
        },
        mockStream: [
          'data: {"choices":[{"delta":{"tool_calls":[{"id":"1","type":"function","function":{"name":"get_weather","arguments":"{\\"location\\": \\"NYC\\"}"}}]}}]}\n\n',
        ],
      });
    });

    it("should handle thinking -> assistant -> tool -> thinking -> assistant pattern", async () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Calculate something" },
        {
          role: "thinking",
          content: "I need to use the calculator",
        } as ThinkingChatMessage,
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "1",
              type: "function",
              function: {
                name: "calculate",
                arguments: '{"expression": "2+2"}',
              },
            },
          ],
        },
        { role: "tool", content: "4", toolCallId: "1" },
        { role: "thinking", content: "The result is 4" } as ThinkingChatMessage,
      ];

      await runLlmTest({
        llm: deepSeek,
        methodToTest: "streamChat",
        params: [messages, new AbortController().signal],
        expectedRequest: {
          url: "https://api.deepseek.com/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            model: "deepseek-reasoner",
            messages: [
              { role: "user", content: "Calculate something" },
              { role: "thinking", content: "I need to use the calculator" },
              { role: "assistant", content: "" }, // Auto-inserted
              {
                role: "assistant",
                content: "",
                toolCalls: [
                  {
                    id: "1",
                    type: "function",
                    function: {
                      name: "calculate",
                      arguments: '{"expression": "2+2"}',
                    },
                  },
                ],
              },
              { role: "tool", content: "4", toolCallId: "1" },
              { role: "thinking", content: "The result is 4" },
              { role: "assistant", content: "" }, // Auto-inserted
            ],
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: 2048,
          },
        },
        mockStream: [
          'data: {"choices":[{"delta":{"content":"The result is 4"}}]}\n\n',
        ],
      });
    });

    it("should not insert assistant message when thinking is already followed by assistant", async () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Hello" },
        {
          role: "thinking",
          content: "I should respond",
        } as ThinkingChatMessage,
        { role: "assistant", content: "Hello there!" },
      ];

      await runLlmTest({
        llm: deepSeek,
        methodToTest: "streamChat",
        params: [messages, new AbortController().signal],
        expectedRequest: {
          url: "https://api.deepseek.com/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            model: "deepseek-reasoner",
            messages: [
              { role: "user", content: "Hello" },
              { role: "thinking", content: "I should respond" },
              { role: "assistant", content: "Hello there!" },
              // No extra assistant message inserted
            ],
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: 2048,
          },
        },
        mockStream: [
          'data: {"choices":[{"delta":{"content":"How can I help?"}}]}\n\n',
        ],
      });
    });

    it("should handle complex multi-tool scenarios with thinking", async () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Get weather and time" },
        {
          role: "thinking",
          content: "I need to call both weather and time APIs",
        } as ThinkingChatMessage,
      ];

      const tools = [
        {
          type: "function" as const,
          function: {
            name: "get_weather",
            description: "Get weather",
            parameters: { type: "object", properties: {} },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "get_time",
            description: "Get current time",
            parameters: { type: "object", properties: {} },
          },
        },
      ];

      await runLlmTest({
        llm: deepSeek,
        methodToTest: "streamChat",
        params: [messages, new AbortController().signal, { tools }],
        expectedRequest: {
          url: "https://api.deepseek.com/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            model: "deepseek-reasoner",
            messages: [
              { role: "user", content: "Get weather and time" },
              {
                role: "thinking",
                content: "I need to call both weather and time APIs",
              },
              { role: "assistant", content: "" }, // Auto-inserted
            ],
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: 2048,
            tools,
          },
        },
        mockStream: [
          'data: {"choices":[{"delta":{"tool_calls":[{"id":"1","type":"function","function":{"name":"get_weather","arguments":"{}"}}]}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"id":"2","type":"function","function":{"name":"get_time","arguments":"{}"}}]}}]}\n\n',
        ],
      });
    });
  });

  describe("Edge cases with tools and thinking", () => {
    it("should handle empty thinking content", async () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Hello" },
        { role: "thinking", content: "" } as ThinkingChatMessage,
      ];

      await runLlmTest({
        llm: deepSeek,
        methodToTest: "streamChat",
        params: [messages, new AbortController().signal],
        expectedRequest: {
          url: "https://api.deepseek.com/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            model: "deepseek-reasoner",
            messages: [
              { role: "user", content: "Hello" },
              { role: "thinking", content: "" },
              { role: "assistant", content: "" }, // Auto-inserted
            ],
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: 2048,
          },
        },
        mockStream: ['data: {"choices":[{"delta":{"content":"Hello!"}}]}\n\n'],
      });
    });

    it("should handle system messages with thinking and tools", async () => {
      const messages: ChatMessage[] = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Use the calculator" },
        {
          role: "thinking",
          content: "I need to calculate something",
        } as ThinkingChatMessage,
      ];

      const tools = [
        {
          type: "function" as const,
          function: {
            name: "calculate",
            description: "Calculate expressions",
            parameters: { type: "object", properties: {} },
          },
        },
      ];

      await runLlmTest({
        llm: deepSeek,
        methodToTest: "streamChat",
        params: [messages, new AbortController().signal, { tools }],
        expectedRequest: {
          url: "https://api.deepseek.com/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            model: "deepseek-reasoner",
            messages: [
              { role: "system", content: "You are a helpful assistant" },
              { role: "user", content: "Use the calculator" },
              { role: "thinking", content: "I need to calculate something" },
              { role: "assistant", content: "" }, // Auto-inserted
            ],
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: 2048,
            tools,
          },
        },
        mockStream: [
          'data: {"choices":[{"delta":{"tool_calls":[{"id":"1","type":"function","function":{"name":"calculate","arguments":"{}"}}]}}]}\n\n',
        ],
      });
    });
  });

  describe("Unit tests for thinking message pairing with tools", () => {
    it("should correctly pair thinking messages in complex tool scenarios", () => {
      const complexMessages: ChatMessage[] = [
        { role: "user", content: "Complex task" },
        { role: "thinking", content: "First thinking" } as ThinkingChatMessage,
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "1",
              type: "function",
              function: { name: "tool1", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "Result 1", toolCallId: "1" },
        { role: "thinking", content: "Second thinking" } as ThinkingChatMessage,
        { role: "assistant", content: "Final response" },
      ];

      const mockFetch = jest.fn();
      const result = (deepSeek as any)._pairLoneThinkingMessages(
        complexMessages,
      );

      expect(result).toEqual([
        { role: "user", content: "Complex task" },
        { role: "thinking", content: "First thinking" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "1",
              type: "function",
              function: { name: "tool1", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "Result 1", toolCallId: "1" },
        { role: "thinking", content: "Second thinking" },
        { role: "assistant", content: "Final response" }, // Already present, no insertion
      ]);
    });
  });
});
