import { ToolCallState, ToolStatus } from "core";
import { ChatHistoryItemWithMessageId } from "../slices/sessionSlice";
import { findCurrentToolCalls, findToolCall, hasCurrentToolCalls, findCurrentToolCallsByStatus } from "./index";

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
  role: "user" | "assistant",
  content: string,
  options?: {
    toolCallState?: ToolCallState;
    toolCallStates?: ToolCallState[];
  },
): ChatHistoryItemWithMessageId;
function createChatHistoryItem(
  role: "tool",
  content: string,
  options?: {
    toolCallState?: ToolCallState;
    toolCallStates?: ToolCallState[];
    toolCallId?: string;
  },
): ChatHistoryItemWithMessageId;
function createChatHistoryItem(
  role: "user" | "assistant" | "tool",
  content: string,
  options?: {
    toolCallState?: ToolCallState;
    toolCallStates?: ToolCallState[];
    toolCallId?: string;
  },
): ChatHistoryItemWithMessageId {
  const baseMessage = {
    id: `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
  };

  const message = role === "tool" 
    ? { ...baseMessage, toolCallId: options?.toolCallId || "default-tool-id" }
    : baseMessage;

  return {
    message: message as any,
    contextItems: [],
    toolCallState: options?.toolCallState,
    toolCallStates: options?.toolCallStates,
  };
}

describe("hasCurrentToolCalls", () => {
  it("should return false for empty chat history", () => {
    const result = hasCurrentToolCalls([]);
    expect(result).toBe(false);
  });

  it("should return false when last message has no tool calls", () => {
    const chatHistory = [
      createChatHistoryItem("user", "Hello"),
      createChatHistoryItem("assistant", "Hi there"),
    ];
    const result = hasCurrentToolCalls(chatHistory);
    expect(result).toBe(false);
  });

  it("should return true when last message has single tool call", () => {
    const toolCallState = createToolCallState("tool-1", "get_weather");
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallState,
      }),
    ];
    const result = hasCurrentToolCalls(chatHistory);
    expect(result).toBe(true);
  });

  it("should return true when last message has multiple tool calls", () => {
    const toolCallStates = [
      createToolCallState("tool-1", "get_weather"),
      createToolCallState("tool-2", "get_time"),
    ];
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather and time?"),
      createChatHistoryItem("assistant", "I'll check both", {
        toolCallStates,
      }),
    ];
    const result = hasCurrentToolCalls(chatHistory);
    expect(result).toBe(true);
  });
});

describe("findCurrentToolCallsByStatus", () => {
  it("should return empty array for empty chat history", () => {
    const result = findCurrentToolCallsByStatus([], "generated");
    expect(result).toEqual([]);
  });

  it("should return empty array when no tool calls match status", () => {
    const toolCallStates = [
      createToolCallState("tool-1", "get_weather", "calling"),
      createToolCallState("tool-2", "get_time", "done"),
    ];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check both", {
        toolCallStates,
      }),
    ];
    const result = findCurrentToolCallsByStatus(chatHistory, "generated");
    expect(result).toEqual([]);
  });

  it("should return tool calls with matching status", () => {
    const generatedTool1 = createToolCallState("tool-1", "get_weather", "generated");
    const callingTool = createToolCallState("tool-2", "get_time", "calling");
    const generatedTool2 = createToolCallState("tool-3", "get_location", "generated");
    const toolCallStates = [generatedTool1, callingTool, generatedTool2];
    
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check all three", {
        toolCallStates,
      }),
    ];
    
    const result = findCurrentToolCallsByStatus(chatHistory, "generated");
    expect(result).toEqual([generatedTool1, generatedTool2]);
  });

  it("should work with single tool call state", () => {
    const toolCallState = createToolCallState("tool-1", "get_weather", "generated");
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallState,
      }),
    ];
    const result = findCurrentToolCallsByStatus(chatHistory, "generated");
    expect(result).toEqual([toolCallState]);
  });
});

describe("findCurrentToolCalls", () => {
  it("should return empty array for empty chat history", () => {
    const result = findCurrentToolCalls([]);
    expect(result).toEqual([]);
  });

  it("should return empty array when last message has no tool calls", () => {
    const chatHistory = [
      createChatHistoryItem("user", "Hello"),
      createChatHistoryItem("assistant", "Hi there"),
    ];
    const result = findCurrentToolCalls(chatHistory);
    expect(result).toEqual([]);
  });

  it("should return single tool call state as array", () => {
    const toolCallState = createToolCallState("tool-1", "get_weather");
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallState,
      }),
    ];
    const result = findCurrentToolCalls(chatHistory);
    expect(result).toEqual([toolCallState]);
  });

  it("should return all tool calls from multiple tool calls", () => {
    const toolCallState1 = createToolCallState("tool-1", "get_weather");
    const toolCallState2 = createToolCallState("tool-2", "get_time");
    const toolCallState3 = createToolCallState("tool-3", "get_location");
    const toolCallStates = [toolCallState1, toolCallState2, toolCallState3];
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather, time, and location?"),
      createChatHistoryItem("assistant", "I'll check all three", {
        toolCallStates,
      }),
    ];
    const result = findCurrentToolCalls(chatHistory);
    expect(result).toEqual(toolCallStates);
  });

  it("should prioritize single tool call state over multiple tool calls", () => {
    const singleToolCallState = createToolCallState("single-tool", "get_weather");
    const multipleToolCallStates = [
      createToolCallState("multi-tool-1", "get_time"),
      createToolCallState("multi-tool-2", "get_location"),
    ];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallState: singleToolCallState,
        toolCallStates: multipleToolCallStates,
      }),
    ];
    const result = findCurrentToolCalls(chatHistory);
    expect(result).toEqual([singleToolCallState]);
  });
});

describe("findToolCall", () => {
  it("should return undefined for empty chat history", () => {
    const result = findToolCall([], "non-existent-id");
    expect(result).toBeUndefined();
  });

  it("should return undefined when tool call ID is not found", () => {
    const toolCallState = createToolCallState("tool-1", "get_weather");
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallState,
      }),
    ];
    const result = findToolCall(chatHistory, "non-existent-id");
    expect(result).toBeUndefined();
  });

  it("should find tool call in single tool call state", () => {
    const toolCallState = createToolCallState("tool-1", "get_weather");
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallState,
      }),
      createChatHistoryItem("tool", "Weather data", { toolCallId: "tool-1" }),
    ];
    const result = findToolCall(chatHistory, "tool-1");
    expect(result).toBe(toolCallState);
  });

  it("should find tool call in multiple tool call states", () => {
    const toolCallState1 = createToolCallState("tool-1", "get_weather");
    const toolCallState2 = createToolCallState("tool-2", "get_time");
    const toolCallState3 = createToolCallState("tool-3", "get_location");
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather, time, and location?"),
      createChatHistoryItem("assistant", "I'll check all three", {
        toolCallStates: [toolCallState1, toolCallState2, toolCallState3],
      }),
    ];
    const result = findToolCall(chatHistory, "tool-2");
    expect(result).toBe(toolCallState2);
  });

  it("should prioritize single tool call state over multiple tool calls", () => {
    const singleToolCallState = createToolCallState("duplicate-id", "get_weather");
    const multipleToolCallStates = [
      createToolCallState("duplicate-id", "get_time"), // Same ID, different function
      createToolCallState("tool-2", "get_location"),
    ];
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallState: singleToolCallState,
        toolCallStates: multipleToolCallStates,
      }),
    ];
    const result = findToolCall(chatHistory, "duplicate-id");
    expect(result).toBe(singleToolCallState);
    expect(result?.toolCall.function.name).toBe("get_weather");
  });

  it("should search across multiple messages", () => {
    const toolCallState1 = createToolCallState("tool-1", "get_weather");
    const toolCallState2 = createToolCallState("tool-2", "get_time");
    const toolCallState3 = createToolCallState("tool-3", "get_location");
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallState: toolCallState1,
      }),
      createChatHistoryItem("tool", "Weather data", { toolCallId: "tool-1" }),
      createChatHistoryItem("user", "What's the time and location?"),
      createChatHistoryItem("assistant", "I'll check both", {
        toolCallStates: [toolCallState2, toolCallState3],
      }),
    ];
    
    // Should find tool call from first message
    expect(findToolCall(chatHistory, "tool-1")).toBe(toolCallState1);
    
    // Should find tool calls from second message
    expect(findToolCall(chatHistory, "tool-2")).toBe(toolCallState2);
    expect(findToolCall(chatHistory, "tool-3")).toBe(toolCallState3);
  });

  it("should handle tool calls with different statuses", () => {
    const generatedToolCall = createToolCallState("tool-1", "get_weather", "generated");
    const callingToolCall = createToolCallState("tool-2", "get_time", "calling");
    const doneToolCall = createToolCallState("tool-3", "get_location", "done");
    const erroredToolCall = createToolCallState("tool-4", "get_data", "errored");
    
    const chatHistory = [
      createChatHistoryItem("assistant", "I'll check multiple things", {
        toolCallStates: [generatedToolCall, callingToolCall, doneToolCall, erroredToolCall],
      }),
    ];
    
    expect(findToolCall(chatHistory, "tool-1")?.status).toBe("generated");
    expect(findToolCall(chatHistory, "tool-2")?.status).toBe("calling");
    expect(findToolCall(chatHistory, "tool-3")?.status).toBe("done");
    expect(findToolCall(chatHistory, "tool-4")?.status).toBe("errored");
  });
});

describe("Edge cases and integration", () => {
  it("should handle mixed single and multiple tool calls across messages", () => {
    const singleToolCall = createToolCallState("single-1", "get_weather");
    const multipleToolCalls = [
      createToolCallState("multi-1", "get_time"),
      createToolCallState("multi-2", "get_location"),
    ];
    
    const chatHistory = [
      createChatHistoryItem("user", "What's the weather?"),
      createChatHistoryItem("assistant", "I'll check the weather", {
        toolCallState: singleToolCall,
      }),
      createChatHistoryItem("tool", "Weather data", { toolCallId: "tool-1" }),
      createChatHistoryItem("user", "What's the time and location?"),
      createChatHistoryItem("assistant", "I'll check both", {
        toolCallStates: multipleToolCalls,
      }),
    ];
    
    // findCurrentToolCalls should return all from latest message
    const currentToolCalls = findCurrentToolCalls(chatHistory);
    expect(currentToolCalls).toEqual(multipleToolCalls);
    
    // hasCurrentToolCalls should return true when tool calls exist
    const hasToolCalls = hasCurrentToolCalls(chatHistory);
    expect(hasToolCalls).toBe(true);
    
    // findToolCall should find all tool calls across messages
    expect(findToolCall(chatHistory, "single-1")).toBe(singleToolCall);
    expect(findToolCall(chatHistory, "multi-1")).toBe(multipleToolCalls[0]);
    expect(findToolCall(chatHistory, "multi-2")).toBe(multipleToolCalls[1]);
  });
});