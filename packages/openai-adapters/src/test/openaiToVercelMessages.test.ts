import type { ChatCompletionMessageParam } from "openai/resources/index.js";
import { describe, expect, test } from "vitest";
import { convertOpenAIMessagesToVercel } from "../openaiToVercelMessages.js";

describe("convertOpenAIMessagesToVercel", () => {
  describe("system messages", () => {
    test("converts system message with string content", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: "You are a helpful assistant." },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });
    });

    test("converts system message with array content to JSON string", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: [{ type: "text", text: "System prompt" }] as any,
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("system");
      expect(result[0].content).toBe(
        JSON.stringify([{ type: "text", text: "System prompt" }]),
      );
    });
  });

  describe("user messages", () => {
    test("converts user message with string content", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Hello, how are you?" },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "user",
        content: "Hello, how are you?",
      });
    });

    test("preserves user message array content", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            { type: "image_url", image_url: { url: "http://example.com/img" } },
          ],
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("user");
      expect(result[0].content).toEqual([
        { type: "text", text: "What is this?" },
        { type: "image_url", image_url: { url: "http://example.com/img" } },
      ]);
    });
  });

  describe("assistant messages", () => {
    test("converts assistant message without tool calls", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "assistant", content: "I'm doing well, thank you!" },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content: "I'm doing well, thank you!",
      });
    });

    test("converts assistant message with null content to empty string", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "assistant", content: null },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content: "",
      });
    });

    test("converts assistant message with tool calls", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_123",
              type: "function",
              function: {
                name: "readFile",
                arguments: '{"filepath": "/test.txt"}',
              },
            },
          ],
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("assistant");
      expect(result[0].content).toEqual([
        {
          type: "tool-call",
          toolCallId: "call_123",
          toolName: "readFile",
          input: { filepath: "/test.txt" },
        },
      ]);
    });

    test("converts assistant message with content and tool calls", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "assistant",
          content: "Let me read that file for you.",
          tool_calls: [
            {
              id: "call_456",
              type: "function",
              function: {
                name: "readFile",
                arguments: '{"filepath": "/data.json"}',
              },
            },
          ],
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("assistant");
      expect(result[0].content).toEqual([
        {
          type: "text",
          text: "Let me read that file for you.",
        },
        {
          type: "tool-call",
          toolCallId: "call_456",
          toolName: "readFile",
          input: { filepath: "/data.json" },
        },
      ]);
    });

    test("converts assistant message with multiple tool calls", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "readFile",
                arguments: '{"filepath": "/a.txt"}',
              },
            },
            {
              id: "call_2",
              type: "function",
              function: {
                name: "writeFile",
                arguments: '{"filepath": "/b.txt", "content": "hello"}',
              },
            },
          ],
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect(result[0].content).toHaveLength(2);
      expect((result[0].content as any[])[0].toolName).toBe("readFile");
      expect((result[0].content as any[])[1].toolName).toBe("writeFile");
    });

    test("handles invalid JSON arguments gracefully", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_789",
              type: "function",
              function: {
                name: "testTool",
                arguments: "not valid json",
              },
            },
          ],
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect((result[0].content as any[])[0].input).toBe("not valid json");
    });

    test("includes thought signature from extra_content when present", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_thought",
              type: "function",
              function: {
                name: "testTool",
                arguments: "{}",
              },
              extra_content: {
                google: {
                  thought_signature: "sig_123",
                },
              },
            } as any,
          ],
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect((result[0].content as any[])[0]).toEqual({
        type: "tool-call",
        toolCallId: "call_thought",
        toolName: "testTool",
        input: {},
        providerOptions: {
          google: {
            thoughtSignature: "sig_123",
          },
        },
      });
    });
  });

  describe("tool messages", () => {
    test("converts tool result message", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_abc",
              type: "function",
              function: {
                name: "readFile",
                arguments: '{"filepath": "/test.txt"}',
              },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call_abc",
          content: "File contents here",
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call_abc",
            toolName: "readFile",
            output: {
              type: "text",
              value: "File contents here",
            },
          },
        ],
      });
    });

    test("uses 'unknown_tool' when tool name not found in map", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "tool",
          tool_call_id: "call_unknown",
          content: "Some result",
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect((result[0].content as any[])[0].toolName).toBe("unknown_tool");
    });

    test("converts tool result with array content to JSON string", () => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "tool",
          tool_call_id: "call_array",
          content: [{ type: "text", text: "result" }] as any,
        },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(1);
      expect((result[0].content as any[])[0].output.value).toBe(
        JSON.stringify([{ type: "text", text: "result" }]),
      );
    });
  });

  describe("multi-turn conversations", () => {
    test("converts complete conversation with tool usage", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Read the file test.txt" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_read",
              type: "function",
              function: {
                name: "readFile",
                arguments: '{"filepath": "test.txt"}',
              },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call_read",
          content: "Hello World",
        },
        { role: "assistant", content: 'The file contains "Hello World".' },
      ];

      const result = convertOpenAIMessagesToVercel(messages);

      expect(result).toHaveLength(5);
      expect(result[0].role).toBe("system");
      expect(result[1].role).toBe("user");
      expect(result[2].role).toBe("assistant");
      expect(result[3].role).toBe("tool");
      expect(result[4].role).toBe("assistant");
    });
  });
});
