import { describe, expect, it, vi } from "vitest";
import { createMockStore } from "../../util/test/mockStore";
import { streamNormalInput } from "./streamNormalInput";

// Mock external dependencies only - let selectors run naturally
vi.mock("core/llm/toolSupport", () => ({
  modelSupportsNativeTools: vi.fn(),
}));

vi.mock(
  "core/tools/systemMessageTools/buildToolsSystemMessage",
  async (importOriginal) => {
    const actual = (await importOriginal()) as any;
    return {
      ...actual,
      addSystemMessageToolsToSystemMessage: vi.fn(),
    };
  },
);

vi.mock("../util/constructMessages", () => ({
  constructMessages: vi.fn(),
}));

vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(),
}));

vi.mock("core/config/shouldAutoEnableSystemMessageTools", () => ({
  shouldAutoEnableSystemMessageTools: vi.fn(() => undefined),
}));

import { ModelDescription } from "core";
import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { addSystemMessageToolsToSystemMessage } from "core/tools/systemMessageTools/buildToolsSystemMessage";
import { constructMessages } from "../util/constructMessages";
import { getBaseSystemMessage } from "../util/getBaseSystemMessage";

const mockModelSupportsNativeTools = vi.mocked(modelSupportsNativeTools);
const mockAddSystemMessageToolsToSystemMessage = vi.mocked(
  addSystemMessageToolsToSystemMessage,
);
const mockConstructMessages = vi.mocked(constructMessages);
const mockGetBaseSystemMessage = vi.mocked(getBaseSystemMessage);

const mockClaudeModel: ModelDescription = {
  title: "Claude 3.5 Sonnet",
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
  completionOptions: { reasoningBudgetTokens: 2048 },
};

function setupTest() {
  vi.clearAllMocks();

  // Default mock implementations for external functions
  mockModelSupportsNativeTools.mockReturnValue(true);
  mockGetBaseSystemMessage.mockReturnValue("System message");
  mockAddSystemMessageToolsToSystemMessage.mockReturnValue(
    "System message with tools",
  );
  mockConstructMessages.mockReturnValue({
    messages: [{ role: "user", content: "Hello" }],
    appliedRules: [],
    appliedRuleIndex: 0,
  });

  // Create store with realistic state that selectors can work with
  const mockStore = createMockStore({
    session: {
      history: [
        {
          message: { id: "1", role: "user", content: "Hello" },
          contextItems: [],
        },
      ],
      hasReasoningEnabled: false,
      isStreaming: true,
      id: "session-123",
      mode: "chat",
      streamAborter: new AbortController(),
      contextPercentage: 0,
      isPruned: false,
      isInEdit: false,
      title: "",
      lastSessionId: undefined,
      isSessionMetadataLoading: false,
      allSessionMetadata: [],
      symbols: {},
      codeBlockApplyStates: {
        states: [],
        curIndex: 0,
      },
      newestToolbarPreviewForInput: {},
      compactionLoading: {},
      inlineErrorMessage: undefined,
    },
    config: {
      config: {
        tools: [],
        rules: [],
        tabAutocompleteModel: undefined,
        selectedModelByRole: {
          chat: mockClaudeModel,
          apply: null,
          edit: null,
          summarize: null,
          autocomplete: null,
          rerank: null,
          embed: null,
        },
        experimental: {
          onlyUseSystemMessageTools: false,
        },
      } as any,
      lastSelectedModelByRole: {
        chat: mockClaudeModel.title,
      },
    } as any,
    ui: {
      toolSettings: {},
      ruleSettings: {},
      showDialog: false,
      dialogMessage: undefined,
    } as any,
  });

  const mockIdeMessenger = mockStore.mockIdeMessenger;

  return { mockStore, mockIdeMessenger };
}

