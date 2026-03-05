import { describe, expect, it } from "vitest";
import {
  convertToUnifiedMessage,
  convertFromUnifiedMessage,
  createHistoryItem,
  convertToUnifiedHistory,
  convertFromUnifiedHistory,
  convertFromUnifiedHistoryWithSystemMessage,
  extractToolCallInfo,
} from "./messageConversion";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";
import type { ChatHistoryItem, ChatMessage, ToolCallState } from "../index.js";

describe("convertToUnifiedMessage", () => {
  describe("system messages", () => {
    it("should convert a system message with string content", () => {
      const message: ChatCompletionMessageParam = {
        role: "system",
        content: "You are a helpful assistant",
      };
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "system",
        content: "You are a helpful assistant",
      });
    });

    it("should handle empty string content for system message", () => {
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
    it("should convert a user message with string content", () => {
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

    it("should convert a user message with array content containing text", () => {
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

    it("should convert a user message with array content containing image_url", () => {
      const message: ChatCompletionMessageParam = {
        role: "user",
        content: [
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
          {
            type: "imageUrl",
            imageUrl: { url: "https://example.com/image.png" },
          },
        ],
      });
    });

    it("should convert a user message with mixed content", () => {
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
    it("should convert an assistant message with string content", () => {
      const message: ChatCompletionMessageParam = {
        role: "assistant",
        content: "I can help with that!",
      };
      const result = convertToUnifiedMessage(message);
      expect(result).toEqual({
        role: "assistant",
        content: "I can help with that!",
      });
    });

    it("should convert an assistant message with null content", () => {
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

    it("should convert an assistant message with tool calls", () => {
      const message: ChatCompletionMessageParam = {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location": "NYC"}',
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
              arguments: '{"location": "NYC"}',
            },
          },
        ],
      });
    });

    it("should handle multiple tool calls", () => {
      const message: ChatCompletionMessageParam = {
        role: "assistant",
        content: "Let me check both things",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "tool1", arguments: "{}" },
          },
          {
            id: "call_2",
            type: "function",
            function: { name: "tool2", arguments: '{"x": 1}' },
          },
        ],
      };
      const result = convertToUnifiedMessage(message);
      expect(result.role).toBe("assistant");
      expect((result as any).toolCalls).toHaveLength(2);
      expect((result as any).toolCalls[0].id).toBe("call_1");
      expect((result as any).toolCalls[1].id).toBe("call_2");
    });
  });

  describe("tool messages", () => {
    it("should convert a tool result message", () => {
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
    it("should throw for unsupported message role", () => {
      const message = { role: "unknown", content: "test" } as any;
      expect(() => convertToUnifiedMessage(message)).toThrow(
        "Unsupported message role: unknown",
      );
    });
  });
});

describe("convertFromUnifiedMessage", () => {
  describe("system messages", () => {
    it("should convert a unified system message back to OpenAI format", () => {
      const message: ChatMessage = {
        role: "system",
        content: "You are a helpful assistant",
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "system",
        content: "You are a helpful assistant",
      });
    });
  });

  describe("user messages", () => {
    it("should convert a unified user message with string content", () => {
      const message: ChatMessage = {
        role: "user",
        content: "Hello!",
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "user",
        content: "Hello!",
      });
    });

    it("should convert a unified user message with array content", () => {
      const message: ChatMessage = {
        role: "user",
        content: [
          { type: "text", text: "Check this" },
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
          { type: "text", text: "Check this" },
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
      const message: ChatMessage = {
        role: "assistant",
        content: "Here is your answer",
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "assistant",
        content: "Here is your answer",
      });
    });

    it("should convert an assistant message with tool calls", () => {
      const message: ChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_456",
            type: "function",
            function: { name: "search", arguments: '{"query": "test"}' },
          },
        ],
      };
      const result = convertFromUnifiedMessage(message);
      expect(result.role).toBe("assistant");
      expect((result as any).tool_calls).toEqual([
        {
          id: "call_456",
          type: "function",
          function: { name: "search", arguments: '{"query": "test"}' },
        },
      ]);
    });

    it("should not include tool_calls if toolCalls is empty array", () => {
      const message: ChatMessage = {
        role: "assistant",
        content: "No tools",
        toolCalls: [],
      };
      const result = convertFromUnifiedMessage(message);
      expect((result as any).tool_calls).toBeUndefined();
    });
  });

  describe("tool messages", () => {
    it("should convert a unified tool message", () => {
      const message: ChatMessage = {
        role: "tool",
        content: "Tool result here",
        toolCallId: "call_789",
      };
      const result = convertFromUnifiedMessage(message);
      expect(result).toEqual({
        role: "tool",
        content: "Tool result here",
        tool_call_id: "call_789",
      });
    });
  });

  describe("thinking messages", () => {
    it("should convert thinking messages to assistant messages", () => {
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
    it("should throw for unsupported message role", () => {
      const message = { role: "unknown", content: "test" } as any;
      expect(() => convertFromUnifiedMessage(message)).toThrow(
        "Unsupported message role: unknown",
      );
    });
  });
});

