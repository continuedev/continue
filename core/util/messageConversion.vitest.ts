import { describe, expect, it } from "vitest";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";
import type { ChatMessage, ChatHistoryItem, ToolCallState } from "../index.js";
import {
  convertToUnifiedMessage,
  convertFromUnifiedMessage,
  createHistoryItem,
  convertToUnifiedHistory,
  convertFromUnifiedHistory,
  convertFromUnifiedHistoryWithSystemMessage,
  extractToolCallInfo,
} from "./messageConversion.js";

describe("convertToUnifiedMessage", () => {
  describe("system messages", () => {
    it("should convert a system message with string content", () => {
      const input: ChatCompletionMessageParam = {
        role: "system",
        content: "You are a helpful assistant.",
      };
      const result = convertToUnifiedMessage(input);
      expect(result).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });
    });

    it("should handle null content in system messages", () => {
      const input: ChatCompletionMessageParam = {
        role: "system",
        content: null as unknown as string,
      };
      const result = convertToUnifiedMessage(input);
      expect(result).toEqual({
        role: "system",
        content: "",
      });
    });
  });

  describe("user messages", () => {
    it("should convert a user message with string content", () => {
      const input: ChatCompletionMessageParam = {
        role: "user",
        content: "Hello, how are you?",
      };
      const result = convertToUnifiedMessage(input);
      expect(result).toEqual({
        role: "user",
        content: "Hello, how are you?",
      });
    });

    it("should convert a user message with array content containing text", () => {
      const input: ChatCompletionMessageParam = {
        role: "user",
        content: [{ type: "text", text: "What is in this image?" }],
      };
      const result = convertToUnifiedMessage(input);
      expect(result).toEqual({
        role: "user",
        content: [{ type: "text", text: "What is in this image?" }],
      });
    });

    it("should convert a user message with image_url content", () => {
      const input: ChatCompletionMessageParam = {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/image.png" },
          },
        ],
      };
      const result = convertToUnifiedMessage(input);
      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "imageUrl",
            imageUrl: { url: "https://example.com/image.png" },
          },
        ],
      });
    });

    it("should convert a user message with mixed text and image content", () => {
      const input: ChatCompletionMessageParam = {
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/image.png" },
          },
        ],
      };
      const result = convertToUnifiedMessage(input);
      expect(result).toEqual({
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          {
            type: "imageUrl",
            imageUrl: { url: "https://example.com/image.png" },
          },
        ],
      });
    });
  });

  describe("assistant messages", () => {
    it("should convert an assistant message with string content", () => {
      const input: ChatCompletionMessageParam = {
        role: "assistant",
        content: "I am doing well, thank you!",
      };
      const result = convertToUnifiedMessage(input);
      expect(result).toEqual({
        role: "assistant",
        content: "I am doing well, thank you!",
      });
    });

    it("should convert an assistant message with null content", () => {
      const input: ChatCompletionMessageParam = {
        role: "assistant",
        content: null,
      };
      const result = convertToUnifiedMessage(input);
      expect(result).toEqual({
        role: "assistant",
        content: "",
      });
    });

    it("should convert an assistant message with tool calls", () => {
      const input: ChatCompletionMessageParam = {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location": "New York"}',
            },
          },
        ],
      };
      const result = convertToUnifiedMessage(input);
      expect(result.role).toBe("assistant");
      expect(result.content).toBe("");
      expect((result as any).toolCalls).toEqual([
        {
          id: "call_123",
          type: "function",
          function: {
            name: "get_weather",
            arguments: '{"location": "New York"}',
          },
        },
      ]);
    });
  });

  describe("tool messages", () => {
    it("should convert a tool message", () => {
      const input: ChatCompletionMessageParam = {
        role: "tool",
        content: "The weather in New York is sunny.",
        tool_call_id: "call_123",
      };
      const result = convertToUnifiedMessage(input);
      expect(result).toEqual({
        role: "tool",
        content: "The weather in New York is sunny.",
        toolCallId: "call_123",
      });
    });
  });

  describe("error handling", () => {
    it("should throw error for unsupported role", () => {
      const input = {
        role: "unknown_role",
        content: "test",
      } as unknown as ChatCompletionMessageParam;
      expect(() => convertToUnifiedMessage(input)).toThrow(
        "Unsupported message role: unknown_role",
      );
    });
  });
});

