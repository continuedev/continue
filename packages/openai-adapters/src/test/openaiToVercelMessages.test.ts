import type { ChatCompletionMessageParam } from "openai/resources/index.js";
import { describe, expect, test } from "vitest";
import { convertOpenAIMessagesToVercel } from "../openaiToVercelMessages.js";

describe("convertOpenAIMessagesToVercel", () => {
  test("converts empty array", () => {
    const result = convertOpenAIMessagesToVercel([]);
    expect(result).toEqual([]);
  });

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

  test("converts system message with array content", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: [{ type: "text", text: "You are helpful." }],
      },
    ];

    const result = convertOpenAIMessagesToVercel(messages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toBe(
      JSON.stringify([{ type: "text", text: "You are helpful." }]),
    );
  });

  test("converts user message with string content", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello!" },
    ];

    const result = convertOpenAIMessagesToVercel(messages);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "user",
      content: "Hello!",
    });
  });

  test("converts user message with array content", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          {
            type: "image_url",
            image_url: { url: "http://example.com/img.png" },
          },
        ],
      },
    ];

    const result = convertOpenAIMessagesToVercel(messages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(Array.isArray(result[0].content)).toBe(true);
  });

  test("converts assistant message with string content", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "assistant", content: "Hello! How can I help?" },
    ];

    const result = convertOpenAIMessagesToVercel(messages);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "assistant",
      content: "Hello! How can I help?",
    });
  });

  test("converts assistant message with null content", () => {
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
    expect(Array.isArray(result[0].content)).toBe(true);
    expect(result[0].content).toHaveLength(1);
    expect(result[0].content[0]).toEqual({
      type: "tool-call",
      toolCallId: "call_123",
      toolName: "readFile",
      input: { filepath: "/test.txt" },
    });
  });

  test("converts assistant message with tool calls and text content", () => {
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
    expect(Array.isArray(result[0].content)).toBe(true);
    expect(result[0].content).toHaveLength(2);
    expect(result[0].content[0]).toEqual({
      type: "text",
      text: "Let me read that file for you.",
    });
    expect(result[0].content[1]).toEqual({
      type: "tool-call",
      toolCallId: "call_456",
      toolName: "readFile",
      input: { filepath: "/data.json" },
    });
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
    expect(result[0].content[0].toolName).toBe("readFile");
    expect(result[0].content[1].toolName).toBe("writeFile");
  });

  test("handles invalid JSON in tool call arguments", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_bad",
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
    expect(result[0].content[0]).toEqual({
      type: "tool-call",
      toolCallId: "call_bad",
      toolName: "testTool",
      input: "not valid json",
    });
  });

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
    expect(result[1].role).toBe("tool");
    expect(Array.isArray(result[1].content)).toBe(true);
    expect(result[1].content[0]).toEqual({
      type: "tool-result",
      toolCallId: "call_abc",
      toolName: "readFile",
      output: {
        type: "text",
        value: "File contents here",
      },
    });
  });

  test("converts tool result message with unknown tool name", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "tool",
        tool_call_id: "unknown_call",
        content: "Some result",
      },
    ];

    const result = convertOpenAIMessagesToVercel(messages);

    expect(result).toHaveLength(1);
    expect(result[0].content[0].toolName).toBe("unknown_tool");
  });

  test("converts full multi-turn conversation with tools", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are an assistant." },
      { role: "user", content: "Read the config file" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_config",
            type: "function",
            function: {
              name: "readFile",
              arguments: '{"filepath": "/config.json"}',
            },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_config",
        content: '{"setting": "value"}',
      },
      {
        role: "assistant",
        content: "The config contains setting: value",
      },
    ];

    const result = convertOpenAIMessagesToVercel(messages);

    expect(result).toHaveLength(5);
    expect(result[0].role).toBe("system");
    expect(result[1].role).toBe("user");
    expect(result[2].role).toBe("assistant");
    expect(result[3].role).toBe("tool");
    expect(result[4].role).toBe("assistant");
    expect(result[4].content).toBe("The config contains setting: value");
  });

  test("converts tool result with non-string content", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_obj",
            type: "function",
            function: {
              name: "getData",
              arguments: "{}",
            },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_obj",
        content: [{ type: "text", text: "result data" }] as any,
      },
    ];

    const result = convertOpenAIMessagesToVercel(messages);

    expect(result).toHaveLength(2);
    expect(result[1].content[0].output.value).toBe(
      JSON.stringify([{ type: "text", text: "result data" }]),
    );
  });

  test("handles assistant message with empty tool_calls array", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: "No tools needed",
        tool_calls: [],
      },
    ];

    const result = convertOpenAIMessagesToVercel(messages);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "assistant",
      content: "No tools needed",
    });
  });
});