describe("createHistoryItem", () => {
  it("should create a history item with just a message", () => {
    const message: ChatMessage = { role: "user", content: "Hello" };
    const result = createHistoryItem(message);
    expect(result).toEqual({
      message,
      contextItems: [],
    });
  });

  it("should create a history item with context items", () => {
    const message: ChatMessage = { role: "user", content: "Hello" };
    const contextItems = [
      { itemId: "1", name: "file.ts", content: "code", description: "test" },
    ];
    const result = createHistoryItem(message, contextItems);
    expect(result).toEqual({
      message,
      contextItems,
    });
  });

  it("should create a history item with tool call states", () => {
    const message: ChatMessage = { role: "assistant", content: "" };
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

  it("should not include toolCallStates if not provided", () => {
    const message: ChatMessage = { role: "user", content: "Hello" };
    const result = createHistoryItem(message);
    expect(result.toolCallStates).toBeUndefined();
  });
});

describe("convertToUnifiedHistory", () => {
  it("should convert an empty array", () => {
    const result = convertToUnifiedHistory([]);
    expect(result).toEqual([]);
  });

  it("should convert simple messages", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hi" },
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
      { role: "user", content: "What's the weather?" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_weather",
            type: "function",
            function: { name: "get_weather", arguments: '{"city": "NYC"}' },
          },
        ],
      },
    ];
    const result = convertToUnifiedHistory(messages);
    expect(result).toHaveLength(2);
    expect(result[1].toolCallStates).toBeDefined();
    expect(result[1].toolCallStates![0].toolCallId).toBe("call_weather");
    expect(result[1].toolCallStates![0].status).toBe("done");
    expect(result[1].toolCallStates![0].parsedArgs).toEqual({ city: "NYC" });
  });

  it("should handle tool results and update tool call states", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "What's the weather?" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_weather",
            type: "function",
            function: { name: "get_weather", arguments: '{"city": "NYC"}' },
          },
        ],
      },
      { role: "tool", content: '{"temp": 72}', tool_call_id: "call_weather" },
    ];
    const result = convertToUnifiedHistory(messages);
    // Tool messages should not be added as separate history items
    expect(result).toHaveLength(2);
    // Tool result should update the previous assistant message's tool call state
    const toolState = result[1].toolCallStates![0];
    expect(toolState.output).toBeDefined();
    expect(toolState.output![0].content).toBe('{"temp": 72}');
  });

  it("should handle invalid JSON in tool arguments", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "test", arguments: "not valid json" },
          },
        ],
      },
    ];
    const result = convertToUnifiedHistory(messages);
    expect(result[0].toolCallStates![0].parsedArgs).toBe("not valid json");
  });
});

