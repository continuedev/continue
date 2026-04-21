import { describe, expect, it } from "vitest";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";
import type { ChatHistoryItem, ChatMessage, ToolCallState } from "../index.js";
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
    it("should convert system message with string content", () => {
      const message: ChatCompletionMessageParam = {
        role: "system",
        content: "You are a helpful assistant.",
      };
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });
    });

    it("should handle system message with empty content", () => {
      const message: ChatCompletionMessageParam = {
        role: "system",
        content: "",
      };
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "system",
        content: "",
      });
    });
  });

  describe("user messages", () => {
    it("should convert user message with string content", () => {
      const message: ChatCompletionMessageParam = {
        role: "user",
        content: "Hello, how are you?",
      };
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "user",
        content: "Hello, how are you?",
      });
    });

    it("should convert user message with array content (text)", () => {
      const message: ChatCompletionMessageParam = {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      };
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      });
    });

    it("should convert user message with array content (image_url)", () => {
      const message: ChatCompletionMessageParam = {
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/image.png" },
          },
        ],
      };
      const result = convertToUnifiedMessage(message);
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
    it("should convert assistant message with string content", () => {
      const message: ChatCompletionMessageParam = {
        role: "assistant",
        content: "I am doing well, thank you!",
      };
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "assistant",
        content: "I am doing well, thank you!",
      });
    });

    it("should convert assistant message with null content", () => {
      const message: ChatCompletionMessageParam = {
        role: "assistant",
        content: null,
      };
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "assistant",
        content: "",
      });
    });

    it("should convert assistant message with tool calls", () => {
      const message: ChatCompletionMessageParam = {
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
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location": "New York"}',
            },
          },
        ],
      });
    });

    it("should convert assistant message with extra_content in tool calls", () => {
      const message: ChatCompletionMessageParam = {
        role: "assistant",
        content: "Calling a tool...",
        tool_calls: [
          {
            id: "call_456",
            type: "function",
            function: {
              name: "search",
              arguments: '{"query": "test"}',
            },
            extra_content: { key: "value" },
          },
        ],
      } as any;
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "assistant",
        content: "Calling a tool...",
        toolCalls: [
          {
            id: "call_456",
            type: "function",
            function: {
              name: "search",
              arguments: '{"query": "test"}',
            },
            extra_content: { key: "value" },
          },
        ],
      });
    });
  });

  describe("tool messages", () => {
    it("should convert tool message", () => {
      const message: ChatCompletionMessageParam = {
        role: "tool",
        content: '{"temperature": 72}',
        tool_call_id: "call_123",
      };
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "tool",
        content: '{"temperature": 72}',
        toolCallId: "call_123",
      });
    });
  });

  describe("error handling", () => {
    it("should throw error for unsupported message role", () => {
      const message = { role: "unknown", content: "test" } as any;
      expect(() => convertToUnifiedMessage(message)).toThrow(
        "Unsupported message role: unknown",
      );
    });
  });
});

describe("convertFromUnifiedMessage", () => {
  describe("system messages", () => {
    it("should convert system message", () => {
      const message: ChatMessage = {
        role: "system",
        content: "You are a helpful assistant.",
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });
    });
  });

  describe("user messages", () => {
    it("should convert user message with string content", () => {
      const message: ChatMessage = {
        role: "user",
        content: "Hello",
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "user",
        content: "Hello",
      });
    });

    it("should convert user message with array content", () => {
      const message: ChatMessage = {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          {
            type: "imageUrl",
            imageUrl: { url: "https://example.com/img.png" },
          },
        ],
      };
      const result = convertFromUnifiedMessage(message);
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
    it("should convert assistant message with string content", () => {
      const message: ChatMessage = {
        role: "assistant",
        content: "I can help with that.",
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "assistant",
        content: "I can help with that.",
      });
    });

    it("should convert assistant message with tool calls", () => {
      const message: ChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_789",
            type: "function",
            function: {
              name: "calculate",
              arguments: '{"a": 1, "b": 2}',
            },
          },
        ],
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "call_789",
            type: "function",
            function: {
              name: "calculate",
              arguments: '{"a": 1, "b": 2}',
            },
          },
        ],
      });
    });

    it("should convert assistant message with tool calls including extra_content", () => {
      const message: ChatMessage = {
        role: "assistant",
        content: "Calculating...",
        toolCalls: [
          {
            id: "call_abc",
            type: "function",
            function: {
              name: "math",
              arguments: '{"op": "add"}',
            },
            extra_content: { some: "data" },
          },
        ],
      };
      const result = convertFromUnifiedMessage(message);
      expect((result as any).tool_calls[0].extra_content).toEqual({
        some: "data",
      });
    });
  });

  describe("tool messages", () => {
    it("should convert tool message", () => {
      const message: ChatMessage = {
        role: "tool",
        content: "Result: 42",
        toolCallId: "call_123",
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "tool",
        content: "Result: 42",
        tool_call_id: "call_123",
      });
    });
  });

  describe("thinking messages", () => {
    it("should convert thinking message to assistant message", () => {
      const message: ChatMessage = {
        role: "thinking",
        content: "Let me think about this...",
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "assistant",
        content: "Let me think about this...",
      });
    });
  });

  describe("error handling", () => {
    it("should throw error for unsupported message role", () => {
      const message = { role: "unknown", content: "test" } as any;
      expect(() => convertFromUnifiedMessage(message)).toThrow(
        "Unsupported message role: unknown",
      );
    });
  });
});

