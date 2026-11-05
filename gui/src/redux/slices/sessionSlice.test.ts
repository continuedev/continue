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

const mockUuidv4 = vi.mocked(uuidv4 as () => string);
const mockRenderChatMessage = vi.mocked(renderChatMessage);
const mockAddToolCallDeltaToState = vi.mocked(addToolCallDeltaToState);

describe("sessionSlice prompt cache state across sessions", () => {
  const state = {
    ...({} as any),
    id: "s1",
    history: [],
    streamAborter: new AbortController(),
    symbols: {},
    promptCache: {
      escalated: true,
      lastRequestAt: 123,
      lastTtl: "1h",
      lastInputTokens: 300_000,
      lastKey: { model: "m", tools: "t", system: "s" },
      misses: 4,
      lastMiss: { readTokens: 0, expectedTokens: 1, causes: [] },
      missesAcknowledged: 1,
      dismissedColdFor: 123,
    },
  };

  it("starts a new session with an empty cache and nothing Auto learned before", () => {
    const next = sessionSlice.reducer(state, sessionSlice.actions.newSession());
    expect(next.promptCache).toEqual({ escalated: false });
  });

  it("starts a loaded session empty too", () => {
    const next = sessionSlice.reducer(
      state,
      sessionSlice.actions.newSession({
        sessionId: "other",
        title: "t",
        history: [],
      } as any),
    );
    expect(next.promptCache?.lastInputTokens).toBeUndefined();
    expect(next.promptCache?.misses).toBeUndefined();
    expect(next.promptCache?.requests).toBeUndefined();
    expect(next.promptCache?.escalated).toBe(false);
  });

  it("brings back a loaded session's own cache record, and nothing else of the old one", () => {
    const next = sessionSlice.reducer(
      state,
      sessionSlice.actions.newSession({
        sessionId: "other",
        title: "t",
        history: [],
        promptCache: {
          lastRequestAt: 999,
          lastInputTokens: 250_000,
          lastTtl: "5m",
        },
      } as any),
    );
    expect(next.promptCache).toEqual({
      escalated: false,
      lastRequestAt: 999,
      lastInputTokens: 250_000,
      lastTtl: "5m",
    });
  });

  it("brings back a saved session's request count and escalation, so resuming keeps counting", () => {
    const next = sessionSlice.reducer(
      state,
      sessionSlice.actions.newSession({
        sessionId: "other",
        title: "t",
        history: [],
        promptCache: {
          lastRequestAt: 999,
          lastTtl: "1h",
          requests: 7,
          escalated: true,
          escalatedBy: "requests",
        },
      } as any),
    );
    expect(next.promptCache).toMatchObject({
      escalated: true,
      escalatedBy: "requests",
      requests: 7,
      lastTtl: "1h",
    });
  });

  it("a session saved before the count existed starts counting from zero", () => {
    const next = sessionSlice.reducer(
      state,
      sessionSlice.actions.newSession({
        sessionId: "old",
        title: "t",
        history: [],
        promptCache: { lastRequestAt: 999, lastTtl: "5m" },
      } as any),
    );
    expect(next.promptCache?.requests).toBeUndefined();
    expect(next.promptCache?.escalated).toBe(false);
  });

  it("counts misses and acknowledges them", () => {
    let s = sessionSlice.reducer(
      state,
      sessionSlice.actions.setPromptCacheState({ escalated: false }),
    );
    const miss = {
      readTokens: 0,
      expectedTokens: 90_000,
      causes: ["the tools"],
    };
    s = sessionSlice.reducer(s, sessionSlice.actions.recordCacheMiss(miss));
    s = sessionSlice.reducer(s, sessionSlice.actions.recordCacheMiss(miss));
    expect(s.promptCache?.misses).toBe(2);
    expect(s.promptCache?.lastMiss).toEqual(miss);
    s = sessionSlice.reducer(s, sessionSlice.actions.acknowledgeCacheMisses());
    expect(s.promptCache?.missesAcknowledged).toBe(2);
  });
});

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
    checkpoints: [],
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