describe("convertFromUnifiedHistory", () => {
  it("should convert an empty array", () => {
    const result = convertFromUnifiedHistory([]);
    expect(result).toEqual([]);
  });

  it("should convert simple history items", () => {
    const historyItems: ChatHistoryItem[] = [
      { message: { role: "user", content: "Hi" }, contextItems: [] },
      { message: { role: "assistant", content: "Hello!" }, contextItems: [] },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: "Hi" });
    expect(result[1]).toEqual({ role: "assistant", content: "Hello!" });
  });

  it("should expand context items into user message content", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "Explain this code" },
        contextItems: [
          {
            itemId: "1",
            name: "test.ts",
            content: "const x = 1;",
            description: "A test file",
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('<context name="test.ts">');
    expect(result[0].content).toContain("const x = 1;");
    expect(result[0].content).toContain("Explain this code");
  });

  it("should add tool result messages for completed tool calls", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: { role: "assistant", content: "" },
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
            output: [{ content: "result data", name: "Test", description: "" }],
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      role: "tool",
      content: "result data",
      tool_call_id: "call_1",
    });
  });

  it("should add 'Tool cancelled' for tool calls without output", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: { role: "assistant", content: "" },
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
            // No output
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      role: "tool",
      content: "Tool cancelled",
      tool_call_id: "call_1",
    });
  });

  it("should join multiple outputs for a tool call", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: { role: "assistant", content: "" },
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
              { content: "line 1", name: "Output1", description: "" },
              { content: "line 2", name: "Output2", description: "" },
            ],
          },
        ],
      },
    ];
    const result = convertFromUnifiedHistory(historyItems);
    expect(result[1].content).toBe("line 1\nline 2");
  });
});

describe("convertFromUnifiedHistoryWithSystemMessage", () => {
  it("should inject system message at the beginning", () => {
    const historyItems: ChatHistoryItem[] = [
      { message: { role: "user", content: "Hi" }, contextItems: [] },
    ];
    const result = convertFromUnifiedHistoryWithSystemMessage(
      historyItems,
      "You are a helpful assistant",
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: "system",
      content: "You are a helpful assistant",
    });
    expect(result[1]).toEqual({ role: "user", content: "Hi" });
  });

  it("should work with empty history", () => {
    const result = convertFromUnifiedHistoryWithSystemMessage(
      [],
      "System message",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "system",
      content: "System message",
    });
  });
});

describe("extractToolCallInfo", () => {
  it("should return hasToolCalls false when no tool call states", () => {
    const historyItem: ChatHistoryItem = {
      message: { role: "user", content: "Hi" },
      contextItems: [],
    };
    const result = extractToolCallInfo(historyItem);
    expect(result.hasToolCalls).toBe(false);
    expect(result.toolCalls).toBeUndefined();
    expect(result.toolStates).toBeUndefined();
  });

  it("should return hasToolCalls false when tool call states is empty", () => {
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
      function: { name: "test_tool", arguments: '{"x": 1}' },
    };
    const historyItem: ChatHistoryItem = {
      message: { role: "assistant", content: "" },
      contextItems: [],
      toolCallStates: [
        {
          toolCallId: "call_1",
          toolCall,
          status: "done",
        },
      ],
    };
    const result = extractToolCallInfo(historyItem);
    expect(result.hasToolCalls).toBe(true);
    expect(result.toolCalls).toEqual([toolCall]);
    expect(result.toolStates).toEqual(historyItem.toolCallStates);
  });

  it("should handle multiple tool calls", () => {
    const toolCall1 = {
      id: "call_1",
      type: "function" as const,
      function: { name: "tool1", arguments: "{}" },
    };
    const toolCall2 = {
      id: "call_2",
      type: "function" as const,
      function: { name: "tool2", arguments: "{}" },
    };
    const historyItem: ChatHistoryItem = {
      message: { role: "assistant", content: "" },
      contextItems: [],
      toolCallStates: [
        { toolCallId: "call_1", toolCall: toolCall1, status: "done" },
        { toolCallId: "call_2", toolCall: toolCall2, status: "generating" },
      ],
    };
    const result = extractToolCallInfo(historyItem);
    expect(result.hasToolCalls).toBe(true);
    expect(result.toolCalls).toHaveLength(2);
  });
});
