jest.mock("@continuedev/fetch", () => ({
  streamResponse: jest.fn(),
}));

import { ChatMessage } from "../../index.js";
import Ollama from "./Ollama.js";

function createOllama(): Ollama {
  // Create instance without triggering constructor's fetch call
  const instance = Object.create(Ollama.prototype);
  instance.apiBase = "http://localhost:11434/";
  instance.model = "test-model";
  instance.modelMap = {};
  instance.completionOptions = {};
  instance.requestOptions = {};
  instance._contextLength = 4096;
  instance.fetch = jest.fn();
  return instance;
}

describe("Ollama", () => {
  describe("_convertToOllamaMessage", () => {
    let ollama: Ollama;

    beforeEach(() => {
      ollama = createOllama();
    });

    it("should convert a basic user message", () => {
      const msg: ChatMessage = { role: "user", content: "hello" };
      const result = (ollama as any)._convertToOllamaMessage(msg);
      expect(result).toEqual({ role: "user", content: "hello" });
    });

    it("should convert assistant message with toolCalls, stripping index and other unsupported fields", () => {
      const msg: ChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tc_123",
            type: "function",
            index: 0, // This field causes errors on Gemma3
            function: {
              name: "get_weather",
              arguments: '{"city":"London"}',
            },
          } as any,
        ],
      };
      const result = (ollama as any)._convertToOllamaMessage(msg);

      expect(result.tool_calls).toBeDefined();
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0]).toEqual({
        function: {
          name: "get_weather",
          arguments: { city: "London" },
        },
      });
      // Verify no index, id, or type fields leaked through
      expect(result.tool_calls[0]).not.toHaveProperty("index");
      expect(result.tool_calls[0]).not.toHaveProperty("id");
      expect(result.tool_calls[0]).not.toHaveProperty("type");
    });

    it("should handle toolCalls with object arguments (not string)", () => {
      const msg: ChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tc_456",
            type: "function",
            function: {
              name: "search",
              arguments: { query: "test" } as any,
            },
          } as any,
        ],
      };
      const result = (ollama as any)._convertToOllamaMessage(msg);
      expect(result.tool_calls[0].function.arguments).toEqual({
        query: "test",
      });
    });

    it("should not add tool_calls for assistant messages without them", () => {
      const msg: ChatMessage = { role: "assistant", content: "Sure!" };
      const result = (ollama as any)._convertToOllamaMessage(msg);
      expect(result.tool_calls).toBeUndefined();
    });

    it("should convert tool result messages", () => {
      const msg: ChatMessage = {
        role: "tool",
        content: '{"temp": 20}',
        toolCallId: "tc_123",
      };
      const result = (ollama as any)._convertToOllamaMessage(msg);
      expect(result.role).toBe("tool");
      expect(result.content).toBe('{"temp": 20}');
    });

    it("should filter out toolCalls without a function name", () => {
      const msg: ChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tc_1",
            type: "function",
            function: {
              name: "valid_tool",
              arguments: "{}",
            },
          },
          {
            id: "tc_2",
            type: "function",
            function: {
              name: undefined as any,
              arguments: "{}",
            },
          },
        ],
      };
      const result = (ollama as any)._convertToOllamaMessage(msg);
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].function.name).toBe("valid_tool");
    });
  });

  describe("_reorderMessagesForToolCompat", () => {
    let ollama: Ollama;

    beforeEach(() => {
      ollama = createOllama();
    });

    it("should move system message from after tool to before assistant+tool block", () => {
      const messages = [
        { role: "system" as const, content: "You are helpful" },
        { role: "user" as const, content: "What's the weather?" },
        {
          role: "assistant" as const,
          content: "",
          tool_calls: [{ function: { name: "get_weather", arguments: {} } }],
        },
        { role: "tool" as const, content: '{"temp": 20}' },
        { role: "system" as const, content: "Use metric units" },
        { role: "user" as const, content: "Thanks" },
      ];

      const result = (ollama as any)._reorderMessagesForToolCompat(messages);

      // No system message should follow a tool message
      for (let i = 1; i < result.length; i++) {
        if (result[i].role === "system") {
          expect(result[i - 1].role).not.toBe("tool");
        }
      }

      // The moved system message should appear before the assistant
      const sysIdx = result.findIndex(
        (m: any) => m.role === "system" && m.content === "Use metric units",
      );
      const assistantIdx = result.findIndex((m: any) => m.role === "assistant");
      expect(sysIdx).toBeLessThan(assistantIdx);
    });

    it("should not modify messages when no system follows tool", () => {
      const messages = [
        { role: "system" as const, content: "You are helpful" },
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there" },
      ];

      const result = (ollama as any)._reorderMessagesForToolCompat(messages);
      expect(result).toEqual(messages);
    });

    it("should handle multiple tool results before a system message", () => {
      const messages = [
        { role: "user" as const, content: "Do two things" },
        {
          role: "assistant" as const,
          content: "",
          tool_calls: [
            { function: { name: "tool1", arguments: {} } },
            { function: { name: "tool2", arguments: {} } },
          ],
        },
        { role: "tool" as const, content: "result1" },
        { role: "tool" as const, content: "result2" },
        { role: "system" as const, content: "extra instructions" },
      ];

      const result = (ollama as any)._reorderMessagesForToolCompat(messages);

      // System should come before the assistant message
      const sysIdx = result.findIndex(
        (m: any) => m.content === "extra instructions",
      );
      const assistantIdx = result.findIndex((m: any) => m.role === "assistant");
      expect(sysIdx).toBeLessThan(assistantIdx);

      // No system message should follow a tool message
      for (let i = 1; i < result.length; i++) {
        if (result[i].role === "system") {
          expect(result[i - 1].role).not.toBe("tool");
        }
      }
    });

    it("should handle system message after tool when no preceding assistant", () => {
      // Edge case: tool messages without a preceding assistant
      const messages = [
        { role: "tool" as const, content: "result" },
        { role: "system" as const, content: "instructions" },
      ];

      const result = (ollama as any)._reorderMessagesForToolCompat(messages);

      // System should be moved before tool
      expect(result[0].role).toBe("system");
      expect(result[1].role).toBe("tool");
    });
  });

  describe("request option overrides", () => {
    let ollama: Ollama;

    beforeEach(() => {
      ollama = createOllama();
    });

    it("should merge requestOptions.options into generate requests", () => {
      (ollama as any).requestOptions = {
        options: {
          num_gpu: 20,
          num_thread: 8,
          keep_alive: -1,
          repeat_penalty: 1.2,
        },
      };

      const result = (ollama as any)._getGenerateOptions({}, "hello");

      expect(result.options).toMatchObject({
        num_ctx: 4096,
        num_gpu: 20,
        num_thread: 8,
        repeat_penalty: 1.2,
      });
      expect(result.keep_alive).toBe(-1);
    });

    it("should let completion options override request option defaults", () => {
      (ollama as any).requestOptions = {
        keepAlive: -1,
        options: {
          num_gpu: 20,
          num_thread: 8,
        },
      };

      const result = (ollama as any)._getGenerateOptions(
        {
          keepAlive: 120,
          numGpu: 4,
          numThreads: 2,
        },
        "hello",
      );

      expect(result.options).toMatchObject({
        num_ctx: 4096,
        num_gpu: 4,
        num_thread: 2,
      });
      expect(result.keep_alive).toBe(120);
    });
  });

  describe("tool attachment", () => {
    const tool = {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get weather",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
        },
      },
    } as any;

    async function runChatRequest(ollama: Ollama) {
      (ollama as any).modelInfoPromise = Promise.resolve();
      (ollama as any).fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: async () => ({
          message: { role: "assistant", content: "ok" },
        }),
      });

      const messages: ChatMessage[] = [{ role: "user", content: "hello" }];
      for await (const _ of (ollama as any)._streamChat(
        messages,
        new AbortController().signal,
        { tools: [tool], stream: false },
      )) {
      }

      const [, init] = ((ollama as any).fetch as jest.Mock).mock.calls[0];
      return JSON.parse(init.body);
    }

    it("should skip tools when the model template does not support them", async () => {
      const ollama = createOllama();
      (ollama as any).templateSupportsTools = false;

      const requestBody = await runChatRequest(ollama);

      expect(requestBody.tools).toBeUndefined();
    });

    it("should let explicit capabilities override the template tool gate", async () => {
      const ollama = createOllama();
      (ollama as any).templateSupportsTools = false;
      (ollama as any).capabilities = { tools: true };

      const requestBody = await runChatRequest(ollama);

      expect(requestBody.tools).toHaveLength(1);
      expect(requestBody.tools[0].function.name).toBe("get_weather");
    });
  });
});
