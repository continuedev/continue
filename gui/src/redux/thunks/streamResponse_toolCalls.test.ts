import { JSONContent } from "@tiptap/core";
import { AssistantChatMessage, InputModifiers, PromptLog } from "core";
import { describe, expect, it, vi } from "vitest";
import { createMockStore } from "../../util/test/mockStore";
import { streamResponseThunk } from "./streamResponse";

// Mock system message construction to keep test readable
vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(),
}));

import { getBaseSystemMessage } from "../util/getBaseSystemMessage";

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
import { serializeTool } from "core/tools";
import {
  editFileTool,
  grepSearchTool,
  runTerminalCommandTool,
} from "core/tools/definitions";
import posthog from "posthog-js";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { RootState } from "../store";
import { getRootStateWithClaude } from "./streamResponse.test";

const grepTool = serializeTool(grepSearchTool);
const grepName = grepTool.function.name;
const editTool = serializeTool(editFileTool);
const editName = editTool.function.name;
const terminalTool = serializeTool(runTerminalCommandTool);
const terminalName = terminalTool.function.name;

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

beforeEach(() => {
  vi.clearAllMocks();
  // Default mock for resolveEditorContent (can be overridden in individual tests)
  mockResolveEditorContent.mockResolvedValue({
    selectedContextItems: [],
    selectedCode: [],
    content: "Hello, please help me with this code",
    legacyCommandWithInput: undefined,
  });

  mockGetBaseSystemMessage.mockReturnValue("You are a helpful assistant.");
});

