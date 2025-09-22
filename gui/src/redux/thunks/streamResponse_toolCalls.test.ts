import { JSONContent } from "@tiptap/core";
import { InputModifiers } from "core";
import { describe, expect, it, vi } from "vitest";
import { createMockStore } from "../../util/test/mockStore";
import { streamResponseThunk } from "./streamResponse";

// Mock external dependencies only - let selectors run naturally
// Removed: modelSupportsNativeTools - let it run naturally

// Removed: addSystemMessageToolsToSystemMessage - let it run naturally

// Mock system message construction to keep test readable
vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(),
}));

import { getBaseSystemMessage } from "../util/getBaseSystemMessage";

// Removed: shouldAutoEnableSystemMessageTools - let it run naturally

// Additional mocks for streamResponseThunk
vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-123"),
}));

vi.mock(
  "../../components/mainInput/TipTapEditor/utils/resolveEditorContent",
  () => ({
    resolveEditorContent: vi.fn(),
  }),
);

import { ModelDescription } from "core";
import posthog from "posthog-js";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";

const mockGetBaseSystemMessage = vi.mocked(getBaseSystemMessage);

const mockPosthog = vi.mocked(posthog);
const mockResolveEditorContent = vi.mocked(resolveEditorContent);

const mockClaudeModel: ModelDescription = {
  title: "Claude 3.5 Sonnet",
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
  completionOptions: { reasoningBudgetTokens: 2048 },
};

// Mock editor state (what user types in the input)
const mockEditorState: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hello, please help me with this code" }],
    },
  ],
};

// Mock input modifiers (codebase context, etc.)
const mockModifiers: InputModifiers = {
  useCodebase: true,
  noContext: false,
};