describe("streamNormalInput", () => {
  it("should execute complete streaming flow with all dispatches", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();
    // Setup successful compilation
    mockIdeMessenger.request.mockResolvedValue({
      status: "success",
      content: {
        compiledChatMessages: [{ role: "user", content: "Hello" }],
        didPrune: false,
        contextPercentage: 0.8,
      },
    });

    // Setup streaming generator
    async function* mockStreamGenerator() {
      yield [{ role: "assistant", content: "First chunk" }];
      yield [{ role: "assistant", content: "Second chunk" }];
      return {
        prompt: "Hello",
        completion: "Hi there!",
        modelProvider: "anthropic",
      };
    }

    mockIdeMessenger.llmStreamChat.mockReturnValue(mockStreamGenerator());

    // Execute thunk
    const result = await mockStore.dispatch(streamNormalInput({}) as any);

    // Verify exact sequence of dispatched actions with payloads
    const dispatchedActions = (mockStore as any).getActions();

    expect(dispatchedActions).toEqual([
      {
        type: "chat/streamNormalInput/pending",
        meta: expect.objectContaining({
          arg: {},
          requestStatus: "pending",
        }),
      },
      {
        type: "session/setAppliedRulesAtIndex",
        payload: {
          index: 0,
          appliedRules: [],
        },
      },
      {
        type: "session/setActive",
      },
      {
        type: "session/setInlineErrorMessage",
      },
      {
        type: "session/setIsPruned",
        payload: false,
      },
      {
        type: "session/setContextPercentage",
        payload: 0.8,
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant",
            content: "First chunk",
          },
        ],
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant",
            content: "Second chunk",
          },
        ],
      },
      {
        type: "session/addPromptCompletionPair",
        payload: [
          {
            prompt: "Hello",
            completion: "Hi there!",
            modelProvider: "anthropic",
          },
        ],
      },
      {
        type: "session/setInactive",
      },
      {
        type: "chat/streamNormalInput/fulfilled",
        meta: expect.objectContaining({
          arg: {},
          requestStatus: "fulfilled",
        }),
      },
    ]);

    // Verify IDE messenger calls
    expect(mockIdeMessenger.request).toHaveBeenCalledWith("llm/compileChat", {
      messages: [{ role: "user", content: "Hello" }],
      options: {},
    });

    expect(mockIdeMessenger.llmStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        completionOptions: {},
        title: "Claude 3.5 Sonnet",
        messages: [{ role: "user", content: "Hello" }],
        messageOptions: { precompiled: true },
      }),
      expect.any(AbortSignal),
    );

    // Verify dev data logging call
    expect(mockIdeMessenger.post).toHaveBeenCalledWith("devdata/log", {
      name: "chatInteraction",
      data: {
        prompt: "Hello",
        completion: "Hi there!",
        modelProvider: "anthropic",
        modelTitle: "Claude 3.5 Sonnet",
        sessionId: "session-123",
      },
    });

    expect(result.type).toBe("chat/streamNormalInput/fulfilled");

    // Verify final state after thunk completion
    const finalState = mockStore.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            appliedRules: [],
            contextItems: [],
            message: { id: "1", role: "user", content: "Hello" },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content: "First chunkSecond chunk", // Chunks get combined
              id: expect.any(String),
              role: "assistant",
            },
            promptLogs: [
              {
                completion: "Hi there!",
                modelProvider: "anthropic",
                prompt: "Hello",
              },
            ],
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: false,
        id: "session-123",
        mode: "chat",
        streamAborter: expect.any(AbortController),
        contextPercentage: 0.8,
        isPruned: false,
        isInEdit: false,
        title: "",
        lastSessionId: undefined,
        isSessionMetadataLoading: false,
        allSessionMetadata: [],
        symbols: {},
        codeBlockApplyStates: {
          states: [],
          curIndex: 0,
        },
        newestToolbarPreviewForInput: {},
        compactionLoading: {},
        inlineErrorMessage: undefined,
      },
      config: {
        config: {
          tools: [],
          rules: [],
          tabAutocompleteModel: undefined,
          selectedModelByRole: {
            chat: mockClaudeModel,
            apply: null,
            edit: null,
            summarize: null,
            autocomplete: null,
            rerank: null,
            embed: null,
          },
          experimental: {
            onlyUseSystemMessageTools: false,
          },
        },
        lastSelectedModelByRole: {
          chat: mockClaudeModel.title,
        },
        loading: false,
        configError: undefined,
      },
      ui: {
        toolSettings: {},
        ruleSettings: {},
        showDialog: false,
        dialogMessage: undefined,
      },
      editModeState: {
        isInEdit: false,
        returnToMode: "chat",
      },
      indexing: {
        indexingState: "disabled",
      },
      tabs: {
        tabsItems: [],
      },
      profiles: {
        profiles: [],
      },
    });
  });

  it("should execute streaming flow with tool call execution", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();

    // Set up auto-approved tool setting for our test tool
    const mockStoreWithToolSettings = createMockStore({
      session: {
        history: [
          {
            message: {
              id: "1",
              role: "user",
              content: "Please search the codebase",
            },
            contextItems: [],
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: true,
        id: "session-123",
        mode: "chat",
        streamAborter: new AbortController(),
        contextPercentage: 0,
        isPruned: false,
        isInEdit: false,
        title: "",
        lastSessionId: undefined,
        isSessionMetadataLoading: false,
        allSessionMetadata: [],
        symbols: {},
        codeBlockApplyStates: {
          states: [],
          curIndex: 0,
        },
        newestToolbarPreviewForInput: {},
        compactionLoading: {},
        inlineErrorMessage: undefined,
      },
      config: {
        config: {
          tools: [],
          rules: [],
          tabAutocompleteModel: undefined,
          selectedModelByRole: {
            chat: mockClaudeModel,
            apply: null,
            edit: null,
            summarize: null,
            autocomplete: null,
            rerank: null,
            embed: null,
          },
          experimental: {
            onlyUseSystemMessageTools: false,
          },
        } as any,
        lastSelectedModelByRole: {
          chat: mockClaudeModel.title,
        },
      } as any,
      ui: {
        toolSettings: {
          search_codebase: "allowedWithoutPermission", // Auto-approve this tool
        },
        ruleSettings: {},
        showDialog: false,
        dialogMessage: undefined,
      } as any,
    });

    const mockIdeMessengerWithTool = mockStoreWithToolSettings.mockIdeMessenger;

    // Setup successful compilation and tool responses
    mockIdeMessengerWithTool.request.mockImplementation(
      (endpoint: string, data: any) => {
        if (endpoint === "llm/compileChat") {
          return Promise.resolve({
            status: "success",
            content: {
              compiledChatMessages: [
                { role: "user", content: "Please search the codebase" },
              ],
              didPrune: false,
              contextPercentage: 0.9,
            },
          });
        } else if (endpoint === "tools/call") {
          // Mock server-side tool call response
          return Promise.resolve({
            status: "success",
            content: {
              contextItems: [
                {
                  name: "Search Results",
                  description: "Found 3 matches",
                  content: "Result 1\nResult 2\nResult 3",
                  icon: "search",
                  hidden: false,
                },
              ],
              errorMessage: undefined,
            },
          });
        } else if (endpoint === "history/save") {
          // Mock session save
          return Promise.resolve({ status: "success" });
        }
        // Let other endpoints pass through or return success
        return Promise.resolve({ status: "success", content: {} });
      },
    );

    // Setup streaming generator with tool call
    async function* mockStreamGeneratorWithTool() {
      yield [
        { role: "assistant", content: "I'll search the codebase for you." },
      ];
      yield [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-call-1",
              type: "function",
              function: {
                name: "search_codebase",
                arguments: JSON.stringify({ query: "test function" }),
              },
            },
          ],
        },
      ];
      return {
        prompt: "Please search the codebase",
        completion: "I'll search the codebase for you.",
        modelProvider: "anthropic",
      };
    }

    // Mock different streaming responses for multiple calls
    let streamCallCount = 0;
    mockIdeMessengerWithTool.llmStreamChat.mockImplementation(() => {
      streamCallCount++;
      if (streamCallCount === 1) {
        // First call - main streaming with tool call
        return mockStreamGeneratorWithTool();
      } else {
        // Subsequent calls from streamResponseAfterToolCall - return minimal response
        async function* simpleGenerator() {
          yield [{ role: "assistant", content: "Search completed." }];
          return {
            prompt: "continuing after tool",
            completion: "Search completed.",
            modelProvider: "anthropic",
          };
        }
        return simpleGenerator();
      }
    });

    // Execute thunk
    const result = await mockStoreWithToolSettings.dispatch(
      streamNormalInput({}) as any,
    );

    // Verify key actions are dispatched (tool calls trigger a complex cascade, so we verify key actions exist)
    const dispatchedActions = (mockStoreWithToolSettings as any).getActions();

    // Verify core streaming actions
    expect(dispatchedActions).toContainEqual(
      expect.objectContaining({
        type: "session/setAppliedRulesAtIndex",
        payload: { index: 0, appliedRules: [] },
      }),
    );
    expect(dispatchedActions).toContainEqual(
      expect.objectContaining({ type: "session/setActive" }),
    );
    expect(dispatchedActions).toContainEqual(
      expect.objectContaining({
        type: "session/setContextPercentage",
        payload: 0.9,
      }),
    );

    // Verify streaming updates (both regular content and tool call)
    const streamUpdates = dispatchedActions.filter(
      (action: any) => action.type === "session/streamUpdate",
    );
    expect(streamUpdates.length).toBeGreaterThanOrEqual(2);
    expect(streamUpdates[0].payload).toEqual([
      { role: "assistant", content: "I'll search the codebase for you." },
    ]);
    expect(streamUpdates[1].payload[0]).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool-call-1",
            type: "function",
            function: {
              name: "search_codebase",
              arguments: JSON.stringify({ query: "test function" }),
            },
          },
        ],
      }),
    );

    // Verify tool call execution actions
    expect(dispatchedActions).toContainEqual(
      expect.objectContaining({
        type: "session/setToolGenerated",
        payload: expect.objectContaining({ toolCallId: "tool-call-1" }),
      }),
    );
    expect(dispatchedActions).toContainEqual(
      expect.objectContaining({
        type: "session/setToolCallCalling",
        payload: { toolCallId: "tool-call-1" },
      }),
    );
    expect(dispatchedActions).toContainEqual(
      expect.objectContaining({
        type: "session/updateToolCallOutput",
        payload: {
          toolCallId: "tool-call-1",
          contextItems: [
            {
              name: "Search Results",
              description: "Found 3 matches",
              content: "Result 1\nResult 2\nResult 3",
              icon: "search",
              hidden: false,
            },
          ],
        },
      }),
    );
    expect(dispatchedActions).toContainEqual(
      expect.objectContaining({
        type: "session/acceptToolCall",
        payload: { toolCallId: "tool-call-1" },
      }),
    );

    // Verify thunk completion
    expect(dispatchedActions).toContainEqual(
      expect.objectContaining({
        type: "chat/streamNormalInput/fulfilled",
      }),
    );

    // Verify IDE messenger calls
    expect(mockIdeMessengerWithTool.request).toHaveBeenCalledWith(
      "llm/compileChat",
      {
        messages: [{ role: "user", content: "Hello" }], // constructMessages mock returns this
        options: {},
      },
    );

    expect(mockIdeMessengerWithTool.request).toHaveBeenCalledWith(
      "tools/call",
      {
        toolCall: {
          id: "tool-call-1",
          type: "function",
          function: {
            name: "search_codebase",
            arguments: JSON.stringify({ query: "test function" }),
          },
        },
      },
    );

    // Verify that multiple compilation calls were made (due to tool call continuation)
    const compileCallsCount =
      mockIdeMessengerWithTool.request.mock.calls.filter(
        (call: any) => call[0] === "llm/compileChat",
      ).length;
    expect(compileCallsCount).toBeGreaterThanOrEqual(1);

    expect(result.type).toBe("chat/streamNormalInput/fulfilled");

    // Verify final state after tool call execution
    const finalState = mockStoreWithToolSettings.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            appliedRules: [],
            contextItems: [],
            message: {
              id: "1",
              role: "user",
              content: "Please search the codebase",
            },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content: "I'll search the codebase for you.",
              id: expect.any(String),
              role: "assistant",
              toolCalls: [
                {
                  id: "tool-call-1",
                  type: "function",
                  function: {
                    name: "search_codebase",
                    arguments: JSON.stringify({ query: "test function" }),
                  },
                },
              ],
            },
            promptLogs: [
              {
                completion: "I'll search the codebase for you.",
                modelProvider: "anthropic",
                prompt: "Please search the codebase",
              },
            ],
            toolCallStates: [
              {
                toolCallId: "tool-call-1",
                toolCall: {
                  id: "tool-call-1",
                  type: "function",
                  function: {
                    name: "search_codebase",
                    arguments: JSON.stringify({ query: "test function" }),
                  },
                },
                parsedArgs: { query: "test function" },
                status: "done",
                output: [
                  {
                    name: "Search Results",
                    description: "Found 3 matches",
                    content: "Result 1\nResult 2\nResult 3",
                    icon: "search",
                    hidden: false,
                  },
                ],
              },
            ],
          },
          {
            contextItems: [],
            message: {
              content: "Result 1\nResult 2\nResult 3",
              id: expect.any(String),
              role: "tool",
              toolCallId: "tool-call-1",
            },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content: "Search completed.",
              id: expect.any(String),
              role: "assistant",
            },
            promptLogs: [
              {
                completion: "Search completed.",
                modelProvider: "anthropic",
                prompt: "continuing after tool",
              },
            ],
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: false,
        id: "session-123",
        mode: "chat",
        streamAborter: expect.any(AbortController),
        contextPercentage: 0.9,
        isPruned: false,
        isInEdit: false,
        title: "New Session",
        lastSessionId: undefined,
        isSessionMetadataLoading: false,
        allSessionMetadata: {},
        symbols: {},
        codeBlockApplyStates: {
          states: [],
          curIndex: 0,
        },
        newestToolbarPreviewForInput: {},
        compactionLoading: {},
        inlineErrorMessage: undefined,
      },
      config: {
        config: {
          tools: [],
          rules: [],
          tabAutocompleteModel: undefined,
          selectedModelByRole: {
            chat: mockClaudeModel,
            apply: null,
            edit: null,
            summarize: null,
            autocomplete: null,
            rerank: null,
            embed: null,
          },
          experimental: {
            onlyUseSystemMessageTools: false,
          },
        },
        lastSelectedModelByRole: {
          chat: mockClaudeModel.title,
        },
        loading: false,
        configError: undefined,
      },
      ui: {
        toolSettings: {
          search_codebase: "allowedWithoutPermission",
        },
        ruleSettings: {},
        showDialog: false,
        dialogMessage: undefined,
      },
      editModeState: {
        isInEdit: false,
        returnToMode: "chat",
      },
      indexing: {
        indexingState: "disabled",
      },
      tabs: {
        tabsItems: [],
      },
      profiles: {
        profiles: [],
      },
    });
  });

  it("should throw error when no chat model is selected", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();

    // Create store with no selected chat model
    const mockStoreNoModel = createMockStore({
      session: {
        history: [
          {
            message: { id: "1", role: "user", content: "Hello" },
            contextItems: [],
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: true,
        id: "session-123",
        mode: "chat",
        streamAborter: new AbortController(),
        contextPercentage: 0,
        isPruned: false,
        isInEdit: false,
        title: "",
        lastSessionId: undefined,
        isSessionMetadataLoading: false,
        allSessionMetadata: [],
        symbols: {},
        codeBlockApplyStates: {
          states: [],
          curIndex: 0,
        },
        newestToolbarPreviewForInput: {},
        compactionLoading: {},
        inlineErrorMessage: undefined,
      },
      config: {
        config: {
          tools: [],
          rules: [],
          tabAutocompleteModel: undefined,
          selectedModelByRole: {
            chat: null, // No model selected
            apply: null,
            edit: null,
            summarize: null,
            autocomplete: null,
            rerank: null,
            embed: null,
          },
          experimental: {
            onlyUseSystemMessageTools: false,
          },
        } as any,
        lastSelectedModelByRole: {},
      } as any,
      ui: {
        toolSettings: {},
        ruleSettings: {},
        showDialog: false,
        dialogMessage: undefined,
      } as any,
    });

    // Execute thunk and expect it to be rejected
    const result = await mockStoreNoModel.dispatch(
      streamNormalInput({}) as any,
    );

    // Verify the thunk was rejected with correct error
    expect(result.type).toBe("chat/streamNormalInput/rejected");
    expect(result.error?.message).toBe("No chat model selected");

    // Verify only the pending action was dispatched (no other actions should occur)
    const dispatchedActions = (mockStoreNoModel as any).getActions();
    expect(dispatchedActions).toEqual([
      {
        type: "chat/streamNormalInput/pending",
        meta: expect.objectContaining({
          arg: {},
          requestStatus: "pending",
        }),
      },
      {
        type: "chat/streamNormalInput/rejected",
        meta: expect.objectContaining({
          arg: {},
          requestStatus: "rejected",
        }),
        error: expect.objectContaining({
          message: "No chat model selected",
        }),
      },
    ]);

    // Verify no IDE messenger calls were made
    expect(mockStoreNoModel.mockIdeMessenger.request).not.toHaveBeenCalled();
    expect(
      mockStoreNoModel.mockIdeMessenger.llmStreamChat,
    ).not.toHaveBeenCalled();

    // Verify state remains unchanged from initial mock store values
    const finalState = mockStoreNoModel.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            message: { id: "1", role: "user", content: "Hello" },
            contextItems: [],
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: true, // Unchanged from initial
        id: "session-123",
        mode: "chat",
        streamAborter: expect.any(AbortController),
        contextPercentage: 0, // Unchanged from initial
        isPruned: false,
        isInEdit: false,
        title: "",
        lastSessionId: undefined,
        isSessionMetadataLoading: false,
        allSessionMetadata: [],
        symbols: {},
        codeBlockApplyStates: {
          states: [],
          curIndex: 0,
        },
        newestToolbarPreviewForInput: {},
        compactionLoading: {},
        inlineErrorMessage: undefined, // Unchanged from initial
      },
      config: {
        config: {
          tools: [],
          rules: [],
          tabAutocompleteModel: undefined,
          selectedModelByRole: {
            chat: null, // No model selected
            apply: null,
            edit: null,
            summarize: null,
            autocomplete: null,
            rerank: null,
            embed: null,
          },
          experimental: {
            onlyUseSystemMessageTools: false,
          },
        },
        lastSelectedModelByRole: {},
        loading: false,
        configError: undefined,
      },
      ui: {
        toolSettings: {},
        ruleSettings: {},
        showDialog: false,
        dialogMessage: undefined,
      },
      editModeState: {
        isInEdit: false,
        returnToMode: "chat",
      },
      indexing: {
        indexingState: "disabled",
      },
      tabs: {
        tabsItems: [],
      },
      profiles: {
        profiles: [],
      },
    });
  });

  it("should handle compilation error - not enough context", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();

    // Mock compilation failure with "Not enough context" error
    mockIdeMessenger.request.mockResolvedValue({
      status: "error",
      error: "Not enough context available for this request",
    });

    // Execute thunk
    const result = await mockStore.dispatch(streamNormalInput({}) as any);

    // Verify thunk completed successfully (doesn't throw, handles error gracefully)
    expect(result.type).toBe("chat/streamNormalInput/fulfilled");

    // Verify exact action sequence for this error path
    const dispatchedActions = (mockStore as any).getActions();
    expect(dispatchedActions).toEqual([
      {
        type: "chat/streamNormalInput/pending",
        meta: expect.objectContaining({
          arg: {},
          requestStatus: "pending",
        }),
      },
      {
        type: "session/setAppliedRulesAtIndex",
        payload: {
          index: 0,
          appliedRules: [],
        },
      },
      {
        type: "session/setActive",
      },
      {
        type: "session/setInlineErrorMessage",
      },
      // Error handling actions
      {
        type: "session/setInlineErrorMessage",
        payload: "out-of-context",
      },
      {
        type: "session/setInactive",
      },
      {
        type: "chat/streamNormalInput/fulfilled",
        meta: expect.objectContaining({
          arg: {},
          requestStatus: "fulfilled",
        }),
      },
    ]);

    // Verify IDE messenger was called for compilation but not streaming
    expect(mockIdeMessenger.request).toHaveBeenCalledWith("llm/compileChat", {
      messages: [{ role: "user", content: "Hello" }],
      options: {},
    });
    expect(mockIdeMessenger.llmStreamChat).not.toHaveBeenCalled();

    // Verify final state shows error condition
    const finalState = mockStore.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            appliedRules: [],
            contextItems: [],
            isGatheringContext: false,
            message: { id: "1", role: "user", content: "Hello" },
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: false, // Should be inactive due to error
        id: "session-123",
        mode: "chat",
        streamAborter: expect.any(AbortController),
        contextPercentage: 0, // Unchanged - no successful compilation
        isPruned: false, // Unchanged - no successful compilation
        isInEdit: false,
        title: "",
        lastSessionId: undefined,
        isSessionMetadataLoading: false,
        allSessionMetadata: [],
        symbols: {},
        codeBlockApplyStates: {
          states: [],
          curIndex: 0,
        },
        newestToolbarPreviewForInput: {},
        compactionLoading: {},
        inlineErrorMessage: "out-of-context", // Error message set
      },
      config: {
        config: {
          tools: [],
          rules: [],
          tabAutocompleteModel: undefined,
          selectedModelByRole: {
            chat: mockClaudeModel,
            apply: null,
            edit: null,
            summarize: null,
            autocomplete: null,
            rerank: null,
            embed: null,
          },
          experimental: {
            onlyUseSystemMessageTools: false,
          },
        },
        lastSelectedModelByRole: {
          chat: mockClaudeModel.title,
        },
        loading: false,
        configError: undefined,
      },
      ui: {
        toolSettings: {},
        ruleSettings: {},
        showDialog: false,
        dialogMessage: undefined,
      },
      editModeState: {
        isInEdit: false,
        returnToMode: "chat",
      },
      indexing: {
        indexingState: "disabled",
      },
      tabs: {
        tabsItems: [],
      },
      profiles: {
        profiles: [],
      },
    });
  });
});