describe("createHistoryItem", () => {
  it("should create history item with message only", () => {
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

  it("should create history item with context items", () => {
    const message: ChatMessage = {
      role: "user",
      content: "Help me with this code",
    };
    const contextItems = [
      {
        id: { providerTitle: "file", itemId: "1" },
        name: "test.ts",
        content: "const x = 1;",
        description: "Test file",
      },
    ];
    const result = createHistoryItem(message, contextItems);
    expect(result).toEqual({
      message,
      contextItems,
    });
  });

  it("should create history item with tool call states", () => {
    const message: ChatMessage = {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "call_123",
          type: "function",
          function: { name: "test", arguments: "{}" },
        },
      ],
    };
    const toolCallStates: ToolCallState[] = [
      {
        toolCallId: "call_123",
        toolCall: {
          id: "call_123",
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
  it("should convert empty array", () => {
    const result = convertToUnifiedHistory([]);
    expect(result).toEqual([]);
  });

  it("should convert simple conversation", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ];
    const result = convertToUnifiedHistory(messages);
    expect(result).toHaveLength(3);
    expect(result[0].message.role).toBe("system");
    expect(result[1].message.role).toBe("user");
    expect(result[2].message.role).toBe("assistant");
  });

  it("should handle tool calls and results", () => {
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
              arguments: '{"location": "NYC"}',
            },
          },
        ],
      },
      {
        role: "tool",
        content: '{"temp": 72}',
        tool_call_id: "call_weather",
      },
    ];
    const result = convertToUnifiedHistory(messages);
    // Tool messages are not added as separate history items
    expect(result).toHaveLength(2);
    expect(result[0].message.role).toBe("user");
    expect(result[1].message.role).toBe("assistant");
    expect(result[1].toolCallStates).toHaveLength(1);
    expect(result[1].toolCallStates![0].toolCallId).toBe("call_weather");
    expect(result[1].toolCallStates![0].status).toBe("done");
  });

  it("should parse tool call arguments", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "add",
              arguments: '{"a": 1, "b": 2}',
            },
          },
        ],
      },
    ];
    const result = convertToUnifiedHistory(messages);
    expect(result[0].toolCallStates![0].parsedArgs).toEqual({ a: 1, b: 2 });
  });

  it("should handle invalid JSON in tool call arguments", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "test",
              arguments: "not valid json",
            },
          },
        ],
      },
    ];
    const result = convertToUnifiedHistory(messages);
    expect(result[0].toolCallStates![0].parsedArgs).toBe("not valid json");
  });
});

describe("convertFromUnifiedHistory", () => {
  it("should convert empty array", () => {
    const result = convertFromUnifiedHistory([]);
    expect(result).toEqual([]);
  });

  it("should convert simple history", () => {
    const historyItems: ChatHistoryItem[] = [
      { message: { role: "user", content: "Hi" }, contextItems: [] },
      { message: { role: "assistant", content: "Hello!" }, contextItems: [] },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: "Hi" });
    expect(result[1]).toEqual({ role: "assistant", content: "Hello!" });
  });

  it("should expand context items in user messages", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "Help me" },
        contextItems: [
          {
            id: { providerTitle: "file", itemId: "1" },
            name: "code.ts",
            content: "const x = 1;",
            description: "File",
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result[0].content).toContain('<context name="code.ts">');
    expect(result[0].content).toContain("const x = 1;");
    expect(result[0].content).toContain("Help me");
  });

  it("should add tool result messages for completed tool calls", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_123",
              type: "function",
              function: { name: "test", arguments: "{}" },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "call_123",
            toolCall: {
              id: "call_123",
              type: "function",
              function: { name: "test", arguments: "{}" },
            },
            status: "done",
            output: [{ content: "Result", name: "Test", description: "desc" }],
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      role: "tool",
      content: "Result",
      tool_call_id: "call_123",
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
              id: "call_456",
              type: "function",
              function: { name: "pending", arguments: "{}" },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "call_456",
            toolCall: {
              id: "call_456",
              type: "function",
              function: { name: "pending", arguments: "{}" },
            },
            status: "generated",
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      role: "tool",
      content: "Tool cancelled",
      tool_call_id: "call_456",
    });
  });

  it("should join multiple tool outputs", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_multi",
              type: "function",
              function: { name: "multi", arguments: "{}" },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "call_multi",
            toolCall: {
              id: "call_multi",
              type: "function",
              function: { name: "multi", arguments: "{}" },
            },
            status: "done",
            output: [
              { content: "Output 1", name: "First", description: "" },
              { content: "Output 2", name: "Second", description: "" },
            ],
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result[1].content).toBe("Output 1\nOutput 2");
  });
});