describe("streamResponseThunk - tool calls", () => {
  it("should execute streaming flow with tool call execution", async () => {
    // Set up auto-approved tool setting for our test tool
    const initialState = getRootStateWithClaude();
    initialState.session.history = [
      {
        message: {
          id: "1",
          role: "user",
          content: "Please search the codebase",
        },
        contextItems: [],
      },
    ];
    initialState.ui.toolSettings = {
      [grepName]: "allowedWithoutPermission", // Auto-approve this tool
    };
    initialState.session.id = "session-123";
    initialState.config.config.tools = [grepTool];
    const mockStoreWithToolSettings = createMockStore(initialState);
    const mockIdeMessengerWithTool = mockStoreWithToolSettings.mockIdeMessenger;

    const requestSpy = vi.spyOn(mockIdeMessengerWithTool, "request");

    mockIdeMessengerWithTool.responses["llm/compileChat"] = {
      compiledChatMessages: [
        { role: "user", content: "Please search the codebase" },
      ],
      didPrune: false,
      contextPercentage: 0.9,
    };
    mockIdeMessengerWithTool.responses["tools/call"] = {
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
    };

    // Setup streaming generator with tool call
    async function* mockStreamGeneratorWithTool(): AsyncGenerator<
      AssistantChatMessage[],
      PromptLog
    > {
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
                name: grepName,
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
        modelTitle: "Claude 3.5 Sonnet",
      };
    }

    // Mock different streaming responses for multiple calls
    let streamCallCount = 0;
    const mockStreamChat = vi.fn().mockImplementation(() => {
      streamCallCount++;
      if (streamCallCount === 1) {
        // First call - main streaming with tool call
        return mockStreamGeneratorWithTool();
      } else {
        // Subsequent calls from streamResponseAfterToolCall - return minimal response
        async function* simpleGenerator(): AsyncGenerator<
          AssistantChatMessage[],
          PromptLog
        > {
          yield [{ role: "assistant", content: "Search completed." }];
          return {
            prompt: "continuing after tool",
            completion: "Search completed.",
            modelProvider: "anthropic",
            modelTitle: "Claude 3.5 Sonnet",
          };
        }
        return simpleGenerator();
      }
    });

    mockIdeMessengerWithTool.llmStreamChat = mockStreamChat;

    // Track isStreaming state changes to detect UI flashing during auto-approved tool execution
    const streamingStateChanges: boolean[] = [];
    let lastStreamingState = (mockStoreWithToolSettings.getState() as RootState)
      .session.isStreaming;
    // Record the initial state
    streamingStateChanges.push(lastStreamingState);

    // Subscribe to store changes to catch ALL state updates
    const unsubscribe = mockStoreWithToolSettings.subscribe(() => {
      const currentState = (mockStoreWithToolSettings.getState() as RootState)
        .session.isStreaming;
      if (currentState !== lastStreamingState) {
        console.log(
          `Store subscription: isStreaming changed from ${lastStreamingState} to ${currentState}`,
        );
        streamingStateChanges.push(currentState);
        lastStreamingState = currentState;
      }
    });

    // // Execute thunk
    const result = await mockStoreWithToolSettings.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Debug: check what happened
    const debugState = mockStoreWithToolSettings.getState() as RootState;
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
    expect(streamingStateChanges).toEqual([false, true, false]);

    // Verify key actions are dispatched (tool calls trigger a complex cascade, so we verify key actions exist)
    const dispatchedActions = mockStoreWithToolSettings.getActions();

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
              name: grepName,
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
        modelTitle: "Claude 3.5 Sonnet",
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
    expect(requestSpy).toHaveBeenCalledWith("llm/compileChat", {
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
        tools: [grepTool],
      },
    });

    expect(requestSpy).toHaveBeenCalledWith("tools/call", {
      toolCall: {
        id: "tool-call-1",
        type: "function",
        function: {
          name: grepName,
          arguments: JSON.stringify({ query: "test function" }),
        },
      },
    });

    // Verify that multiple compilation calls were made (due to tool call continuation)
    const compileCallsCount = requestSpy.mock.calls.filter(
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
        toolName: grepName,
        toolCallId: "tool-call-1",
      }),
    );

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      "tool_call_outcome",
      expect.objectContaining({
        succeeded: true,
        toolName: grepName,
        errorReason: undefined,
        duration_ms: expect.any(Number),
      }),
    );

    // Verify final state after tool call execution
    const finalState = mockStoreWithToolSettings.getState() as RootState;

    // Check that the tool was executed (status should be 'done' if auto-approved and executed)
    const toolCallState = finalState.session.history.find(
      (item) => item.toolCallStates && item.toolCallStates.length > 0,
    )?.toolCallStates?.[0];

    // With proper mocking, the tool should be auto-executed
    expect(toolCallState?.status).toBe("done");
    expect(toolCallState?.output).toBeDefined();

    expect(finalState).toEqual({
      ...initialState,
      session: {
        ...initialState.session,
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
                    name: grepName,
                    arguments: JSON.stringify({ query: "test function" }),
                  },
                },
              ],
            },
            promptLogs: [
              {
                completion: "I'll search the codebase for you.",
                modelProvider: "anthropic",
                modelTitle: "Claude 3.5 Sonnet",
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
                    name: grepName,
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
                tool: grepTool,
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
                modelTitle: "Claude 3.5 Sonnet",
                prompt: "continuing after tool",
              },
            ],
          },
        ],
        id: "session-123",
        streamAborter: expect.any(AbortController),
        contextPercentage: 0.9,
        isPruned: false,
        title: "Session summary",
        inlineErrorMessage: undefined,
      },
    });
  });

  it("should handle tool call requiring manual approval", async () => {
    // Create store with tool settings that require manual approval (ask first)
    const initialState = getRootStateWithClaude();
    initialState.session.history = [
      {
        message: {
          id: "1",
          role: "user",
          content: "Please search the codebase",
        },
        contextItems: [],
      },
    ];
    initialState.session.id = "session-123";
    initialState.ui.toolSettings = {
      [grepName]: "allowedWithPermission", // Requires manual approval
    };
    initialState.config.config.tools = [grepTool];
    const mockStoreWithManualApproval = createMockStore(initialState);

    const mockIdeMessengerManual = mockStoreWithManualApproval.mockIdeMessenger;
    const requestSpy = vi.spyOn(mockIdeMessengerManual, "request");
    // Setup successful compilation
    mockIdeMessengerManual.responses["llm/compileChat"] = {
      compiledChatMessages: [
        { role: "user", content: "Please search the codebase" },
      ],
      didPrune: false,
      contextPercentage: 0.9,
    };

    // Setup streaming generator with tool call requiring approval
    async function* mockStreamGeneratorWithApprovalTool(): AsyncGenerator<
      AssistantChatMessage[],
      PromptLog
    > {
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
                name: grepName,
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
        modelTitle: "Claude 3.5 Sonnet",
      };
    }

    const mockChat = vi
      .fn()
      .mockReturnValue(mockStreamGeneratorWithApprovalTool());
    mockIdeMessengerManual.llmStreamChat = mockChat;

    // Track isStreaming state changes to ensure it doesn't become false after tool generation
    const streamingStates: boolean[] = [];
    const originalDispatch = mockStoreWithManualApproval.dispatch;
    mockStoreWithManualApproval.dispatch = (action: any) => {
      const result = originalDispatch(action);
      // Capture isStreaming state after each action
      const currentState = (mockStoreWithManualApproval.getState() as RootState)
        .session.isStreaming;
      streamingStates.push(currentState);
      return result;
    };

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
    const finalStreamingState = (
      mockStoreWithManualApproval.getState() as RootState
    ).session.isStreaming;
    expect(finalStreamingState).toBe(false); // Final state should be false since we're waiting for approval

    // Verify exact action sequence includes tool generation but NO execution
    const dispatchedActions = mockStoreWithManualApproval.getActions();
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
                  name: grepName,
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
            modelTitle: "Claude 3.5 Sonnet",
            prompt: "Please search the codebase",
          },
        ],
      },
      {
        type: "session/setToolGenerated",
        payload: {
          toolCallId: "tool-approval-1",
          tools: [grepTool],
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
            title: "Session summary",
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
          title: "Session summary",
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
            title: "Session summary",
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
    expect(requestSpy).toHaveBeenCalledWith("llm/compileChat", {
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
      options: { tools: [grepTool] },
    });

    expect(mockIdeMessengerManual.llmStreamChat).toHaveBeenCalledWith(
      {
        completionOptions: { tools: [grepTool] },
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
    expect(requestSpy).not.toHaveBeenCalledWith(
      "tools/call",
      expect.anything(),
    );

    // Verify session save was called
    expect(requestSpy).toHaveBeenCalledWith("history/save", expect.anything());

    // Verify final state contains the tool call in "generated" state (waiting for approval)
    const finalState = mockStoreWithManualApproval.getState();
    expect(finalState).toEqual({
      ...initialState,
      session: {
        ...initialState.session,
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
                    name: grepName,
                    arguments: JSON.stringify({ query: "test function" }),
                  },
                },
              ],
            },
            promptLogs: [
              {
                completion: "I'll search the codebase for you.",
                modelProvider: "anthropic",
                modelTitle: "Claude 3.5 Sonnet",
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
                    name: grepName,
                    arguments: JSON.stringify({ query: "test function" }),
                  },
                },
                parsedArgs: { query: "test function" },
                status: "generated", // Waiting for user approval
                tool: grepTool,
              },
            ],
          },
        ],
        streamAborter: expect.any(AbortController),
        contextPercentage: 0.9,
        isPruned: false,
        title: "Session summary",
        inlineErrorMessage: undefined,
      },
      ui: {
        ...initialState.ui,
        toolSettings: {
          [grepName]: "allowedWithPermission",
        },
      },
    });
  });

  it("should handle complete user approval and tool execution flow", async () => {
    // Create store with tool settings that require manual approval
    const initialState = getRootStateWithClaude();
    initialState.session.history = [
      {
        message: {
          id: "1",
          role: "user",
          content: "Please search the codebase for test functions",
        },
        contextItems: [],
      },
    ];
    initialState.ui.toolSettings = {
      [grepName]: "allowedWithPermission", // Requires manual approval
    };
    initialState.session.id = "session-123";
    initialState.config.config.tools = [grepTool];

    const mockStoreWithApproval = createMockStore(initialState);
    const mockIdeMessengerApproval = mockStoreWithApproval.mockIdeMessenger;
    // Setup successful compilation

    mockIdeMessengerApproval.responses["llm/compileChat"] = {
      compiledChatMessages: [
        {
          role: "user",
          content: "Please search the codebase for test functions",
        },
      ],
      didPrune: false,
      contextPercentage: 0.85,
    };

    mockIdeMessengerApproval.responses["tools/call"] = {
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
    };
    // Setup streaming generator with tool call
    async function* mockStreamGeneratorWithApprovalFlow(): AsyncGenerator<
      AssistantChatMessage[],
      PromptLog
    > {
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
                name: grepName,
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
        modelTitle: "Claude 3.5 Sonnet",
      };
    }

    // Mock subsequent streaming calls (after tool execution)
    let streamCallCount = 0;
    const mockChat = vi.fn().mockImplementation(() => {
      streamCallCount++;
      if (streamCallCount === 1) {
        // First call - initial streaming with tool call
        return mockStreamGeneratorWithApprovalFlow();
      } else {
        // Subsequent calls from streamResponseAfterToolCall
        async function* followupGenerator(): AsyncGenerator<
          AssistantChatMessage[],
          PromptLog
        > {
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
            modelTitle: "Claude 3.5 Sonnet",
          };
        }
        return followupGenerator();
      }
    });
    mockIdeMessengerApproval.llmStreamChat = mockChat;
    const requestSpy = vi.spyOn(mockIdeMessengerApproval, "request");

    // Track isStreaming state changes throughout the entire test
    const streamingStateChanges: boolean[] = [];
    let lastStreamingState = (mockStoreWithApproval.getState() as RootState)
      .session.isStreaming;
    const originalDispatch = mockStoreWithApproval.dispatch;
    mockStoreWithApproval.dispatch = (action: any) => {
      const result = originalDispatch(action);
      const currentStreamingState = (
        mockStoreWithApproval.getState() as RootState
      ).session.isStreaming;
      // Only record when the state actually changes
      if (currentStreamingState !== lastStreamingState) {
        streamingStateChanges.push(currentStreamingState);
        lastStreamingState = currentStreamingState;
      }
      return result;
    };

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
    const initialActions = mockStoreWithApproval.getActions();

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
                  name: grepName,
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
            modelTitle: "Claude 3.5 Sonnet",
            prompt: "Please search the codebase for test functions",
          },
        ],
      },
      {
        type: "session/setToolGenerated",
        payload: {
          toolCallId: "tool-approval-flow-1",
          tools: [grepTool],
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
            title: "Session summary",
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
          title: "Session summary",
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
            title: "Session summary",
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
    mockStoreWithApproval.clearActions();

    // Import the callToolById thunk to simulate user approval
    const { callToolById } = await import("./callToolById");

    // Simulate user clicking "Accept" on the tool call
    const approvalResult = await mockStoreWithApproval.dispatch(
      callToolById({ toolCallId: "tool-approval-flow-1" }) as any,
    );

    // Verify tool execution completed successfully
    expect(approvalResult.type).toBe("chat/callTool/fulfilled");

    // Verify exact approval flow actions
    const approvalActions = mockStoreWithApproval.getActions();
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
            depth: 1,
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
          arg: { depth: 2 },
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
            modelTitle: "Claude 3.5 Sonnet",
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
          arg: { depth: 2 },
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
            title: "Session summary",
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
          title: "Session summary",
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
            title: "Session summary",
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
            depth: 1,
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
        toolName: grepName,
        toolCallId: "tool-approval-flow-1",
      }),
    );

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      "tool_call_outcome",
      expect.objectContaining({
        succeeded: true,
        toolName: grepName,
        errorReason: undefined,
        duration_ms: expect.any(Number),
      }),
    );

    // Verify IDE messenger calls for tool execution
    expect(requestSpy).toHaveBeenCalledWith("tools/call", {
      toolCall: {
        id: "tool-approval-flow-1",
        type: "function",
        function: {
          name: grepName,
          arguments: JSON.stringify({ query: "test function" }),
        },
      },
    });

    // Verify second streaming call was made for continuation
    expect(streamCallCount).toBe(2);

    // Verify final state shows completed tool call and follow-up response
    const finalState = mockStoreWithApproval.getState();
    expect(finalState).toEqual({
      ...initialState,
      session: {
        ...initialState.session,
        title: "Session summary",
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
                    name: grepName,
                    arguments: JSON.stringify({ query: "test function" }),
                  },
                },
              ],
            },
            promptLogs: [
              {
                completion: "I'll search for test functions in the codebase.",
                modelProvider: "anthropic",
                modelTitle: "Claude 3.5 Sonnet",
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
                    name: grepName,
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
                tool: grepTool,
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
                modelTitle: "Claude 3.5 Sonnet",
                prompt: "continuing after tool execution",
              },
            ],
          },
        ],
        isStreaming: false, // Inactive after complete flow
        id: "session-123",
        streamAborter: expect.any(AbortController),
        contextPercentage: 0.85,
        inlineErrorMessage: undefined,
        isPruned: false,
      },
      ui: {
        ...initialState.ui,
        toolSettings: {
          [grepName]: "allowedWithPermission",
        },
      },
    });
  });

  describe("dynamic policy evaluation", () => {
    it("should call tools/evaluatePolicy with correct parameters", async () => {
      const initialState = getRootStateWithClaude();
      initialState.session.history = [
        {
          message: { id: "1", role: "user", content: "Run echo hello" },
          contextItems: [],
        },
      ];
      initialState.ui.toolSettings = {
        [terminalName]: "allowedWithoutPermission",
      };
      initialState.config.config.tools = [grepTool];
      const mockStore = createMockStore(initialState);

      const mockIdeMessenger = mockStore.mockIdeMessenger;
      mockIdeMessenger.responseHandlers["tools/evaluatePolicy"] = async (
        data,
      ) => {
        if (
          "command" in data.parsedArgs &&
          typeof data.parsedArgs.command === "string" &&
          data.parsedArgs.command?.toLowerCase().startsWith("echo")
        ) {
          return { policy: "allowedWithPermission" };
        }
        return { policy: data.basePolicy };
      };
      mockIdeMessenger.responses["llm/compileChat"] = {
        compiledChatMessages: [{ role: "user", content: "Run echo hello" }],
        didPrune: false,
        contextPercentage: 0.5,
      };
      // Setup streaming with echo command (should require permission despite auto-approve base)
      async function* mockStreamWithEcho(): AsyncGenerator<
        AssistantChatMessage[],
        PromptLog
      > {
        yield [{ role: "assistant", content: "I'll run the echo command." }];
        const toolId = `tool-echo-${Date.now()}`;
        yield [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: toolId,
                type: "function",
                function: {
                  name: terminalName,
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
          modelTitle: "Claude 3.5 Sonnet",
        };
      }

      const mockChat = vi.fn().mockReturnValue(mockStreamWithEcho());
      mockIdeMessenger.llmStreamChat = mockChat;
      const requestSpy = vi.spyOn(mockIdeMessenger, "request");

      // Execute thunk
      await mockStore.dispatch(
        streamResponseThunk({
          editorState: mockEditorState,
          modifiers: mockModifiers,
        }) as any,
      ),
        // Just verify the call was made with correct params
        expect(requestSpy).toHaveBeenCalledWith(
          "tools/evaluatePolicy",
          expect.objectContaining({
            toolName: terminalName,
            basePolicy: "allowedWithoutPermission",
            parsedArgs: { command: "echo hello" },
          }),
        );

      // Verify tool wasn't auto-executed (policy changed to require permission)
      expect(requestSpy).not.toHaveBeenCalledWith(
        "tools/call",
        expect.any(Object),
      );
    });

    it("should respect disabled policy", async () => {
      const initialState = getRootStateWithClaude();
      initialState.session.history = [
        {
          message: { id: "1", role: "user", content: "Run ls" },
          contextItems: [],
        },
      ];
      initialState.ui.toolSettings = {
        [terminalName]: "allowedWithPermission",
      };
      initialState.config.config.tools = [terminalTool];
      const mockStore = createMockStore(initialState);
      const mockIdeMessenger = mockStore.mockIdeMessenger;
      const requestSpy = vi.spyOn(mockIdeMessenger, "request");

      // Simple mock - just return disabled policy
      mockIdeMessenger.responseHandlers["llm/compileChat"] = async (data) => {
        const history = (mockStore.getState() as RootState).session.history;
        return {
          compiledChatMessages: [
            ...history.map((i) => i.message),
            { role: "user", content: "Run ls" },
          ],
          didPrune: false,
          contextPercentage: 0.5,
        };
      };
      let numCalls = 0;
      mockIdeMessenger.responseHandlers["tools/evaluatePolicy"] = async (
        data,
      ) => {
        numCalls++;
        if (numCalls <= 1) {
          return {
            policy: "disabled",
          };
        }
        return {
          policy: "allowedWithPermission",
        };
      };
      async function* mockStreamWithLs(): AsyncGenerator<
        AssistantChatMessage[],
        PromptLog
      > {
        yield [{ role: "assistant", content: "I'll list the files." }];
        const id = `tool-ls-${(() => Date.now())()}`;
        yield [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id,
                type: "function",
                function: {
                  name: terminalName,
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
          modelTitle: "Claude 3.5 Sonnet",
        };
      }

      const mockChat = vi.fn().mockImplementation(() => mockStreamWithLs());
      mockIdeMessenger.llmStreamChat = mockChat;

      // Execute thunk
      await mockStore.dispatch(
        streamResponseThunk({
          editorState: mockEditorState,
          modifiers: mockModifiers,
        }) as any,
      ),
        // Verify tools/evaluatePolicy was called
        expect(requestSpy).toHaveBeenCalledWith(
          "tools/evaluatePolicy",
          expect.objectContaining({
            toolName: terminalName,
            basePolicy: "allowedWithPermission",
            parsedArgs: { command: "ls" },
          }),
        );

      // Tool should NOT be executed since it's disabled by policy
      expect(requestSpy).not.toHaveBeenCalledWith(
        "tools/call",
        expect.any(Object),
      );

      const state = mockStore.getState() as RootState;
      expect(state.ui.dialogMessage).toBeUndefined();
    });

    it("should handle evaluation errors gracefully", async () => {
      const initialState = getRootStateWithClaude();
      initialState.session.history = [
        {
          message: { id: "1", role: "user", content: "Do something" },
          contextItems: [],
        },
      ];
      const someTool = {
        ...grepTool,
        function: {
          ...grepTool.function,
          name: "some_tool",
        },
      };
      initialState.config.config.tools = [someTool];
      initialState.ui.toolSettings = {
        some_tool: "allowedWithoutPermission",
      };

      const mockStore = createMockStore(initialState);
      const mockIdeMessenger = mockStore.mockIdeMessenger;

      // Mock evaluation failure
      let numCalls = 0;
      const requestSpy = vi.spyOn(mockIdeMessenger, "request");
      requestSpy.mockImplementation(async (endpoint, data) => {
        if (endpoint === "tools/evaluatePolicy") {
          numCalls++;
          if (numCalls <= 1) {
            // Simulate evaluation error
            return {
              done: true as const,
              status: "error",
              error: "Failed to evaluate policy",
            };
          } else {
            return {
              done: true as const,
              status: "success",
              content: {
                policy: "allowedWithPermission",
              },
            };
          }
        }
        mockIdeMessenger.responseHandlers["llm/compileChat"] = async (data) => {
          const history = (mockStore.getState() as RootState).session.history;
          return {
            compiledChatMessages: [
              ...history.map((i) => i.message),
              { role: "user", content: "Do something" },
            ],
            didPrune: false,
            contextPercentage: 0.5,
          };
        };

        return new MockIdeMessenger().request(endpoint, data);
      });

      // Setup streaming with tool call
      async function* mockStreamWithTool(): AsyncGenerator<
        AssistantChatMessage[],
        PromptLog
      > {
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
          modelTitle: "Claude 3.5 Sonnet",
        };
      }

      const mockChat = vi.fn().mockImplementation(() => mockStreamWithTool());
      mockIdeMessenger.llmStreamChat = mockChat;

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

      const state = mockStore.getState() as RootState;
      expect(state.ui.dialogMessage).toBeUndefined();
    });

    it("should properly handle disabled commands and show error status", async () => {
      // Setup store with runTerminalCommand tool
      const initialState = getRootStateWithClaude();
      initialState.config.config.tools = [terminalTool];
      initialState.ui.toolSettings = {
        runTerminalCommand: "allowedWithPermission",
      };
      const mockStoreWithTerminalTool = createMockStore(initialState);

      const mockTerminalIdeMessenger =
        mockStoreWithTerminalTool.mockIdeMessenger;

      mockTerminalIdeMessenger.responseHandlers["llm/compileChat"] = async (
        data,
      ) => {
        const history = (mockStoreWithTerminalTool.getState() as RootState)
          .session.history;
        return {
          compiledChatMessages: [
            ...history.map((i) => i.message),
            { role: "user", content: "Run eval command" },
          ],
          didPrune: false,
          contextPercentage: 0.9,
        };
      };

      let numCalls = 0;
      mockTerminalIdeMessenger.responseHandlers["tools/evaluatePolicy"] =
        async (data) => {
          const args = data.parsedArgs || {};
          numCalls++;
          if (
            numCalls <= 1 &&
            args.command &&
            typeof args.command === "string" &&
            args.command.includes("eval")
          ) {
            return { policy: "disabled" };
          }
          return { policy: "allowedWithPermission" };
        };

      // Setup streaming with eval command tool call
      async function* mockStreamWithEvalCommand(): AsyncGenerator<
        AssistantChatMessage[],
        PromptLog
      > {
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
          modelTitle: "Claude 3.5 Sonnet",
        };
      }

      mockTerminalIdeMessenger.llmStreamChat = vi
        .fn()
        .mockImplementation(() => mockStreamWithEvalCommand());
      const requestSpy = vi.spyOn(mockTerminalIdeMessenger, "request");

      // Execute thunk
      await mockStoreWithTerminalTool.dispatch(
        streamResponseThunk({
          editorState: mockEditorState,
          modifiers: mockModifiers,
        }) as any,
      );

      // Get final state
      const finalState = mockStoreWithTerminalTool.getState() as RootState;
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
      const toolCallRequests = requestSpy.mock.calls.filter(
        (call) => call[0] === "tools/call",
      );
      expect(toolCallRequests).toHaveLength(0);

      const state = mockStoreWithTerminalTool.getState() as RootState;
      expect(state.ui.dialogMessage).toBeUndefined();
    });
  });
});
