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

describe("streamResponseThunk", () => {
  it("should execute complete streaming flow with all dispatches", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();

    // Mock all necessary IDE messenger calls
    mockIdeMessenger.request.mockImplementation((endpoint: string) => {
      if (endpoint === "llm/compileChat") {
        return Promise.resolve({
          status: "success",
          content: {
            compiledChatMessages: [{ role: "user", content: "Hello" }],
            didPrune: false,
            contextPercentage: 0.8,
          },
        });
      } else if (endpoint === "history/save") {
        return Promise.resolve({ status: "success" });
      } else if (endpoint === "session/refreshMetadata") {
        return Promise.resolve({
          status: "success",
          content: {
            compiledChatMessages: [{ role: "user", content: "Hello" }],
            didPrune: false,
            contextPercentage: 0.8,
          },
        });
      }
      return Promise.resolve({ status: "success", content: {} });
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
    const result = await mockStore.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify exact sequence of dispatched actions with payloads
    const dispatchedActions = (mockStore as any).getActions();

    expect(dispatchedActions).toEqual([
      {
        type: "chat/streamResponse/pending",
        meta: expect.objectContaining({
          arg: { editorState: mockEditorState, modifiers: mockModifiers },
          requestStatus: "pending",
        }),
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/pending",
        meta: expect.objectContaining({
          requestStatus: "pending",
        }),
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
        meta: expect.objectContaining({
          arg: [],
          requestStatus: "pending",
        }),
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
        meta: expect.objectContaining({
          arg: { legacySlashCommandData: undefined },
          requestStatus: "pending",
        }),
        payload: undefined,
      },
      {
        type: "session/setAppliedRulesAtIndex",
        payload: {
          index: 1,
          appliedRules: [],
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
        payload: 0.8,
      },
      {
        type: "symbols/updateFromContextItems/fulfilled",
        meta: expect.objectContaining({
          arg: [],
          requestStatus: "fulfilled",
        }),
        payload: undefined,
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
        payload: undefined,
      },
      {
        type: "chat/streamNormalInput/fulfilled",
        meta: expect.objectContaining({
          arg: { legacySlashCommandData: undefined },
          requestStatus: "fulfilled",
        }),
        payload: undefined,
      },
      {
        type: "session/saveCurrent/pending",
        meta: expect.objectContaining({
          arg: { generateTitle: true, openNewSession: false },
          requestStatus: "pending",
        }),
        payload: undefined,
      },
      {
        type: "session/update/pending",
        meta: expect.objectContaining({
          requestStatus: "pending",
        }),
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
        meta: expect.objectContaining({
          requestStatus: "pending",
        }),
        payload: undefined,
      },
      {
        type: "session/setIsSessionMetadataLoading",
        payload: false,
      },
      {
        type: "session/setAllSessionMetadata",
        payload: {},
      },
      {
        type: "session/refreshMetadata/fulfilled",
        meta: expect.objectContaining({
          requestStatus: "fulfilled",
        }),
        payload: {},
      },
      {
        type: "session/update/fulfilled",
        meta: expect.objectContaining({
          requestStatus: "fulfilled",
        }),
        payload: undefined,
      },
      {
        type: "session/saveCurrent/fulfilled",
        meta: expect.objectContaining({
          arg: { generateTitle: true, openNewSession: false },
          requestStatus: "fulfilled",
        }),
        payload: undefined,
      },
      {
        type: "chat/streamWrapper/fulfilled",
        meta: expect.objectContaining({
          requestStatus: "fulfilled",
        }),
        payload: undefined,
      },
      {
        type: "chat/streamResponse/fulfilled",
        meta: expect.objectContaining({
          arg: { editorState: mockEditorState, modifiers: mockModifiers },
          requestStatus: "fulfilled",
        }),
        payload: undefined,
      },
    ]);

    // Verify IDE messenger calls
    expect(mockIdeMessenger.request).toHaveBeenCalledWith("llm/compileChat", {
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
              text: "Hello",
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
    });

    expect(mockIdeMessenger.llmStreamChat).toHaveBeenCalledWith(
      {
        completionOptions: {
          reasoning: false,
        },
        legacySlashCommandData: undefined,
        messageOptions: { precompiled: true },
        messages: [
          {
            role: "user",
            content: "Hello",
          },
        ],
        title: "Claude 3.5 Sonnet",
      },
      expect.any(AbortSignal),
    );

    // Verify dev data logging call
    expect(mockIdeMessenger.post).toHaveBeenCalledWith("devdata/log", {
      name: "chatInteraction",
      data: {
        prompt: "Hello",
        completion: "Hi there!",
        modelProvider: "anthropic",
        modelName: "Claude 3.5 Sonnet",
        modelTitle: "Claude 3.5 Sonnet",
        sessionId: "session-123",
      },
    });

    // Verify session save was called
    expect(mockIdeMessenger.request).toHaveBeenCalledWith(
      "history/save",
      expect.anything(),
    );

    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Verify final state after thunk completion
    const finalState = mockStore.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            contextItems: [],
            message: { id: "1", role: "user", content: "Hello" },
          },
          {
            appliedRules: [],
            contextItems: [],
            editorState: mockEditorState,
            message: {
              content: "Hello, please help me with this code",
              id: "mock-uuid-123",
              role: "user",
            },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content: "First chunkSecond chunk", // Chunks get combined
              id: "mock-uuid-123",
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

    // Execute thunk
    const result = await mockStoreWithToolSettings.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

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

    // Verify final state after tool call execution
    const finalState = mockStoreWithToolSettings.getState();
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

  it("should handle streaming abort", async () => {
    // Create an AbortController that we'll abort during streaming
    const testAbortController = new AbortController();

    // Use setupTest to get proper mock configuration
    const { mockStore: baseStore, mockIdeMessenger: baseMessenger } =
      setupTest();

    // Create store with our test abort controller, starting from setupTest config
    const mockStoreWithAbort = createMockStore({
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
        streamAborter: testAbortController, // Use our test controller
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

    const mockIdeMessengerAbort = mockStoreWithAbort.mockIdeMessenger;

    // Setup successful compilation
    mockIdeMessengerAbort.request.mockResolvedValue({
      status: "success",
      content: {
        compiledChatMessages: [{ role: "user", content: "Hello" }],
        didPrune: false,
        contextPercentage: 0.8,
      },
    });

    // Setup streaming generator that simulates abort by user interaction
    async function* mockStreamGeneratorWithAbort() {
      yield [{ role: "assistant", content: "First chunk" }];

      // Add a delay to allow the first chunk to be processed
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Simulate user clicking abort button - dispatch setInactive immediately
      mockStoreWithAbort.dispatch({ type: "session/setInactive" });

      // Add a small delay to let the abort action be processed
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Try to yield second chunk (should be ignored due to abort)
      yield [{ role: "assistant", content: "Second chunk" }];

      return {
        prompt: "Hello",
        completion: "Complete response",
        modelProvider: "anthropic",
      };
    }

    mockIdeMessengerAbort.llmStreamChat.mockReturnValue(
      mockStreamGeneratorWithAbort(),
    );

    // Execute thunk - should be aborted
    const result = await mockStoreWithAbort.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify thunk completed successfully (abort just stops streaming early)
    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Verify exact action sequence - should start but then be aborted
    const dispatchedActions = (mockStoreWithAbort as any).getActions();
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
        payload: 0.8,
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
            content: "First chunk",
          },
        ],
      },
      // User abort action (dispatched by the test)
      {
        type: "session/setInactive",
      },
      // Stream abort dispatch (called by implementation)
      {
        type: "session/abortStream",
        payload: undefined,
      },
      // Stream end cleanup
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
              content: "Hello",
              role: "user",
            },
          ],
          contextPercentage: 0.8,
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
              content: "Hello",
              role: "user",
            },
          ],
          contextPercentage: 0.8,
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

    // Verify IDE messenger calls
    expect(mockIdeMessengerAbort.request).toHaveBeenCalledWith(
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
                text: "Hello",
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

    expect(mockIdeMessengerAbort.llmStreamChat).toHaveBeenCalledWith(
      {
        completionOptions: {
          reasoning: false,
        },
        legacySlashCommandData: undefined,
        messageOptions: { precompiled: true },
        messages: [
          {
            role: "user",
            content: "Hello",
          },
        ],
        title: "Claude 3.5 Sonnet",
      },
      expect.any(AbortSignal),
    );

    // Dev data logging should not occur since streaming was stopped early
    expect(mockIdeMessengerAbort.post).not.toHaveBeenCalledWith(
      "devdata/log",
      expect.anything(),
    );

    // Verify session save was called despite abort
    expect(mockIdeMessengerAbort.request).toHaveBeenCalledWith(
      "history/save",
      expect.anything(),
    );

    // Verify final state - streaming should be stopped, partial content preserved
    const finalState = mockStoreWithAbort.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            contextItems: [],
            message: { id: "1", role: "user", content: "Hello" },
          },
          {
            appliedRules: [],
            contextItems: [],
            editorState: mockEditorState,
            message: {
              content: "Hello, please help me with this code",
              id: "mock-uuid-123",
              role: "user",
            },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content: "First chunk", // Only first chunk before abort
              id: "mock-uuid-123",
              role: "assistant",
            },
            // No promptLogs because streaming was stopped before completion
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: false, // False because setInactive was called
        id: "session-123",
        mode: "chat",
        streamAborter: expect.any(AbortController), // New controller after abort
        contextPercentage: 0.8,
        isPruned: false,
        isInEdit: false,
        title: "New Session",
        lastSessionId: undefined,
        isSessionMetadataLoading: false,
        allSessionMetadata: {
          compiledChatMessages: [
            {
              content: "Hello",
              role: "user",
            },
          ],
          contextPercentage: 0.8,
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
});