describe("convertFromUnifiedHistoryWithSystemMessage", () => {
  it("should inject system message at the beginning", () => {
    const historyItems: ChatHistoryItem[] = [
      { message: { role: "user", content: "Hi" }, contextItems: [] },
    ];
    const systemMessage = "You are a helpful assistant.";
    const result = convertFromUnifiedHistoryWithSystemMessage(
      historyItems,
      systemMessage,
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: "system",
      content: "You are a helpful assistant.",
    });
    expect(result[1]).toEqual({ role: "user", content: "Hi" });
  });

  it("should handle empty history", () => {
    const result = convertFromUnifiedHistoryWithSystemMessage(
      [],
      "System prompt",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "system",
      content: "System prompt",
    });
  });
});

describe("extractToolCallInfo", () => {
  it("should return false when no tool call states", () => {
    const historyItem: ChatHistoryItem = {
      message: { role: "user", content: "Hi" },
      contextItems: [],
    };
    const result = extractToolCallInfo(historyItem);
    expect(result.hasToolCalls).toBe(false);
    expect(result.toolCalls).toBeUndefined();
    expect(result.toolStates).toBeUndefined();
  });

  it("should return false for empty tool call states", () => {
    const historyItem: ChatHistoryItem = {
      message: { role: "assistant", content: "" },
      contextItems: [],
      toolCallStates: [],
    };
    const result = extractToolCallInfo(historyItem);
    expect(result.hasToolCalls).toBe(false);
  });

  it("should extract tool call info when present", () => {
    const toolCall = {
      id: "call_1",
      type: "function" as const,
      function: { name: "test", arguments: "{}" },
    };
    const toolState: ToolCallState = {
      toolCallId: "call_1",
      toolCall,
      status: "done",
    };
    const historyItem: ChatHistoryItem = {
      message: {
        role: "assistant",
        content: "",
        toolCalls: [toolCall],
      },
      contextItems: [],
      toolCallStates: [toolState],
    };
    const result = extractToolCallInfo(historyItem);
    expect(result.hasToolCalls).toBe(true);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]).toEqual(toolCall);
    expect(result.toolStates).toHaveLength(1);
    expect(result.toolStates![0]).toEqual(toolState);
  });
});

describe("round-trip conversions", () => {
  it("should preserve system message through round-trip", () => {
    const original: ChatCompletionMessageParam = {
      role: "system",
      content: "System instructions",
    };
    const unified = convertToUnifiedMessage(original);
    const backConverted = convertFromUnifiedMessage(unified);
    expect(backConverted).toEqual(original);
  });

  it("should preserve user message through round-trip", () => {
    const original: ChatCompletionMessageParam = {
      role: "user",
      content: "User message",
    };
    const unified = convertToUnifiedMessage(original);
    const backConverted = convertFromUnifiedMessage(unified);
    expect(backConverted).toEqual(original);
  });

  it("should preserve assistant message through round-trip", () => {
    const original: ChatCompletionMessageParam = {
      role: "assistant",
      content: "Assistant response",
    };
    const unified = convertToUnifiedMessage(original);
    const backConverted = convertFromUnifiedMessage(unified);
    expect(backConverted).toEqual(original);
  });

  it("should preserve tool message through round-trip", () => {
    const original: ChatCompletionMessageParam = {
      role: "tool",
      content: "Tool result",
      tool_call_id: "call_abc",
    };
    const unified = convertToUnifiedMessage(original);
    const backConverted = convertFromUnifiedMessage(unified);
    expect(backConverted).toEqual(original);
  });

  it("should preserve multipart content through round-trip", () => {
    const original: ChatCompletionMessageParam = {
      role: "user",
      content: [
        { type: "text", text: "Describe this:" },
        {
          type: "image_url",
          image_url: { url: "https://example.com/img.png" },
        },
      ],
    };
    const unified = convertToUnifiedMessage(original);
    const backConverted = convertFromUnifiedMessage(unified);
    expect(backConverted).toEqual(original);
  });
});
