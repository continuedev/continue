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
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify the thunk completed successfully but shows error dialog
    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Verify the complete error handling flow
    const dispatchedActions = (mockStoreNoModel as any).getActions();
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
        type: "chat/cancelStream/pending",
        meta: {
          arg: undefined,
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setInactive",
        payload: undefined,
      },
      {
        type: "session/abortStream",
        payload: undefined,
      },
      {
        type: "session/clearDanglingMessages",
        payload: undefined,
      },
      {
        type: "chat/cancelStream/fulfilled",
        meta: {
          arg: undefined,
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "ui/setDialogMessage",
        payload: expect.objectContaining({
          props: expect.objectContaining({
            error: expect.objectContaining({
              message: "No chat model selected",
            }),
          }),
        }),
      },
      {
        type: "ui/setShowDialog",
        payload: true,
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

    // Verify no IDE messenger calls were made
    expect(mockStoreNoModel.mockIdeMessenger.request).not.toHaveBeenCalled();
    expect(
      mockStoreNoModel.mockIdeMessenger.llmStreamChat,
    ).not.toHaveBeenCalled();

    // Verify final state shows error dialog and inactive streaming
    const finalState = mockStoreNoModel.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            contextItems: [],
            isGatheringContext: false,
            message: { id: "1", role: "user", content: "Hello" },
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: false, // Set to inactive after error
        id: "session-123",
        mode: "chat",
        streamAborter: expect.any(AbortController),
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
        },
        lastSelectedModelByRole: {},
        loading: false,
        configError: undefined,
      },
      ui: {
        toolSettings: {},
        ruleSettings: {},
        showDialog: true, // Error dialog is shown
        dialogMessage: expect.objectContaining({
          props: expect.objectContaining({
            error: expect.objectContaining({
              message: "No chat model selected",
            }),
          }),
        }),
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

  it("should handle compilation error - not enough context", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();

    // Mock compilation failure with "Not enough context" error
    mockIdeMessenger.request.mockResolvedValue({
      status: "error",
      error: "Not enough context available for this request",
    });

    // Execute thunk
    const result = await mockStore.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify thunk completed successfully (doesn't throw, handles error gracefully)
    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Verify exact action sequence for this error path
    const dispatchedActions = (mockStore as any).getActions();
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
        type: "session/setInlineErrorMessage",
        payload: "out-of-context",
      },
      {
        type: "session/setInactive",
        payload: undefined,
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
        type: "session/refreshMetadata/rejected",
        meta: {
          aborted: false,
          arg: {},
          condition: false,
          rejectedWithValue: false,
          requestId: expect.any(String),
          requestStatus: "rejected",
        },
        payload: undefined,
        error: {
          message: "Not enough context available for this request",
          name: "Error",
          stack: expect.any(String),
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

    // Verify IDE messenger was called for compilation but not streaming
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
              text: "Hello",
              type: "text",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              text: "Hello, please help me with this code",
              type: "text",
            },
          ],
        },
      ],
      options: {
        reasoning: false,
      },
    });
    expect(mockIdeMessenger.llmStreamChat).not.toHaveBeenCalled();

    // Verify final state shows error condition
    const finalState = mockStore.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            contextItems: [],
            message: {
              content: "Hello",
              id: "1",
              role: "user",
            },
          },
          {
            appliedRules: [],
            contextItems: [],
            editorState: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Hello, please help me with this code",
                    },
                  ],
                },
              ],
            },
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
              content: "",
              id: "mock-uuid-123",
              role: "assistant",
            },
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

  it("should throw error for other compilation errors", async () => {
    const { mockStore, mockIdeMessenger } = setupTest();

    // Mock compilation failure with generic error
    mockIdeMessenger.request.mockResolvedValue({
      status: "error",
      error: "Model configuration is invalid",
    });

    // Execute thunk and expect it to be rejected
    const result = await mockStore.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify thunk completed successfully but shows error dialog
    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Verify exact action sequence for compilation error with dialog
    const dispatchedActions = (mockStore as any).getActions();
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
        type: "symbols/updateFromContextItems/fulfilled",
        meta: {
          arg: [],
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "chat/streamNormalInput/rejected",
        meta: {
          aborted: false,
          arg: {
            legacySlashCommandData: undefined,
          },
          condition: false,
          rejectedWithValue: false,
          requestId: expect.any(String),
          requestStatus: "rejected",
        },
        payload: undefined,
        error: {
          message: "Model configuration is invalid",
          name: "Error",
          stack: expect.any(String),
        },
      },
      {
        type: "chat/cancelStream/pending",
        meta: {
          arg: undefined,
          requestId: expect.any(String),
          requestStatus: "pending",
        },
        payload: undefined,
      },
      {
        type: "session/setInactive",
        payload: undefined,
      },
      {
        type: "session/abortStream",
        payload: undefined,
      },
      {
        type: "session/clearDanglingMessages",
        payload: undefined,
      },
      {
        type: "chat/cancelStream/fulfilled",
        meta: {
          arg: undefined,
          requestId: expect.any(String),
          requestStatus: "fulfilled",
        },
        payload: undefined,
      },
      {
        type: "ui/setDialogMessage",
        payload: expect.objectContaining({
          props: expect.objectContaining({
            error: expect.objectContaining({
              message: "Model configuration is invalid",
            }),
          }),
        }),
      },
      {
        type: "ui/setShowDialog",
        payload: true,
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

    // Verify IDE messenger was called for compilation but not streaming
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
    expect(mockIdeMessenger.llmStreamChat).not.toHaveBeenCalled();

    // Verify final state shows error dialog and inactive streaming
    const finalState = mockStore.getState();
    expect(finalState).toEqual({
      session: {
        history: [
          {
            contextItems: [],
            message: { id: "1", role: "user", content: "Hello" },
          },
        ],
        hasReasoningEnabled: false,
        isStreaming: false, // Set to inactive after error
        id: "session-123",
        mode: "chat",
        streamAborter: expect.any(AbortController),
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
        mainEditorContentTrigger: mockEditorState, // Editor content that triggered the request
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
        showDialog: true, // Error dialog is shown
        dialogMessage: expect.objectContaining({
          props: expect.objectContaining({
            error: expect.objectContaining({
              message: "Model configuration is invalid",
            }),
          }),
        }),
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
