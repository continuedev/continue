import { ModelDescription } from "core";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("streamNormalInput", () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let mockIdeMessenger: any;

  const mockClaudeModel: ModelDescription = {
    title: "Claude 3.5 Sonnet",
    model: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    underlyingProviderName: "anthropic",
    completionOptions: { reasoningBudgetTokens: 2048 },
  };


  beforeEach(() => {
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
    mockStore = createMockStore({
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

    // Use the store's ideMessenger instance
    mockIdeMessenger = mockStore.mockIdeMessenger;
  });

  describe("successful streaming flow", () => {
    it("should execute complete streaming flow with all dispatches", async () => {
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

      // Verify dispatch calls in order
      const dispatchedActions = (mockStore as any).getActions();

      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setAppliedRulesAtIndex" }),
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setActive" }),
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({
          type: "session/setInlineErrorMessage",
          payload: undefined,
        }),
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({
          type: "session/setIsPruned",
          payload: false,
        }),
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({
          type: "session/setContextPercentage",
          payload: 0.8,
        }),
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/streamUpdate" }),
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/addPromptCompletionPair" }),
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setInactive" }),
      );

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

      expect(result.type).toBe("chat/streamNormalInput/fulfilled");
    });
  });
});
