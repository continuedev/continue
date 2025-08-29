import { ToolCallState, ToolStatus } from "core";
import { ChatHistoryItemWithMessageId } from "../slices/sessionSlice";
import {
  findAllCurToolCalls,
  findAllCurToolCallsByStatus,
  findToolCallById,
  hasCurrentToolCalls,
} from "./index";

// Helper function to create a tool call state
function createToolCallState(
  toolCallId: string,
  functionName: string,
  status: ToolStatus = "generated",
): ToolCallState {
  return {
    toolCallId,
    toolCall: {
      id: toolCallId,
      type: "function",
      function: {
        name: functionName,
        arguments: "{}",
      },
    },
    status,
    parsedArgs: {},
  };
}

// Helper function to create a chat history item
function createChatHistoryItem(
  role: "user" | "assistant" | "tool" | "thinking",
  content: string,
  options?: {
    toolCallStates?: ToolCallState[];
    toolCallId?: string;
  },
): ChatHistoryItemWithMessageId {
  let message: any = {
    id: "test-id",
    role,
    content,
  };

  if (role === "tool" && options?.toolCallId) {
    message.toolCallId = options.toolCallId;
  }

  const historyItem: ChatHistoryItemWithMessageId = {
    message,
    contextItems: [],
  };

  if (options?.toolCallStates) {
    historyItem.toolCallStates = options.toolCallStates;
  }

  return historyItem;
}

describe("hasCurrentToolCalls", () => {
  it("should return false for empty chat history", () => {
    const result = hasCurrentToolCalls([]);
    expect(result).toBe(false);
  });

  it("should return false when last message has no tool calls", () => {
    const chatHistory = [
      createChatHistoryItem("user", "Hello"),
      createChatHistoryItem("assistant", "Hi there!"),
    ];
    const result = hasCurrentToolCalls(chatHistory);
    expect(result).toBe(false);
  });

  it("should return true when last message has tool calls", () => {
    const toolCallStates = [
      createToolCallState("tool-1", "get_weather"),
      createToolCallState("tool-2", "get_time"),
    ];
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("assistant", "I'll check the weather for you", {
        toolCallStates,
      }),
    ];
    const result = hasCurrentToolCalls(chatHistory);
    expect(result).toBe(true);
  });

  it("should return false when toolCallStates is empty array", () => {
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll help you", {
        toolCallStates: [],
      }),
    ];
    const result = hasCurrentToolCalls(chatHistory);
    expect(result).toBe(false);
  });
});

describe("findCurrentToolCallsByStatus", () => {
  it("should return empty array for empty chat history", () => {
    const result = findAllCurToolCallsByStatus([], "generated");
    expect(result).toEqual([]);
  });

  it("should return empty array when no tool calls match status", () => {
    const toolCallStates = [
      createToolCallState("tool-1", "get_weather", "calling"),
      createToolCallState("tool-2", "get_time", "done"),
    ];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates,
      }),
    ];
    const result = findAllCurToolCallsByStatus(chatHistory, "generated");
    expect(result).toEqual([]);
  });

  it("should return tool calls matching the specified status", () => {
    const generatedToolCall = createToolCallState(
      "tool-1",
      "get_weather",
      "generated",
    );
    const callingToolCall = createToolCallState(
      "tool-2",
      "get_time",
      "calling",
    );
    const toolCallStates = [generatedToolCall, callingToolCall];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates,
      }),
    ];
    const result = findAllCurToolCallsByStatus(chatHistory, "generated");
    expect(result).toEqual([generatedToolCall]);
  });

  it("should work with multiple tool calls", () => {
    const toolCallStates = [
      createToolCallState("tool-1", "get_weather", "generated"),
      createToolCallState("tool-2", "get_time", "generated"),
      createToolCallState("tool-3", "get_location", "calling"),
    ];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll help you", {
        toolCallStates,
      }),
    ];
    const result = findAllCurToolCallsByStatus(chatHistory, "generated");
    expect(result).toHaveLength(2);
    expect(result[0].toolCallId).toBe("tool-1");
    expect(result[1].toolCallId).toBe("tool-2");
  });
});