describe("convertFromUnifiedMessage", () => {
  describe("system messages", () => {
    it("should convert a unified system message", () => {
      const input: ChatMessage = {
        role: "system",
        content: "You are a helpful assistant.",
      };
      const result = convertFromUnifiedMessage(input);
      expect(result).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });
    });
  });

  describe("user messages", () => {
    it("should convert a unified user message with string content", () => {
      const input: ChatMessage = {
        role: "user",
        content: "Hello!",
      };
      const result = convertFromUnifiedMessage(input);
      expect(result).toEqual({
        role: "user",
        content: "Hello!",
      });
    });

    it("should convert a unified user message with array content", () => {
      const input: ChatMessage = {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          {
            type: "imageUrl",
            imageUrl: { url: "https://example.com/img.png" },
          },
        ],
      };
      const result = convertFromUnifiedMessage(input);
      expect(result).toEqual({
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/img.png" },
          },
        ],
      });
    });
  });

  describe("assistant messages", () => {
    it("should convert a unified assistant message", () => {
      const input: ChatMessage = {
        role: "assistant",
        content: "Hello!",
      };
      const result = convertFromUnifiedMessage(input);
      expect(result).toEqual({
        role: "assistant",
        content: "Hello!",
      });
    });

    it("should convert an assistant message with tool calls", () => {
      const input: ChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_456",
            type: "function",
            function: {
              name: "search",
              arguments: '{"query": "test"}',
            },
          },
        ],
      };
      const result = convertFromUnifiedMessage(input);
      expect(result.role).toBe("assistant");
      expect((result as any).tool_calls).toEqual([
        {
          id: "call_456",
          type: "function",
          function: {
            name: "search",
            arguments: '{"query": "test"}',
          },
        },
      ]);
    });
  });

  describe("tool messages", () => {
    it("should convert a unified tool message", () => {
      const input: ChatMessage = {
        role: "tool",
        content: "Result data",
        toolCallId: "call_789",
      };
      const result = convertFromUnifiedMessage(input);
      expect(result).toEqual({
        role: "tool",
        content: "Result data",
        tool_call_id: "call_789",
      });
    });
  });

  describe("thinking messages", () => {
    it("should convert a thinking message to assistant message", () => {
      const input: ChatMessage = {
        role: "thinking",
        content: "Let me think about this...",
      };
      const result = convertFromUnifiedMessage(input);
      expect(result).toEqual({
        role: "assistant",
        content: "Let me think about this...",
      });
    });
  });
});

describe("createHistoryItem", () => {
  it("should create a history item with just a message", () => {
    const message: ChatMessage = {
      role: "user",
      content: "Hello",
    };
    const result = createHistoryItem(message);
    expect(result).toEqual({
      message,
      contextItems: [],
    });
  });

  it("should create a history item with context items", () => {
    const message: ChatMessage = {
      role: "user",
      content: "Hello",
    };
    const contextItems = [
      {
        id: "ctx1",
        name: "file.ts",
        content: "code here",
        description: "A file",
      },
    ];
    const result = createHistoryItem(message, contextItems);
    expect(result).toEqual({
      message,
      contextItems,
    });
  });

  it("should create a history item with tool call states", () => {
    const message: ChatMessage = {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "test", arguments: "{}" },
        },
      ],
    };
    const toolCallStates: ToolCallState[] = [
      {
        toolCallId: "call_1",
        toolCall: {
          id: "call_1",
          type: "function",
          function: { name: "test", arguments: "{}" },
        },
        status: "done",
        parsedArgs: {},
      },
    ];
    const result = createHistoryItem(message, [], toolCallStates);
    expect(result).toEqual({
      message,
      contextItems: [],
      toolCallStates,
    });
  });
});

describe("convertToUnifiedHistory", () => {
  it("should convert an array of messages to history items", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hi!" },
      { role: "assistant", content: "Hello!" },
    ];
    const result = convertToUnifiedHistory(messages);
    expect(result).toHaveLength(3);
    expect(result[0].message.role).toBe("system");
    expect(result[1].message.role).toBe("user");
    expect(result[2].message.role).toBe("assistant");
  });

  it("should handle assistant messages with tool calls", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "What is the weather?" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_weather",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"city": "NYC"}',
            },
          },
        ],
      },
    ];
    const result = convertToUnifiedHistory(messages);
    expect(result).toHaveLength(2);
    expect(result[1].toolCallStates).toBeDefined();
    expect(result[1].toolCallStates![0].toolCallId).toBe("call_weather");
    expect(result[1].toolCallStates![0].status).toBe("done");
  });

  it("should handle tool result messages by updating tool states", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "What is the weather?" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_weather",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"city": "NYC"}',
            },
          },
        ],
      },
      {
        role: "tool",
        content: "Sunny, 72F",
        tool_call_id: "call_weather",
      },
    ];
    const result = convertToUnifiedHistory(messages);
    // Tool messages don't become separate history items
    expect(result).toHaveLength(2);
    // The tool result should be added to the assistant message's tool state
    expect(result[1].toolCallStates![0].output).toBeDefined();
    expect(result[1].toolCallStates![0].output![0].content).toBe("Sunny, 72F");
  });
});