function setupTest() {
  vi.clearAllMocks();

  // Default mock implementations for external functions

  // Default mock for resolveEditorContent (can be overridden in individual tests)
  mockResolveEditorContent.mockResolvedValue({
    selectedContextItems: [],
    selectedCode: [],
    content: "Hello, please help me with this code",
    legacyCommandWithInput: undefined,
  });

  // Mock getBaseSystemMessage to return simple system message for readable tests
  mockGetBaseSystemMessage.mockReturnValue("You are a helpful assistant.");

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

describe("streamResponseThunk - tool calls", () => {
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
        } else if (endpoint === "tools/evaluatePolicy") {
          // Mock dynamic policy evaluation - return auto-approve for this test
          return Promise.resolve({
            status: "success",
            content: { policy: "allowedWithoutPermission" },
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
        } else if (endpoint === "history/list") {
          return Promise.resolve({ status: "success", content: [] });
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

    // Track isStreaming state changes to detect UI flashing during auto-approved tool execution
    const streamingStateChanges: boolean[] = [];
    let lastStreamingState =
      mockStoreWithToolSettings.getState().session.isStreaming;
    // Record the initial state
    streamingStateChanges.push(lastStreamingState);

    // Subscribe to store changes to catch ALL state updates
    const unsubscribe = mockStoreWithToolSettings.subscribe(() => {
      const currentState =
        mockStoreWithToolSettings.getState().session.isStreaming;
      if (currentState !== lastStreamingState) {
        console.log(
          `Store subscription: isStreaming changed from ${lastStreamingState} to ${currentState}`,
        );
        streamingStateChanges.push(currentState);
        lastStreamingState = currentState;
      }
    });

    // Execute thunk
    const result = await mockStoreWithToolSettings.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Debug: check what happened
    const debugState = mockStoreWithToolSettings.getState();
    const finalStreamingState = debugState.session.isStreaming;
    const toolCallStates = debugState.session.history.flatMap(
      (item) => item.toolCallStates || [],
    );

    console.log("Initial streaming state:", lastStreamingState);
    console.log("Final streaming state:", finalStreamingState);
    console.log(
      "Tool call states:",
      toolCallStates.map((t) => ({
        id: t.toolCallId,
        status: t.status,
        toolName: t.toolCall.function.name,
      })),
    );
    console.log("Tool settings:", debugState.ui.toolSettings);
    console.log(
      "Auto-approved tool streaming state changes:",
      streamingStateChanges,
    );

    // Unsubscribe from store updates
    unsubscribe();

    // Verify no UI flashing during auto-approved tool execution
    // DESIRED: Should stay true throughout tool execution, only becoming false at the very end
    // We expect [true, false] - streaming starts true, stays true during tool execution, then false when all done
    expect(streamingStateChanges).toEqual([true, false]);

    // Verify key actions are dispatched (tool calls trigger a complex cascade, so we verify key actions exist)
    const dispatchedActions = (mockStoreWithToolSettings as any).getActions();

    // Verify exact action sequence
    const actionTypes = dispatchedActions.map((action: any) => action.type);
    expect(actionTypes).toEqual([
      "chat/streamResponse/pending",
      "chat/streamWrapper/pending",
      "session/submitEditorAndInitAtIndex",
      "session/resetNextCodeBlockToApplyIndex",
      "symbols/updateFromContextItems/pending",
      "session/updateHistoryItemAtIndex",
      "chat/streamNormalInput/pending",
      "session/setAppliedRulesAtIndex",
      "session/setActive",
      "session/setInlineErrorMessage",
      "session/setIsPruned",
      "session/setContextPercentage",
      "symbols/updateFromContextItems/fulfilled",
      "session/streamUpdate",
      "session/streamUpdate",
      "session/addPromptCompletionPair",
      "session/setToolGenerated",
      "chat/callTool/pending",
      "session/setToolCallCalling",
      "session/updateToolCallOutput",
      "session/acceptToolCall",
      "chat/streamAfterToolCall/pending",
      "chat/streamWrapper/pending",
      "session/resetNextCodeBlockToApplyIndex",
      "session/streamUpdate",
      "chat/streamNormalInput/pending",
      "session/setAppliedRulesAtIndex",
      "session/setActive",
      "session/setInlineErrorMessage",
      "session/setIsPruned",
      "session/setContextPercentage",
      "session/streamUpdate",
      "session/addPromptCompletionPair",
      "session/setInactive",
      "chat/streamNormalInput/fulfilled",
      "session/saveCurrent/pending",
      "session/update/pending",
      "session/updateSessionMetadata",
      "session/refreshMetadata/pending",
      "session/setIsSessionMetadataLoading",
      "session/setAllSessionMetadata",
      "session/refreshMetadata/fulfilled",
      "session/update/fulfilled",
      "session/saveCurrent/fulfilled",
      "chat/streamWrapper/fulfilled",
      "chat/streamAfterToolCall/fulfilled",
      "chat/callTool/fulfilled",
      "chat/streamNormalInput/fulfilled",
      "session/saveCurrent/pending",
      "session/update/pending",
      "session/updateSessionMetadata",
      "session/refreshMetadata/pending",
      "session/setIsSessionMetadataLoading",
      "session/setAllSessionMetadata",
      "session/refreshMetadata/fulfilled",
      "session/update/fulfilled",
      "session/saveCurrent/fulfilled",
      "chat/streamWrapper/fulfilled",
      "chat/streamResponse/fulfilled",
    ]);

    // Verify key payload data for important actions
    const setContextPercentageAction = dispatchedActions.find(
      (a: any) => a.type === "session/setContextPercentage",
    );
    expect(setContextPercentageAction.payload).toBe(0.9);

    const streamUpdates = dispatchedActions.filter(
      (a: any) => a.type === "session/streamUpdate",
    );
    expect(streamUpdates[0].payload).toEqual([
      { role: "assistant", content: "I'll search the codebase for you." },
    ]);
    expect(streamUpdates[1].payload).toEqual([
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
    ]);

    const completionPairs = dispatchedActions.filter(
      (a: any) => a.type === "session/addPromptCompletionPair",
    );
    expect(completionPairs[0].payload).toEqual([
      {
        completion: "I'll search the codebase for you.",
        modelProvider: "anthropic",
        prompt: "Please search the codebase",
      },
    ]);

    const toolCallActions = dispatchedActions.filter(
      (a: any) => a.type === "session/setToolCallCalling",
    );
    expect(toolCallActions[0].payload).toEqual({ toolCallId: "tool-call-1" });

    const toolOutputActions = dispatchedActions.filter(
      (a: any) => a.type === "session/updateToolCallOutput",
    );
    expect(toolOutputActions[0].payload).toEqual({
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
    });

    // Verify IDE messenger calls
    expect(mockIdeMessengerWithTool.request).toHaveBeenCalledWith(
      "llm/compileChat",
      {
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please search the codebase",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Hello, please help me with this code",
              },
            ],
          },
        ],
        options: {
          reasoning: false,
        },
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

    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Verify telemetry events for auto-approved tool execution
    // Use partial matching to allow additional fields (e.g. model) in payload
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      "tool_call_decision",
      expect.objectContaining({
        decision: "auto_accept",
        toolName: "search_codebase",
        toolCallId: "tool-call-1",
      }),
    );

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      "tool_call_outcome",
      expect.objectContaining({
        succeeded: true,
        toolName: "search_codebase",
        errorReason: undefined,
        duration_ms: expect.any(Number),
      }),
    );

    // Verify final state after tool call execution
    const finalState = mockStoreWithToolSettings.getState();

    // Check that the tool was executed (status should be 'done' if auto-approved and executed)
    const toolCallState = finalState.session.history.find(
      (item) => item.toolCallStates && item.toolCallStates.length > 0,
    )?.toolCallStates?.[0];

    // With proper mocking, the tool should be auto-executed
    expect(toolCallState?.status).toBe("done");
    expect(toolCallState?.output).toBeDefined();

    expect(finalState).toEqual({
      session: {
        history: [
          {
            contextItems: [],
            message: {
              id: "1",
              role: "user",
              content: "Please search the codebase",
            },
          },
          {
            appliedRules: [],
            contextItems: [],
            editorState: mockEditorState,
            message: {
              id: expect.any(String),
              role: "user",
              content: "Hello, please help me with this code",
            },
          },
          {
            contextItems: [],
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
              id: "mock-uuid-123",
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
        indexing: {
          statuses: {},
          hiddenChatPeekTypes: {
            docs: false,
          },
        },
      },
      tabs: {
        tabsItems: [],
      },
      profiles: {
        organizations: [],
        selectedProfileId: null,
        selectedOrganizationId: null,
        preferencesByProfileId: {},
      },
    });
  });

  it("should handle tool call rejection error", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();

    // Create store with tool settings that will reject the tool call
    const mockStoreWithToolReject = createMockStore({
      session: {
        history: [
          {
            message: {
              id: "1",
              role: "user",
              content: "Please edit this file",
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
          edit_existing_file: "disabled", // Tool is disabled/rejected
        },
        ruleSettings: {},
        showDialog: false,
        dialogMessage: undefined,
      } as any,
    });

    const mockIdeMessengerReject = mockStoreWithToolReject.mockIdeMessenger;

    // Setup successful compilation
    mockIdeMessengerReject.request.mockResolvedValue({
      status: "success",
      content: {
        compiledChatMessages: [
          { role: "user", content: "Please edit this file" },
        ],
        didPrune: false,
        contextPercentage: 0.7,
      },
    });

    // Setup streaming generator with tool call that will be rejected
    async function* mockStreamGeneratorWithRejectedTool() {
      yield [{ role: "assistant", content: "I'll edit the file for you." }];
      yield [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-reject-1",
              type: "function",
              function: {
                name: "edit_existing_file",
                arguments: JSON.stringify({
                  filepath: "test.js",
                  changes: "const x = 1;",
                }),
              },
            },
          ],
        },
      ];
      return {
        prompt: "Please edit this file",
        completion: "I'll edit the file for you.",
        modelProvider: "anthropic",
      };
    }

    mockIdeMessengerReject.llmStreamChat.mockReturnValue(
      mockStreamGeneratorWithRejectedTool(),
    );

    // Execute thunk
    const result = await mockStoreWithToolReject.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify thunk completed successfully (tool rejection is handled gracefully)
    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Verify exact action sequence includes tool generation but rejection handling
    const dispatchedActions = (mockStoreWithToolReject as any).getActions();
    expect(dispatchedActions).toEqual([
      {
        type: "chat/streamResponse/pending",
        meta: {
          arg: {
            editorState: mockEditorState,
            modifiers: mockModifiers,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/pending",
        meta: {
          arg: expect.any(Function),
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/submitEditorAndInitAtIndex",
        payload: {
          editorState: mockEditorState,
          index: 1,
        },
      },
      {
        type: "session/resetNextCodeBlockToApplyIndex",
        payload: undefined,
      },
      {
        type: "symbols/updateFromContextItems/pending",
        meta: {
          arg: [],
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/updateHistoryItemAtIndex",
        payload: {
          index: 1,
          updates: {
            contextItems: [],
            message: {
              content: "Hello, please help me with this code",
              id: "mock-uuid-123",
              role: "user",
            },
          },
        },
      },
      {
        type: "chat/streamNormalInput/pending",
        meta: {
          arg: {
            legacySlashCommandData: undefined,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setAppliedRulesAtIndex",
        payload: {
          appliedRules: [],
          index: 1,
        },
      },
      {
        type: "session/setActive",
        payload: undefined,
      },
      {
        type: "session/setInlineErrorMessage",
        payload: undefined,
      },
      {
        type: "session/setIsPruned",
        payload: false,
      },
      {
        type: "session/setContextPercentage",
        payload: 0.7,
      },
      {
        type: "symbols/updateFromContextItems/fulfilled",
        meta: {
          arg: [],
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant",
            content: "I'll edit the file for you.",
          },
        ],
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "tool-reject-1",
                type: "function",
                function: {
                  name: "edit_existing_file",
                  arguments: '{"filepath":"test.js","changes":"const x = 1;"}',
                },
              },
            ],
          },
        ],
      },
      {
        type: "session/addPromptCompletionPair",
        payload: [
          {
            completion: "I'll edit the file for you.",
            modelProvider: "anthropic",
            prompt: "Please edit this file",
          },
        ],
      },
      {
        type: "session/errorToolCall",
        payload: {
          toolCallId: "tool-reject-1",
        },
      },
      {
        type: "session/updateToolCallOutput",
        payload: {
          toolCallId: "tool-reject-1",
          contextItems: [
            {
              icon: "problems",
              name: "Security Policy Violation",
              description: "Command Disabled",
              content: `This command has been disabled by security policy:\n\nedit_existing_file\n\nThis command cannot be executed as it may pose a security risk.`,
              hidden: false,
            },
          ],
        },
      },
      {
        type: "session/setInactive",
        payload: undefined,
      },
      {
        type: "chat/streamNormalInput/fulfilled",
        meta: {
          arg: {
            legacySlashCommandData: undefined,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/saveCurrent/pending",
        meta: {
          arg: {
            generateTitle: true,
            openNewSession: false,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/update/pending",
        meta: {
          arg: expect.objectContaining({
            history: expect.any(Array),
            sessionId: "session-123",
            title: "New Session",
            workspaceDirectory: "",
          }),
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/updateSessionMetadata",
        payload: {
          sessionId: "session-123",
          title: "New Session",
        },
      },
      {
        type: "session/refreshMetadata/pending",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setIsSessionMetadataLoading",
        payload: false,
      },
      {
        type: "session/setAllSessionMetadata",
        payload: {
          compiledChatMessages: [
            {
              content: "Please edit this file",
              role: "user",
            },
          ],
          contextPercentage: 0.7,
          didPrune: false,
        },
      },
      {
        type: "session/refreshMetadata/fulfilled",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: {
          compiledChatMessages: [
            {
              content: "Please edit this file",
              role: "user",
            },
          ],
          contextPercentage: 0.7,
          didPrune: false,
        },
      },
      {
        type: "session/update/fulfilled",
        meta: {
          arg: expect.objectContaining({
            history: expect.any(Array),
            sessionId: "session-123",
            title: "New Session",
            workspaceDirectory: "",
          }),
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/saveCurrent/fulfilled",
        meta: {
          arg: {
            generateTitle: true,
            openNewSession: false,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/fulfilled",
        meta: {
          arg: expect.any(Function),
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/streamResponse/fulfilled",
        meta: {
          arg: {
            editorState: mockEditorState,
            modifiers: mockModifiers,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
    ]);

    // Verify IDE messenger calls - compilation should succeed, streaming should happen
    expect(mockIdeMessengerReject.request).toHaveBeenCalledWith(
      "llm/compileChat",
      {
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please edit this file",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Hello, please help me with this code",
              },
            ],
          },
        ],
        options: {
          reasoning: false,
        },
      },
    );

    expect(mockIdeMessengerReject.llmStreamChat).toHaveBeenCalledWith(
      {
        completionOptions: {
          reasoning: false,
        },
        legacySlashCommandData: undefined,
        messageOptions: { precompiled: true },
        messages: [
          {
            role: "user",
            content: "Please edit this file",
          },
        ],
        title: "Claude 3.5 Sonnet",
      },
      expect.any(AbortSignal),
    );

    // Should NOT call tools/call since tool is disabled/rejected
    expect(mockIdeMessengerReject.request).not.toHaveBeenCalledWith(
      "tools/call",
      expect.anything(),
    );

    // Verify session save was called
    expect(mockIdeMessengerReject.request).toHaveBeenCalledWith(
      "history/save",
      expect.anything(),
    );

    // Verify final state contains the tool call but it's not executed
    const finalState = mockStoreWithToolReject.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            contextItems: [],
            message: {
              id: "1",
              role: "user",
              content: "Please edit this file",
            },
          },
          {
            appliedRules: [],
            contextItems: [],
            editorState: mockEditorState,
            message: {
              content: "Hello, please help me with this code",
              id: expect.any(String),
              role: "user",
            },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content: "I'll edit the file for you.",
              id: "mock-uuid-123",
              role: "assistant",
              toolCalls: [
                {
                  id: "tool-reject-1",
                  type: "function",
                  function: {
                    name: "edit_existing_file",
                    arguments: JSON.stringify({
                      filepath: "test.js",
                      changes: "const x = 1;",
                    }),
                  },
                },
              ],
            },
            promptLogs: [
              {
                completion: "I'll edit the file for you.",
                modelProvider: "anthropic",
                prompt: "Please edit this file",
              },
            ],
            toolCallStates: [
              {
                toolCallId: "tool-reject-1",
                toolCall: {
                  id: "tool-reject-1",
                  type: "function",
                  function: {
                    name: "edit_existing_file",
                    arguments: JSON.stringify({
                      filepath: "test.js",
                      changes: "const x = 1;",
                    }),
                  },
                },
                parsedArgs: {
                  filepath: "test.js",
                  changes: "const x = 1;",
                },
                status: "errored", // Tool call is marked as errored due to being disabled
                output: [
                  {
                    icon: "problems",
                    name: "Security Policy Violation",
                    description: "Command Disabled",
                    content: `This command has been disabled by security policy:\n\nedit_existing_file\n\nThis command cannot be executed as it may pose a security risk.`,
                    hidden: false,
                  },
                ],
              },
            ],
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: false,
        id: "session-123",
        mode: "chat",
        streamAborter: expect.any(AbortController),
        contextPercentage: 0.7,
        isPruned: false,
        isInEdit: false,
        title: "New Session",
        lastSessionId: undefined,
        isSessionMetadataLoading: false,
        allSessionMetadata: {
          compiledChatMessages: [
            {
              content: "Please edit this file",
              role: "user",
            },
          ],
          contextPercentage: 0.7,
          didPrune: false,
        },
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
          edit_existing_file: "disabled",
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
        indexing: {
          statuses: {},
          hiddenChatPeekTypes: {
            docs: false,
          },
        },
      },
      tabs: {
        tabsItems: [],
      },
      profiles: {
        organizations: [],
        selectedProfileId: null,
        selectedOrganizationId: null,
        preferencesByProfileId: {},
      },
    });
  });

  it("should handle tool call requiring manual approval", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();

    // Create store with tool settings that require manual approval (ask first)
    const mockStoreWithManualApproval = createMockStore({
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
          search_codebase: "askFirst", // Requires manual approval
        },
        ruleSettings: {},
        showDialog: false,
        dialogMessage: undefined,
      } as any,
    });

    const mockIdeMessengerManual = mockStoreWithManualApproval.mockIdeMessenger;

    // Setup successful compilation
    mockIdeMessengerManual.request.mockResolvedValue({
      status: "success",
      content: {
        compiledChatMessages: [
          { role: "user", content: "Please search the codebase" },
        ],
        didPrune: false,
        contextPercentage: 0.9,
      },
    });

    // Setup streaming generator with tool call requiring approval
    async function* mockStreamGeneratorWithApprovalTool() {
      yield [
        { role: "assistant", content: "I'll search the codebase for you." },
      ];
      yield [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-approval-1",
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

    mockIdeMessengerManual.llmStreamChat.mockReturnValue(
      mockStreamGeneratorWithApprovalTool(),
    );

    // Track isStreaming state changes to ensure it doesn't become false after tool generation
    const streamingStates: boolean[] = [];
    const originalDispatch = mockStoreWithManualApproval.dispatch;
    mockStoreWithManualApproval.dispatch = ((action: any) => {
      const result = originalDispatch(action);
      // Capture isStreaming state after each action
      const currentState =
        mockStoreWithManualApproval.getState().session.isStreaming;
      streamingStates.push(currentState);
      return result;
    }) as any;

    // Execute thunk
    const result = await mockStoreWithManualApproval.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify thunk completed successfully (tool waits for approval)
    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Since tool requires approval, isStreaming should become false after completion
    // but should stay true throughout the initial streaming phase
    const finalStreamingState =
      mockStoreWithManualApproval.getState().session.isStreaming;
    expect(finalStreamingState).toBe(false); // Final state should be false since we're waiting for approval

    // Verify exact action sequence includes tool generation but NO execution
    const dispatchedActions = (mockStoreWithManualApproval as any).getActions();
    expect(dispatchedActions).toEqual([
      {
        type: "chat/streamResponse/pending",
        meta: {
          arg: {
            editorState: mockEditorState,
            modifiers: mockModifiers,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/pending",
        meta: {
          arg: expect.any(Function),
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/submitEditorAndInitAtIndex",
        payload: {
          editorState: mockEditorState,
          index: 1,
        },
      },
      {
        type: "session/resetNextCodeBlockToApplyIndex",
        payload: undefined,
      },
      {
        type: "symbols/updateFromContextItems/pending",
        meta: {
          arg: [],
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/updateHistoryItemAtIndex",
        payload: {
          index: 1,
          updates: {
            contextItems: [],
            message: {
              content: "Hello, please help me with this code",
              id: "mock-uuid-123",
              role: "user",
            },
          },
        },
      },
      {
        type: "chat/streamNormalInput/pending",
        meta: {
          arg: {
            legacySlashCommandData: undefined,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setAppliedRulesAtIndex",
        payload: {
          appliedRules: [],
          index: 1,
        },
      },
      {
        type: "session/setActive",
        payload: undefined,
      },
      {
        type: "session/setInlineErrorMessage",
        payload: undefined,
      },
      {
        type: "session/setIsPruned",
        payload: false,
      },
      {
        type: "session/setContextPercentage",
        payload: 0.9,
      },
      {
        type: "symbols/updateFromContextItems/fulfilled",
        meta: {
          arg: [],
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant",
            content: "I'll search the codebase for you.",
          },
        ],
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "tool-approval-1",
                type: "function",
                function: {
                  name: "search_codebase",
                  arguments: JSON.stringify({ query: "test function" }),
                },
              },
            ],
          },
        ],
      },
      {
        type: "session/addPromptCompletionPair",
        payload: [
          {
            completion: "I'll search the codebase for you.",
            modelProvider: "anthropic",
            prompt: "Please search the codebase",
          },
        ],
      },
      {
        type: "session/setToolGenerated",
        payload: {
          toolCallId: "tool-approval-1",
          tools: [],
        },
      },
      {
        type: "session/setInactive",
        payload: undefined,
      },
      {
        type: "chat/streamNormalInput/fulfilled",
        meta: {
          arg: {
            legacySlashCommandData: undefined,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/saveCurrent/pending",
        meta: {
          arg: {
            generateTitle: true,
            openNewSession: false,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/update/pending",
        meta: {
          arg: expect.objectContaining({
            history: expect.any(Array),
            sessionId: "session-123",
            title: "New Session",
            workspaceDirectory: "",
          }),
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/updateSessionMetadata",
        payload: {
          sessionId: "session-123",
          title: "New Session",
        },
      },
      {
        type: "session/refreshMetadata/pending",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setIsSessionMetadataLoading",
        payload: false,
      },
      {
        type: "session/setAllSessionMetadata",
        payload: {
          compiledChatMessages: [
            {
              content: "Please search the codebase",
              role: "user",
            },
          ],
          contextPercentage: 0.9,
          didPrune: false,
        },
      },
      {
        type: "session/refreshMetadata/fulfilled",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: {
          compiledChatMessages: [
            {
              content: "Please search the codebase",
              role: "user",
            },
          ],
          contextPercentage: 0.9,
          didPrune: false,
        },
      },
      {
        type: "session/update/fulfilled",
        meta: {
          arg: expect.objectContaining({
            history: expect.any(Array),
            sessionId: "session-123",
            title: "New Session",
            workspaceDirectory: "",
          }),
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/saveCurrent/fulfilled",
        meta: {
          arg: {
            generateTitle: true,
            openNewSession: false,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/fulfilled",
        meta: {
          arg: expect.any(Function),
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/streamResponse/fulfilled",
        meta: {
          arg: {
            editorState: mockEditorState,
            modifiers: mockModifiers,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
    ]);

    // Verify IDE messenger calls - compilation should happen, streaming should happen
    expect(mockIdeMessengerManual.request).toHaveBeenCalledWith(
      "llm/compileChat",
      {
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please search the codebase",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Hello, please help me with this code",
              },
            ],
          },
        ],
        options: {
          reasoning: false,
        },
      },
    );

    expect(mockIdeMessengerManual.llmStreamChat).toHaveBeenCalledWith(
      {
        completionOptions: {
          reasoning: false,
        },
        legacySlashCommandData: undefined,
        messageOptions: { precompiled: true },
        messages: [
          {
            role: "user",
            content: "Please search the codebase",
          },
        ],
        title: "Claude 3.5 Sonnet",
      },
      expect.any(AbortSignal),
    );

    // Should NOT call tools/call since tool requires approval
    expect(mockIdeMessengerManual.request).not.toHaveBeenCalledWith(
      "tools/call",
      expect.anything(),
    );

    // Verify session save was called
    expect(mockIdeMessengerManual.request).toHaveBeenCalledWith(
      "history/save",
      expect.anything(),
    );

    // Verify final state contains the tool call in "generated" state (waiting for approval)
    const finalState = mockStoreWithManualApproval.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            contextItems: [],
            message: {
              id: "1",
              role: "user",
              content: "Please search the codebase",
            },
          },
          {
            appliedRules: [],
            contextItems: [],
            editorState: mockEditorState,
            message: {
              content: "Hello, please help me with this code",
              id: expect.any(String),
              role: "user",
            },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content: "I'll search the codebase for you.",
              id: "mock-uuid-123",
              role: "assistant",
              toolCalls: [
                {
                  id: "tool-approval-1",
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
                toolCallId: "tool-approval-1",
                toolCall: {
                  id: "tool-approval-1",
                  type: "function",
                  function: {
                    name: "search_codebase",
                    arguments: JSON.stringify({ query: "test function" }),
                  },
                },
                parsedArgs: { query: "test function" },
                status: "generated", // Waiting for user approval
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
        allSessionMetadata: {
          compiledChatMessages: [
            {
              content: "Please search the codebase",
              role: "user",
            },
          ],
          contextPercentage: 0.9,
          didPrune: false,
        },
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
          search_codebase: "askFirst",
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
        indexing: {
          statuses: {},
          hiddenChatPeekTypes: {
            docs: false,
          },
        },
      },
      tabs: {
        tabsItems: [],
      },
      profiles: {
        organizations: [],
        selectedProfileId: null,
        selectedOrganizationId: null,
        preferencesByProfileId: {},
      },
    });
  });

  it("should handle complete user approval and tool execution flow", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();

    // Create store with tool settings that require manual approval
    const mockStoreWithApproval = createMockStore({
      session: {
        history: [
          {
            message: {
              id: "1",
              role: "user",
              content: "Please search the codebase for test functions",
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
          search_codebase: "askFirst", // Requires manual approval
        },
        ruleSettings: {},
        showDialog: false,
        dialogMessage: undefined,
      } as any,
    });

    const mockIdeMessengerApproval = mockStoreWithApproval.mockIdeMessenger;

    // Setup successful compilation
    mockIdeMessengerApproval.request.mockImplementation(
      (endpoint: string, data: any) => {
        if (endpoint === "llm/compileChat") {
          return Promise.resolve({
            status: "success",
            content: {
              compiledChatMessages: [
                {
                  role: "user",
                  content: "Please search the codebase for test functions",
                },
              ],
              didPrune: false,
              contextPercentage: 0.85,
            },
          });
        } else if (endpoint === "tools/call") {
          // Mock server-side tool call response for search_codebase
          return Promise.resolve({
            status: "success",
            content: {
              contextItems: [
                {
                  name: "Search Results",
                  description: "Found test functions",
                  content:
                    "function testUserLogin() {...}\\nfunction testDataValidation() {...}",
                  icon: "search",
                  hidden: false,
                },
              ],
              errorMessage: undefined,
            },
          });
        } else if (endpoint === "history/save") {
          return Promise.resolve({ status: "success" });
        } else if (endpoint === "history/list") {
          return Promise.resolve({ status: "success", content: [] });
        }
        return Promise.resolve({ status: "success", content: {} });
      },
    );

    // Setup streaming generator with tool call
    async function* mockStreamGeneratorWithApprovalFlow() {
      yield [
        {
          role: "assistant",
          content: "I'll search for test functions in the codebase.",
        },
      ];
      yield [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-approval-flow-1",
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
        prompt: "Please search the codebase for test functions",
        completion: "I'll search for test functions in the codebase.",
        modelProvider: "anthropic",
      };
    }

    // Mock subsequent streaming calls (after tool execution)
    let streamCallCount = 0;
    mockIdeMessengerApproval.llmStreamChat.mockImplementation(() => {
      streamCallCount++;
      if (streamCallCount === 1) {
        // First call - initial streaming with tool call
        return mockStreamGeneratorWithApprovalFlow();
      } else {
        // Subsequent calls from streamResponseAfterToolCall
        async function* followupGenerator() {
          yield [
            {
              role: "assistant",
              content:
                "I found several test functions in your codebase. Here are the main ones I discovered...",
            },
          ];
          return {
            prompt: "continuing after tool execution",
            completion:
              "I found several test functions in your codebase. Here are the main ones I discovered...",
            modelProvider: "anthropic",
          };
        }
        return followupGenerator();
      }
    });

    // Track isStreaming state changes throughout the entire test
    const streamingStateChanges: boolean[] = [];
    let lastStreamingState =
      mockStoreWithApproval.getState().session.isStreaming;
    const originalDispatch = mockStoreWithApproval.dispatch;
    mockStoreWithApproval.dispatch = ((action: any) => {
      const result = originalDispatch(action);
      const currentStreamingState =
        mockStoreWithApproval.getState().session.isStreaming;
      // Only record when the state actually changes
      if (currentStreamingState !== lastStreamingState) {
        streamingStateChanges.push(currentStreamingState);
        lastStreamingState = currentStreamingState;
      }
      return result;
    }) as any;

    // Execute initial thunk - this should generate the tool call but not execute it
    const initialResult = await mockStoreWithApproval.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify initial streaming completed successfully
    expect(initialResult.type).toBe("chat/streamResponse/fulfilled");

    // Verify exact initial action sequence by comparing action types
    const initialActions = (mockStoreWithApproval as any).getActions();

    expect(initialActions).toEqual([
      {
        type: "chat/streamResponse/pending",
        meta: {
          arg: {
            editorState: mockEditorState,
            modifiers: mockModifiers,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/pending",
        meta: {
          arg: expect.any(Function),
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/submitEditorAndInitAtIndex",
        payload: {
          editorState: mockEditorState,
          index: 1,
        },
      },
      {
        type: "session/resetNextCodeBlockToApplyIndex",
        payload: undefined,
      },
      {
        type: "symbols/updateFromContextItems/pending",
        meta: {
          arg: [],
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/updateHistoryItemAtIndex",
        payload: {
          index: 1,
          updates: {
            contextItems: [],
            message: {
              content: "Hello, please help me with this code",
              id: "mock-uuid-123",
              role: "user",
            },
          },
        },
      },
      {
        type: "chat/streamNormalInput/pending",
        meta: {
          arg: {
            legacySlashCommandData: undefined,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setAppliedRulesAtIndex",
        payload: {
          appliedRules: [],
          index: 1,
        },
      },
      {
        type: "session/setActive",
        payload: undefined,
      },
      {
        type: "session/setInlineErrorMessage",
        payload: undefined,
      },
      {
        type: "session/setIsPruned",
        payload: false,
      },
      {
        type: "session/setContextPercentage",
        payload: 0.85,
      },
      {
        type: "symbols/updateFromContextItems/fulfilled",
        meta: {
          arg: [],
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant",
            content: "I'll search for test functions in the codebase.",
          },
        ],
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "tool-approval-flow-1",
                type: "function",
                function: {
                  name: "search_codebase",
                  arguments: JSON.stringify({ query: "test function" }),
                },
              },
            ],
          },
        ],
      },
      {
        type: "session/addPromptCompletionPair",
        payload: [
          {
            completion: "I'll search for test functions in the codebase.",
            modelProvider: "anthropic",
            prompt: "Please search the codebase for test functions",
          },
        ],
      },
      {
        type: "session/setToolGenerated",
        payload: {
          toolCallId: "tool-approval-flow-1",
          tools: [],
        },
      },
      {
        type: "session/setInactive",
        payload: undefined,
      },
      {
        type: "chat/streamNormalInput/fulfilled",
        meta: {
          arg: {
            legacySlashCommandData: undefined,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/saveCurrent/pending",
        meta: {
          arg: {
            generateTitle: true,
            openNewSession: false,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/update/pending",
        meta: {
          arg: expect.objectContaining({
            history: expect.any(Array),
            sessionId: "session-123",
            title: "New Session",
            workspaceDirectory: "",
          }),
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/updateSessionMetadata",
        payload: {
          sessionId: "session-123",
          title: "New Session",
        },
      },
      {
        type: "session/refreshMetadata/pending",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setIsSessionMetadataLoading",
        payload: false,
      },
      {
        type: "session/setAllSessionMetadata",
        payload: [],
      },
      {
        type: "session/refreshMetadata/fulfilled",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: [],
      },
      {
        type: "session/update/fulfilled",
        meta: {
          arg: expect.objectContaining({
            history: expect.any(Array),
            sessionId: "session-123",
            title: "New Session",
            workspaceDirectory: "",
          }),
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/saveCurrent/fulfilled",
        meta: {
          arg: {
            generateTitle: true,
            openNewSession: false,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/fulfilled",
        meta: {
          arg: expect.any(Function),
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/streamResponse/fulfilled",
        meta: {
          arg: {
            editorState: mockEditorState,
            modifiers: mockModifiers,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
    ]);

    // Clear the actions array to track only the approval flow
    (mockStoreWithApproval as any).clearActions();

    // Import the callToolById thunk to simulate user approval
    const { callToolById } = await import("./callToolById");

    // Simulate user clicking "Accept" on the tool call
    const approvalResult = await mockStoreWithApproval.dispatch(
      callToolById({ toolCallId: "tool-approval-flow-1" }) as any,
    );

    // Verify tool execution completed successfully
    expect(approvalResult.type).toBe("chat/callTool/fulfilled");

    // Verify exact approval flow actions
    const approvalActions = (mockStoreWithApproval as any).getActions();
    expect(approvalActions).toEqual([
      {
        type: "chat/callTool/pending",
        meta: {
          arg: { toolCallId: "tool-approval-flow-1" },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setToolCallCalling",
        payload: { toolCallId: "tool-approval-flow-1" },
      },
      {
        type: "session/updateToolCallOutput",
        payload: {
          toolCallId: "tool-approval-flow-1",
          contextItems: [
            {
              name: "Search Results",
              description: "Found test functions",
              content:
                "function testUserLogin() {...}\\nfunction testDataValidation() {...}",
              icon: "search",
              hidden: false,
            },
          ],
        },
      },
      {
        type: "session/acceptToolCall",
        payload: { toolCallId: "tool-approval-flow-1" },
      },
      {
        type: "chat/streamAfterToolCall/pending",
        meta: {
          arg: {
            toolCallId: "tool-approval-flow-1",
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/pending",
        meta: {
          arg: expect.any(Function),
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/resetNextCodeBlockToApplyIndex",
        payload: undefined,
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            content:
              "function testUserLogin() {...}\\nfunction testDataValidation() {...}",
            role: "tool",
            toolCallId: "tool-approval-flow-1",
          },
        ],
      },
      {
        type: "chat/streamNormalInput/pending",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setAppliedRulesAtIndex",
        payload: {
          appliedRules: [],
          index: 1,
        },
      },
      {
        type: "session/setActive",
        payload: undefined,
      },
      {
        type: "session/setInlineErrorMessage",
        payload: undefined,
      },
      {
        type: "session/setIsPruned",
        payload: false,
      },
      {
        type: "session/setContextPercentage",
        payload: 0.85,
      },
      {
        type: "session/streamUpdate",
        payload: [
          {
            role: "assistant",
            content:
              "I found several test functions in your codebase. Here are the main ones I discovered...",
          },
        ],
      },
      {
        type: "session/addPromptCompletionPair",
        payload: [
          {
            completion:
              "I found several test functions in your codebase. Here are the main ones I discovered...",
            modelProvider: "anthropic",
            prompt: "continuing after tool execution",
          },
        ],
      },
      {
        type: "session/setInactive",
        payload: undefined,
      },
      {
        type: "chat/streamNormalInput/fulfilled",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/saveCurrent/pending",
        meta: {
          arg: {
            generateTitle: true,
            openNewSession: false,
          },
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/update/pending",
        meta: {
          arg: expect.objectContaining({
            history: expect.any(Array),
            sessionId: "session-123",
            title: "New Session",
            workspaceDirectory: "",
          }),
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/updateSessionMetadata",
        payload: {
          sessionId: "session-123",
          title: "New Session",
        },
      },
      {
        type: "session/refreshMetadata/pending",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setIsSessionMetadataLoading",
        payload: false,
      },
      {
        type: "session/setAllSessionMetadata",
        payload: [],
      },
      {
        type: "session/refreshMetadata/fulfilled",
        meta: {
          arg: {},
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: [],
      },
      {
        type: "session/update/fulfilled",
        meta: {
          arg: expect.objectContaining({
            history: expect.any(Array),
            sessionId: "session-123",
            title: "New Session",
            workspaceDirectory: "",
          }),
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "session/saveCurrent/fulfilled",
        meta: {
          arg: {
            generateTitle: true,
            openNewSession: false,
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/fulfilled",
        meta: {
          arg: expect.any(Function),
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/streamAfterToolCall/fulfilled",
        meta: {
          arg: {
            toolCallId: "tool-approval-flow-1",
          },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/callTool/fulfilled",
        meta: {
          arg: { toolCallId: "tool-approval-flow-1" },
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
    ]);

    // Verify telemetry events for manual approval flow
    // Use partial matching to allow additional fields (e.g. model) in payload
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      "tool_call_decision",
      expect.objectContaining({
        decision: "accept",
        toolName: "search_codebase",
        toolCallId: "tool-approval-flow-1",
      }),
    );

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      "tool_call_outcome",
      expect.objectContaining({
        succeeded: true,
        toolName: "search_codebase",
        errorReason: undefined,
        duration_ms: expect.any(Number),
      }),
    );

    // Verify IDE messenger calls for tool execution
    expect(mockIdeMessengerApproval.request).toHaveBeenCalledWith(
      "tools/call",
      {
        toolCall: {
          id: "tool-approval-flow-1",
          type: "function",
          function: {
            name: "search_codebase",
            arguments: JSON.stringify({ query: "test function" }),
          },
        },
      },
    );

    // Verify second streaming call was made for continuation
    expect(streamCallCount).toBe(2);

    // Verify final state shows completed tool call and follow-up response
    const finalState = mockStoreWithApproval.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            contextItems: [],
            message: {
              id: "1",
              role: "user",
              content: "Please search the codebase for test functions",
            },
          },
          {
            appliedRules: [],
            contextItems: [],
            editorState: mockEditorState,
            message: {
              content: "Hello, please help me with this code",
              id: expect.any(String),
              role: "user",
            },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content: "I'll search for test functions in the codebase.",
              id: expect.any(String),
              role: "assistant",
              toolCalls: [
                {
                  id: "tool-approval-flow-1",
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
                completion: "I'll search for test functions in the codebase.",
                modelProvider: "anthropic",
                prompt: "Please search the codebase for test functions",
              },
            ],
            toolCallStates: [
              {
                toolCallId: "tool-approval-flow-1",
                toolCall: {
                  id: "tool-approval-flow-1",
                  type: "function",
                  function: {
                    name: "search_codebase",
                    arguments: JSON.stringify({ query: "test function" }),
                  },
                },
                parsedArgs: { query: "test function" },
                status: "done", // Tool call completed successfully
                output: [
                  {
                    name: "Search Results",
                    description: "Found test functions",
                    content:
                      "function testUserLogin() {...}\\nfunction testDataValidation() {...}",
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
              content:
                "function testUserLogin() {...}\\nfunction testDataValidation() {...}",
              id: expect.any(String),
              role: "tool",
              toolCallId: "tool-approval-flow-1",
            },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content:
                "I found several test functions in your codebase. Here are the main ones I discovered...",
              id: "mock-uuid-123",
              role: "assistant",
            },
            promptLogs: [
              {
                completion:
                  "I found several test functions in your codebase. Here are the main ones I discovered...",
                modelProvider: "anthropic",
                prompt: "continuing after tool execution",
              },
            ],
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: false, // Inactive after complete flow
        id: "session-123",
        mode: "chat",
        streamAborter: expect.any(AbortController),
        contextPercentage: 0.85,
        isPruned: false,
        isInEdit: false,
        title: "New Session",
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
        toolSettings: {
          search_codebase: "askFirst",
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
        indexing: {
          statuses: {},
          hiddenChatPeekTypes: {
            docs: false,
          },
        },
      },
      tabs: {
        tabsItems: [],
      },
      profiles: {
        organizations: [],
        selectedProfileId: null,
        selectedOrganizationId: null,
        preferencesByProfileId: {},
      },
    });
  });

  describe("dynamic policy evaluation", () => {
    it("should call tools/evaluatePolicy with correct parameters", async () => {
      const mockStore = createMockStore({
        session: {
          history: [
            {
              message: { id: "1", role: "user", content: "Run echo hello" },
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
            run_terminal_command: "allowedWithoutPermission",
          },
          ruleSettings: {},
          showDialog: false,
          dialogMessage: undefined,
        } as any,
      } as any);

      const mockIdeMessenger = mockStore.mockIdeMessenger;

      // Simple mock - just return a different policy for testing
      mockIdeMessenger.request.mockImplementation(
        (endpoint: string, data: any) => {
          if (endpoint === "tools/evaluatePolicy") {
            // For this test, simulate that echo commands require permission
            if (data.args.command?.toLowerCase().startsWith("echo")) {
              return Promise.resolve({
                status: "success",
                content: { policy: "allowedWithPermission" },
              });
            }
            return Promise.resolve({
              status: "success",
              content: { policy: data.basePolicy },
            });
          } else if (endpoint === "llm/compileChat") {
            return Promise.resolve({
              status: "success",
              content: {
                compiledChatMessages: [
                  { role: "user", content: "Run echo hello" },
                ],
                didPrune: false,
                contextPercentage: 0.5,
              },
            });
          } else if (endpoint === "history/save") {
            return Promise.resolve({ status: "success" });
          } else if (endpoint === "history/list") {
            return Promise.resolve({ status: "success", content: [] });
          }
          return Promise.resolve({ status: "success", content: {} });
        },
      );

      // Setup streaming with echo command (should require permission despite auto-approve base)
      async function* mockStreamWithEcho() {
        yield [{ role: "assistant", content: "I'll run the echo command." }];
        yield [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "tool-echo-1",
                type: "function",
                function: {
                  name: "run_terminal_command",
                  arguments: JSON.stringify({ command: "echo hello" }),
                },
              },
            ],
          },
        ];
        return {
          prompt: "Run echo hello",
          completion: "I'll run the echo command.",
          modelProvider: "anthropic",
        };
      }

      mockIdeMessenger.llmStreamChat.mockReturnValue(mockStreamWithEcho());

      // Execute thunk
      await mockStore.dispatch(
        streamResponseThunk({
          editorState: mockEditorState,
          modifiers: mockModifiers,
        }) as any,
      );

      // Just verify the call was made with correct params
      expect(mockIdeMessenger.request).toHaveBeenCalledWith(
        "tools/evaluatePolicy",
        expect.objectContaining({
          toolName: "run_terminal_command",
          basePolicy: "allowedWithoutPermission",
          args: { command: "echo hello" },
        }),
      );

      // Verify tool wasn't auto-executed (policy changed to require permission)
      expect(mockIdeMessenger.request).not.toHaveBeenCalledWith(
        "tools/call",
        expect.any(Object),
      );
    });

    it("should respect disabled policy", async () => {
      const mockStore = createMockStore({
        session: {
          history: [
            {
              message: { id: "1", role: "user", content: "Run ls" },
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
            run_terminal_command: "disabled", // Tool is disabled
          },
          ruleSettings: {},
          showDialog: false,
          dialogMessage: undefined,
        } as any,
      } as any);

      const mockIdeMessenger = mockStore.mockIdeMessenger;

      // Simple mock - just return disabled policy
      mockIdeMessenger.request.mockImplementation(
        (endpoint: string, data: any) => {
          if (endpoint === "tools/evaluatePolicy") {
            // Backend should respect disabled state
            return Promise.resolve({
              status: "success",
              content: { policy: "disabled" },
            });
          } else if (endpoint === "llm/compileChat") {
            return Promise.resolve({
              status: "success",
              content: {
                compiledChatMessages: [{ role: "user", content: "Run ls" }],
                didPrune: false,
                contextPercentage: 0.5,
              },
            });
          } else if (endpoint === "history/save") {
            return Promise.resolve({ status: "success" });
          } else if (endpoint === "history/list") {
            return Promise.resolve({ status: "success", content: [] });
          }
          return Promise.resolve({ status: "success", content: {} });
        },
      );

      // Setup streaming with regular command
      async function* mockStreamWithLs() {
        yield [{ role: "assistant", content: "I'll list the files." }];
        yield [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "tool-ls-1",
                type: "function",
                function: {
                  name: "run_terminal_command",
                  arguments: JSON.stringify({ command: "ls" }),
                },
              },
            ],
          },
        ];
        return {
          prompt: "Run ls",
          completion: "I'll list the files.",
          modelProvider: "anthropic",
        };
      }

      mockIdeMessenger.llmStreamChat.mockReturnValue(mockStreamWithLs());

      // Execute thunk
      await mockStore.dispatch(
        streamResponseThunk({
          editorState: mockEditorState,
          modifiers: mockModifiers,
        }) as any,
      );

      // Verify tools/evaluatePolicy was called
      expect(mockIdeMessenger.request).toHaveBeenCalledWith(
        "tools/evaluatePolicy",
        expect.objectContaining({
          toolName: "run_terminal_command",
          basePolicy: "disabled",
          args: { command: "ls" },
        }),
      );

      // Tool should NOT be executed since it's disabled
      expect(mockIdeMessenger.request).not.toHaveBeenCalledWith(
        "tools/call",
        expect.any(Object),
      );
    });

    it("should handle evaluation errors gracefully", async () => {
      const mockStore = createMockStore({
        session: {
          history: [
            {
              message: { id: "1", role: "user", content: "Do something" },
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
            some_tool: "allowedWithoutPermission",
          },
          ruleSettings: {},
          showDialog: false,
          dialogMessage: undefined,
        } as any,
      } as any);

      const mockIdeMessenger = mockStore.mockIdeMessenger;

      // Mock evaluation failure
      mockIdeMessenger.request.mockImplementation((endpoint: string) => {
        if (endpoint === "tools/evaluatePolicy") {
          // Simulate evaluation error
          return Promise.resolve({
            status: "error",
            error: "Failed to evaluate policy",
          });
        } else if (endpoint === "llm/compileChat") {
          return Promise.resolve({
            status: "success",
            content: {
              compiledChatMessages: [{ role: "user", content: "Do something" }],
              didPrune: false,
              contextPercentage: 0.5,
            },
          });
        } else if (endpoint === "history/save") {
          return Promise.resolve({ status: "success" });
        } else if (endpoint === "history/list") {
          return Promise.resolve({ status: "success", content: [] });
        }
        return Promise.resolve({ status: "success", content: {} });
      });

      // Setup streaming with tool call
      async function* mockStreamWithTool() {
        yield [{ role: "assistant", content: "I'll help you." }];
        yield [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "tool-1",
                type: "function",
                function: {
                  name: "some_tool",
                  arguments: JSON.stringify({ arg: "value" }),
                },
              },
            ],
          },
        ];
        return {
          prompt: "Do something",
          completion: "I'll help you.",
          modelProvider: "anthropic",
        };
      }

      mockIdeMessenger.llmStreamChat.mockReturnValue(mockStreamWithTool());

      // Execute thunk - should handle error gracefully
      const result = await mockStore.dispatch(
        streamResponseThunk({
          editorState: mockEditorState,
          modifiers: mockModifiers,
        }) as any,
      );

      // Should complete successfully despite evaluation error
      expect(result.type).toBe("chat/streamResponse/fulfilled");

      // Tool should be treated as disabled due to evaluation error
      expect(mockIdeMessenger.request).not.toHaveBeenCalledWith(
        "tools/call",
        expect.any(Object),
      );
    });

    it("should properly handle disabled commands and show error status", async () => {
      const { mockStore, mockIdeMessenger } = setupTest();

      // Setup store with runTerminalCommand tool
      const mockStoreWithTerminalTool = createMockStore({
        ...mockStore.getState(),
        config: {
          ...mockStore.getState().config,
          config: {
            ...mockStore.getState().config.config,
            tools: [
              {
                type: "function",
                displayTitle: "Run Terminal Command",
                function: {
                  name: "runTerminalCommand",
                  description: "Execute a terminal command",
                  parameters: {
                    type: "object",
                    properties: {
                      command: {
                        type: "string",
                        description: "The command to execute",
                      },
                    },
                    required: ["command"],
                  },
                },
                defaultToolPolicy: "allowedWithPermission",
                readonly: false,
                group: "code",
              },
            ],
          },
        },
        ui: {
          ...mockStore.getState().ui,
          toolSettings: {
            runTerminalCommand: "allowedWithPermission",
          },
        },
      });

      const mockTerminalIdeMessenger =
        mockStoreWithTerminalTool.mockIdeMessenger;

      // Setup compilation and policy evaluation responses
      mockTerminalIdeMessenger.request.mockImplementation(
        (endpoint: string, data: any) => {
          if (endpoint === "llm/compileChat") {
            return Promise.resolve({
              status: "success",
              content: {
                compiledChatMessages: [
                  { role: "user", content: "Run eval command" },
                ],
                didPrune: false,
                contextPercentage: 0.9,
              },
            });
          } else if (endpoint === "tools/evaluatePolicy") {
            // Return disabled for eval command
            const args = data.args || {};
            if (args.command && args.command.includes("eval")) {
              return Promise.resolve({
                status: "success",
                content: { policy: "disabled" },
              });
            }
            return Promise.resolve({
              status: "success",
              content: { policy: "allowedWithPermission" },
            });
          } else if (endpoint === "history/save") {
            return Promise.resolve({ status: "success" });
          } else if (endpoint === "history/list") {
            return Promise.resolve({ status: "success", content: [] });
          }
          return Promise.resolve({ status: "success", content: {} });
        },
      );

      // Setup streaming with eval command tool call
      async function* mockStreamWithEvalCommand() {
        yield [
          { role: "assistant", content: "I'll run the eval command for you." },
        ];
        yield [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "tool-call-eval",
                type: "function",
                function: {
                  name: "runTerminalCommand",
                  arguments: JSON.stringify({ command: 'eval "echo hello"' }),
                },
              },
            ],
          },
        ];
        return {
          prompt: "Run eval command",
          completion: "I'll run the eval command for you.",
          modelProvider: "anthropic",
        };
      }

      mockTerminalIdeMessenger.llmStreamChat.mockReturnValue(
        mockStreamWithEvalCommand(),
      );

      // Execute thunk
      await mockStoreWithTerminalTool.dispatch(
        streamResponseThunk({
          editorState: mockEditorState,
          modifiers: mockModifiers,
        }) as any,
      );

      // Get final state
      const finalState = mockStoreWithTerminalTool.getState();
      const toolCallStates = finalState.session.history.flatMap(
        (item) => item.toolCallStates || [],
      );

      // Find the eval command tool call
      const evalToolCall = toolCallStates.find(
        (t) => t.toolCallId === "tool-call-eval",
      );

      expect(evalToolCall).toBeDefined();

      // The tool call should have an errored status (not "generated")
      expect(evalToolCall?.status).toBe("errored");

      // The tool call should have an error message explaining it's disabled
      // Errors are stored as ContextItems with the error in the content
      const errorOutput = evalToolCall?.output?.[0];
      expect(errorOutput?.content).toContain("disabled");

      // Verify the command was NOT executed (no tool/call request)
      const toolCallRequests =
        mockTerminalIdeMessenger.request.mock.calls.filter(
          (call) => call[0] === "tools/call",
        );
      expect(toolCallRequests).toHaveLength(0);
    });
  });
});
