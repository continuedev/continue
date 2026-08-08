import { ChatMessage } from "core";
import { renderChatMessage } from "core/util/messageContent";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addToolCallDeltaToState } from "../../util/toolCallState";
import { ChatHistoryItemWithMessageId, sessionSlice } from "./sessionSlice";

// Mock dependencies
vi.mock("uuid");
vi.mock("core/util/messageContent");
vi.mock("../../util/toolCallState");

const mockUuidv4 = vi.mocked(uuidv4);
const mockRenderChatMessage = vi.mocked(renderChatMessage);
const mockAddToolCallDeltaToState = vi.mocked(addToolCallDeltaToState);

describe("sessionSlice streamUpdate", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock uuidv4 to return predictable values
    let callCount = 0;
    mockUuidv4.mockImplementation(() => `mock-uuid-${++callCount}`);

    // Mock renderChatMessage to return content as is
    mockRenderChatMessage.mockImplementation((message: ChatMessage) => {
      if (typeof message.content === "string") {
        return message.content;
      }
      return "";
    });

    // Mock addToolCallDeltaToState
    mockAddToolCallDeltaToState.mockImplementation((delta, state) => {
      return {
        status: "generating" as const,
        toolCall: {
          id: delta.id || "mock-tool-id",
          type: "function" as const,
          function: {
            name: delta.function?.name || "mock-function",
            arguments: delta.function?.arguments || "{}",
          },
        },
        toolCallId: delta.id || "mock-tool-id",
        parsedArgs: {},
      };
    });
  });

  const createInitialState = () => ({
    lastSessionId: undefined,
    allSessionMetadata: [],
    history: [
      {
        message: {
          role: "user" as const,
          content: "This is a test.",
          id: "initial-user-message",
        },
        contextItems: [],
      },
    ] as ChatHistoryItemWithMessageId[],
    isStreaming: false,
    title: "Test Session",
    id: "test-session-id",
    streamAborter: new AbortController(),
    symbols: {},
    mode: "chat" as const,
    isInEdit: false,
    codeBlockApplyStates: {
      states: [],
      curIndex: 0,
    },
    newestToolbarPreviewForInput: {},
    isSessionMetadataLoading: false,
    compactionLoading: {},
  });

  describe("Basic Chat Message", () => {
    it("should append assistant message to history", () => {
      const initialState = createInitialState();
      const action = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant" as const,
            content: "Here is a response to your message without thinking.",
          },
        ],
      };

      const newState = sessionSlice.reducer(initialState, action);

      expect(newState.history).toHaveLength(2);
      expect(newState.history[1].message.role).toBe("assistant");
      expect(newState.history[1].message.content).toBe(
        "Here is a response to your message without thinking.",
      );
      expect(newState.history[1].message.id).toBe("mock-uuid-1");
      expect(newState.history[1].contextItems).toEqual([]);
    });
  });

  describe("Chat Message With Thinking", () => {
    it("should split thinking and assistant content correctly", () => {
      const initialState = createInitialState();
      const action = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant" as const,
            content:
              "<think>I should send the user a response.</think> Here is a response to your message with thinking.",
          },
        ],
      };

      const newState = sessionSlice.reducer(initialState, action);

      expect(newState.history).toHaveLength(2);

      // Check reasoning
      expect(newState.history[0].reasoning?.text).toBe(
        "I should send the user a response.",
      );

      // Check assistant message
      expect(newState.history[1].message.role).toBe("assistant");
      expect(newState.history[1].message.content).toBe(
        "Here is a response to your message with thinking.",
      );
      expect(newState.history[1].message.id).toBe("mock-uuid-1");
    });
  });

  describe("Tool Call With Response", () => {
    it("should handle tool call followed by tool response and assistant message", () => {
      const initialState = createInitialState();
      const toolCallAction = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant" as const,
            content: "<think>I should use a tool call.</think>",
            toolCalls: [
              {
                id: "1234",
                type: "function" as const,
                function: {
                  name: "builtin_ls",
                  arguments: '{"dirPath":".","recursive":false}',
                },
              },
            ],
          },
        ],
      };

      let newState = sessionSlice.reducer(initialState, toolCallAction);
      expect(newState.history).toHaveLength(2);

      // Check reasoning
      expect(newState.history[0].reasoning?.text).toBe(
        "I should use a tool call.",
      );

      // Check generating message
      expect(newState.history[1].message.role).toBe("assistant");
      expect(newState.history[1].message.content).toBe("");
      expect(newState.history[1].toolCallStates?.[0]?.status).toBe(
        "generating",
      );
      expect(newState.history[1].toolCallStates?.[0]?.toolCallId).toBe("1234");

      const toolResponseAction = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "tool" as const,
            toolCallId: "1234",
            content: "foo.txt\nbar.txt\nexample.php",
          },
          {
            role: "assistant" as const,
            content: "I see, the tool found 3 files.",
          },
        ],
      };
      newState = sessionSlice.reducer(newState, toolResponseAction);
      expect(newState.history).toHaveLength(4);

      // Check tool message
      expect(newState.history[2].message.role).toBe("tool");
      expect(newState.history[2].message.content).toBe(
        "foo.txt\nbar.txt\nexample.php",
      );
      expect((newState.history[2].message as any).toolCallId).toBe("1234");

      // Check final assistant message
      expect(newState.history[3].message.role).toBe("assistant");
      expect(newState.history[3].message.content).toBe(
        "I see, the tool found 3 files.",
      );
    });
  });

  describe("Tool Call With Streaming Response", () => {
    it("should handle streaming assistant response after tool call", () => {
      const initialState = createInitialState();
      const toolCallAction = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant" as const,
            content: "<think>I should use a tool call.</think>",
            toolCalls: [
              {
                id: "1234",
                type: "function" as const,
                function: {
                  name: "builtin_ls",
                  arguments: '{"dirPath":".","recursive":false}',
                },
              },
            ],
          },
        ],
      };

      let newState = sessionSlice.reducer(initialState, toolCallAction);
      expect(newState.history).toHaveLength(2);

      // Check reasoning
      expect(newState.history[0].reasoning?.text).toBe(
        "I should use a tool call.",
      );

      // Check generating message
      expect(newState.history[1].message.role).toBe("assistant");
      expect(newState.history[1].message.content).toBe("");
      expect(newState.history[1].toolCallStates?.[0]?.status).toBe(
        "generating",
      );
      expect(newState.history[1].toolCallStates?.[0]?.toolCallId).toBe("1234");

      const toolResponseAction = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "tool" as const,
            toolCallId: "1234",
            content: "foo.txt\nbar.txt\nexample.php",
          },
          {
            role: "assistant" as const,
            content: "<think>",
          },
          {
            role: "assistant" as const,
            content: "Good, ",
          },
          {
            role: "assistant" as const,
            content: "I received a list",
          },
          {
            role: "assistant" as const,
            content: " of files.",
          },
          {
            role: "assistant" as const,
            content: "</think>",
          },
          {
            role: "assistant" as const,
            content: "\n",
          },
          {
            role: "assistant" as const,
            content: "I see, ",
          },
          {
            role: "assistant" as const,
            content: "the tool ",
          },
          {
            role: "assistant" as const,
            content: "found 3 ",
          },
          {
            role: "assistant" as const,
            content: "files.",
          },
        ],
      };

      newState = sessionSlice.reducer(newState, toolResponseAction);

      expect(newState.history).toHaveLength(4);

      // Check tool message
      expect(newState.history[2].message.role).toBe("tool");
      expect(newState.history[2].message.content).toBe(
        "foo.txt\nbar.txt\nexample.php",
      );

      // Check response message
      expect(newState.history[3].message.role).toBe("assistant");
      expect(newState.history[3].message.content).toBe(
        "I see, the tool found 3 files.",
      );
      expect(newState.history[3].reasoning?.text).toBe(
        "Good, I received a list of files.",
      );
      expect(newState.history[3].reasoning?.active).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty history gracefully", () => {
      const initialState = createInitialState();
      initialState.history = [];

      const action = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant" as const,
            content: "Hello",
          },
        ],
      };

      const newState = sessionSlice.reducer(initialState, action);

      // Should not crash and history should remain empty
      expect(newState.history).toHaveLength(0);
    });

    it("should handle redacted thinking messages", () => {
      const initialState = createInitialState();
      const action = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "thinking" as const,
            content: "This should be hidden",
            redactedThinking: true,
          },
        ],
      };

      const newState = sessionSlice.reducer(initialState, action);

      expect(newState.history).toHaveLength(2);
      expect(newState.history[1].message.role).toBe("thinking");
      expect(newState.history[1].message.content).toBe(
        "internal reasoning is hidden due to safety reasons",
      );
      expect((newState.history[1].message as any).redactedThinking).toBe(true);
    });

    it("should handle signature updates for thinking messages", () => {
      const initialState = createInitialState();
      // First add a thinking message
      initialState.history.push({
        message: {
          role: "thinking",
          content: "Some thinking",
          id: "thinking-message",
        },
        contextItems: [],
      });

      const action = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "thinking" as const,
            signature: "test-signature",
          },
        ],
      };

      const newState = sessionSlice.reducer(initialState, action);

      expect(newState.history).toHaveLength(2);
      expect((newState.history[1].message as any).signature).toBe(
        "test-signature",
      );
    });

    it("should accumulate content for same role messages", () => {
      const initialState = createInitialState();
      // Add an assistant message first
      initialState.history.push({
        message: {
          role: "assistant",
          content: "Hello ",
          id: "assistant-message",
        },
        contextItems: [],
      });

      const action = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant" as const,
            content: "world!",
          },
        ],
      };

      const newState = sessionSlice.reducer(initialState, action);

      expect(newState.history).toHaveLength(2);
      expect(newState.history[1].message.content).toBe("Hello world!");
    });

    it("should handle basic tool call streaming", () => {
      const initialState = createInitialState();
      const toolCallId = "call_123";

      const action = {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant" as const,
            content: "",
            toolCalls: [
              {
                id: toolCallId,
                type: "function" as const,
                function: {
                  name: "test_tool",
                  arguments: '{"arg":"value"}',
                },
              },
            ],
          },
        ],
      };

      const newState = sessionSlice.reducer(initialState, action);

      expect(newState.history).toHaveLength(2);
      expect(newState.history[1].message.role).toBe("assistant");
      expect(newState.history[1].toolCallStates).toHaveLength(1);
    });
  });
});