describe("convertFromUnifiedHistory", () => {
  it("should convert history items back to messages", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: { role: "system", content: "Be helpful" },
        contextItems: [],
      },
      {
        message: { role: "user", content: "Hello" },
        contextItems: [],
      },
      {
        message: { role: "assistant", content: "Hi there!" },
        contextItems: [],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: "system", content: "Be helpful" });
    expect(result[1]).toEqual({ role: "user", content: "Hello" });
    expect(result[2]).toEqual({ role: "assistant", content: "Hi there!" });
  });

  it("should expand context items in user messages", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "Check this code" },
        contextItems: [
          {
            id: "ctx1",
            name: "main.ts",
            content: "const x = 1;",
            description: "Main file",
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(1);
    expect((result[0] as any).content).toContain('<context name="main.ts">');
    expect((result[0] as any).content).toContain("const x = 1;");
    expect((result[0] as any).content).toContain("Check this code");
  });

  it("should add tool result messages for completed tool calls", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "test", arguments: "{}" },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "call_1",
            toolCall: {
              id: "call_1",
              type: "function",
              function: { name: "test", arguments: "{}" },
            },
            status: "done",
            output: [
              { content: "success", name: "test", description: "result" },
            ],
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      role: "tool",
      content: "success",
      tool_call_id: "call_1",
    });
  });

  it("should add 'Tool cancelled' for tool calls without output", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_2",
              type: "function",
              function: { name: "cancelled_tool", arguments: "{}" },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "call_2",
            toolCall: {
              id: "call_2",
              type: "function",
              function: { name: "cancelled_tool", arguments: "{}" },
            },
            status: "cancelled",
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      role: "tool",
      content: "Tool cancelled",
      tool_call_id: "call_2",
    });
  });
});

describe("convertFromUnifiedHistoryWithSystemMessage", () => {
  it("should inject system message at the beginning", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "Hello" },
        contextItems: [],
      },
    ];
    const result = convertFromUnifiedHistoryWithSystemMessage(
      historyItems,
      "You are a helpful AI.",
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: "system",
      content: "You are a helpful AI.",
    });
    expect(result[1]).toEqual({ role: "user", content: "Hello" });
  });

  it("should work with empty history", () => {
    const result = convertFromUnifiedHistoryWithSystemMessage(
      [],
      "System prompt",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "system", content: "System prompt" });
  });
});

describe("extractToolCallInfo", () => {
  it("should return hasToolCalls false when no tool calls", () => {
    const historyItem: ChatHistoryItem = {
      message: { role: "user", content: "Hello" },
      contextItems: [],
    };
    const result = extractToolCallInfo(historyItem);
    expect(result.hasToolCalls).toBe(false);
    expect(result.toolCalls).toBeUndefined();
    expect(result.toolStates).toBeUndefined();
  });

  it("should return hasToolCalls true and extract tool info", () => {
    const toolCallState: ToolCallState = {
      toolCallId: "call_123",
      toolCall: {
        id: "call_123",
        type: "function",
        function: { name: "search", arguments: '{"q":"test"}' },
      },
      status: "done",
    };
    const historyItem: ChatHistoryItem = {
      message: {
        role: "assistant",
        content: "",
        toolCalls: [toolCallState.toolCall],
      },
      contextItems: [],
      toolCallStates: [toolCallState],
    };
    const result = extractToolCallInfo(historyItem);
    expect(result.hasToolCalls).toBe(true);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].id).toBe("call_123");
    expect(result.toolStates).toHaveLength(1);
  });

  it("should return hasToolCalls false for empty toolCallStates array", () => {
    const historyItem: ChatHistoryItem = {
      message: { role: "assistant", content: "No tools" },
      contextItems: [],
      toolCallStates: [],
    };
    const result = extractToolCallInfo(historyItem);
    expect(result.hasToolCalls).toBe(false);
  });
});
