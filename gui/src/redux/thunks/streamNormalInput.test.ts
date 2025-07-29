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
    expect(finalState.session.isStreaming).toBe(false); // Should be inactive
    expect(finalState.session.contextPercentage).toBe(0.8); // Should be updated
    expect(finalState.session.isPruned).toBe(false); // Should match compilation result
  });
});