describe("findCurrentToolCalls", () => {
  it("should return empty array for empty chat history", () => {
    const result = findAllCurToolCalls([]);
    expect(result).toEqual([]);
  });

  it("should return empty array when last message has no tool calls", () => {
    const chatHistory = [
      createChatHistoryItem("user", "Hello"),
      createChatHistoryItem("assistant", "Hi there!"),
    ];
    const result = findAllCurToolCalls(chatHistory);
    expect(result).toEqual([]);
  });

  it("should return multiple tool call states", () => {
    const toolCallStates = [
      createToolCallState("tool-1", "get_weather"),
      createToolCallState("tool-2", "get_time"),
    ];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates,
      }),
    ];
    const result = findAllCurToolCalls(chatHistory);
    expect(result).toEqual(toolCallStates);
  });

  it("should return empty array if user message interrupts assistant sequence", () => {
    const toolCallStates = [createToolCallState("tool-1", "get_weather")];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates,
      }),
      createChatHistoryItem("user", "Actually, nevermind"),
      createChatHistoryItem("assistant", "Ok, no problem"),
    ];
    const result = findAllCurToolCalls(chatHistory);
    expect(result).toEqual([]);
  });

  it("should handle thinking messages as part of assistant sequence", () => {
    const toolCallStates = [createToolCallState("tool-1", "get_weather")];
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("thinking", "I need to get weather data"),
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates,
      }),
    ];
    const result = findAllCurToolCalls(chatHistory);
    expect(result).toEqual(toolCallStates);
  });

  it("should find tool calls from last assistant message in sequence", () => {
    const firstToolCallStates = [createToolCallState("tool-1", "get_weather")];
    const secondToolCallStates = [createToolCallState("tool-2", "get_time")];
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("assistant", "Let me check", {
        toolCallStates: firstToolCallStates,
      }),
      createChatHistoryItem("thinking", "Now I should also get the time"),
      createChatHistoryItem("assistant", "And the time too", {
        toolCallStates: secondToolCallStates,
      }),
    ];
    const result = findAllCurToolCalls(chatHistory);
    expect(result).toEqual(secondToolCallStates);
  });

  it("should ignore tool calls from earlier conversation turns", () => {
    const oldToolCallStates = [createToolCallState("old-tool", "old_function")];
    const newToolCallStates = [createToolCallState("new-tool", "new_function")];
    const chatHistory = [
      createChatHistoryItem("user", "First question"),
      createChatHistoryItem("assistant", "First response", {
        toolCallStates: oldToolCallStates,
      }),
      createChatHistoryItem("user", "Second question"),
      createChatHistoryItem("assistant", "Second response", {
        toolCallStates: newToolCallStates,
      }),
    ];
    const result = findAllCurToolCalls(chatHistory);
    expect(result).toEqual(newToolCallStates);
  });

  it("should handle tool message followed by assistant message", () => {
    const toolCallStates = [createToolCallState("tool-1", "get_weather")];
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates,
      }),
      createChatHistoryItem("tool", "Weather data: sunny", {
        toolCallId: "tool-1",
      }),
      createChatHistoryItem("assistant", "It's sunny today!"),
    ];
    const result = findAllCurToolCalls(chatHistory);
    expect(result).toEqual([]);
  });
});

describe("findToolCall", () => {
  it("should return undefined for empty chat history", () => {
    const result = findToolCallById([], "non-existent-id");
    expect(result).toBeUndefined();
  });

  it("should return undefined when tool call ID is not found", () => {
    const toolCallStates = [createToolCallState("tool-1", "get_weather")];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates,
      }),
    ];
    const result = findToolCallById(chatHistory, "non-existent-id");
    expect(result).toBeUndefined();
  });

  it("should find tool call in toolCallStates array", () => {
    const toolCallState = createToolCallState("tool-1", "get_weather");
    const toolCallStates = [toolCallState];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates,
      }),
    ];
    const result = findToolCallById(chatHistory, "tool-1");
    expect(result).toBe(toolCallState);
  });

  it("should find tool call in multiple tool calls", () => {
    const toolCallState1 = createToolCallState("tool-1", "get_weather");
    const toolCallState2 = createToolCallState("tool-2", "get_time");
    const toolCallStates = [toolCallState1, toolCallState2];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll help you", {
        toolCallStates,
      }),
    ];

    expect(findToolCallById(chatHistory, "tool-1")).toBe(toolCallState1);
    expect(findToolCallById(chatHistory, "tool-2")).toBe(toolCallState2);
  });

  it("should search across multiple messages", () => {
    const toolCallStates1 = [createToolCallState("tool-1", "get_weather")];
    const toolCallStates2 = [
      createToolCallState("tool-2", "get_time"),
      createToolCallState("tool-3", "get_location"),
    ];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates: toolCallStates1,
      }),
      createChatHistoryItem("user", "Also get the time"),
      createChatHistoryItem("assistant", "I'll get the time and location", {
        toolCallStates: toolCallStates2,
      }),
    ];

    expect(findToolCallById(chatHistory, "tool-1")).toBe(toolCallStates1[0]);
    expect(findToolCallById(chatHistory, "tool-2")).toBe(toolCallStates2[0]);
    expect(findToolCallById(chatHistory, "tool-3")).toBe(toolCallStates2[1]);
  });
});

describe("Edge cases and integration", () => {
  it("should handle messages with mixed content and tool calls", () => {
    const toolCallStates = [
      createToolCallState("multi-1", "get_weather"),
      createToolCallState("multi-2", "get_time"),
    ];
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather and time?"),
      createChatHistoryItem("assistant", "I'll get both for you", {
        toolCallStates,
      }),
    ];

    // hasCurrentToolCalls should return true
    expect(hasCurrentToolCalls(chatHistory)).toBe(true);

    // findCurrentToolCalls should return all tool calls
    expect(findAllCurToolCalls(chatHistory)).toEqual(toolCallStates);

    // findToolCall should find all tool calls
    expect(findToolCallById(chatHistory, "multi-1")).toBe(toolCallStates[0]);
    expect(findToolCallById(chatHistory, "multi-2")).toBe(toolCallStates[1]);
  });

  it("should work correctly when only some messages have tool calls", () => {
    const toolCallStates = [createToolCallState("tool-1", "get_weather")];
    const chatHistory = [
      createChatHistoryItem("user", "Hello"),
      createChatHistoryItem("assistant", "Hi there!"),
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallStates,
      }),
    ];

    expect(hasCurrentToolCalls(chatHistory)).toBe(true);
    expect(findAllCurToolCalls(chatHistory)).toEqual(toolCallStates);
    expect(findToolCallById(chatHistory, "tool-1")).toBe(toolCallStates[0]);
  });
});
