import { LLMFullCompletionOptions, ModelDescription, Tool } from "core";
import { ToCoreProtocol } from "core/protocol";  
import { BuiltInToolNames } from "core/tools/builtIn";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStore } from "../../util/test/mockStore";
import { streamNormalInput } from "./streamNormalInput";

// Mock external dependencies only - let selectors run naturally
vi.mock("core/llm/toolSupport", () => ({
  modelSupportsNativeTools: vi.fn(),
}));

vi.mock("core/tools/systemMessageTools/buildToolsSystemMessage", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addSystemMessageToolsToSystemMessage: vi.fn(),
  };
});

vi.mock("core/tools/systemMessageTools/interceptSystemToolCalls", () => ({
  interceptSystemToolCalls: vi.fn(),
}));

vi.mock("./callToolById", () => ({
  callToolById: vi.fn(),
}));

vi.mock("../util/constructMessages", () => ({
  constructMessages: vi.fn(),
}));

vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(),
}));

import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { addSystemMessageToolsToSystemMessage } from "core/tools/systemMessageTools/buildToolsSystemMessage";
import { interceptSystemToolCalls } from "core/tools/systemMessageTools/interceptSystemToolCalls";
import { callToolById } from "./callToolById";
import { constructMessages } from "../util/constructMessages";
import { getBaseSystemMessage } from "../util/getBaseSystemMessage";

const mockModelSupportsNativeTools = vi.mocked(modelSupportsNativeTools);
const mockAddSystemMessageToolsToSystemMessage = vi.mocked(addSystemMessageToolsToSystemMessage);
const mockInterceptSystemToolCalls = vi.mocked(interceptSystemToolCalls);
const mockCallToolById = vi.mocked(callToolById);
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
    completionOptions: { reasoningBudgetTokens: 2048 }
  };

  const mockTool: Tool = {
    function: {
      name: BuiltInToolNames.EditExistingFile,
      description: "Edit a file",
      parameters: { type: "object", properties: {} }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations for external functions
    mockModelSupportsNativeTools.mockReturnValue(true);
    mockGetBaseSystemMessage.mockReturnValue("System message");
    mockAddSystemMessageToolsToSystemMessage.mockReturnValue("System message with tools");
    mockConstructMessages.mockReturnValue({
      messages: [{ role: "user", content: "Hello" }],
      appliedRules: [],
      appliedRuleIndex: 0
    });
    
    // Create store with realistic state that selectors can work with
    mockStore = createMockStore({
      session: {
        history: [
          {
            message: { id: "1", role: "user", content: "Hello" },
            contextItems: []
          }
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
      },
      config: {
        config: {
          models: [mockClaudeModel],
          tools: [mockTool],
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
            onlyUseSystemMessageTools: false  // Ensure native tools are used
          }
        },
        lastSelectedModelByRole: {
          chat: mockClaudeModel.title
        }
      },
      ui: {
        toolSettings: {},
        ruleSettings: {},
        showDialog: false,
        dialogMessage: null,
      }
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
          contextPercentage: 0.8
        }
      });

      // Setup streaming generator
      async function* mockStreamGenerator() {
        yield [{ role: "assistant", content: "First chunk" }];
        yield [{ role: "assistant", content: "Second chunk" }];
        return {
          prompt: "Hello",
          completion: "Hi there!",
          modelProvider: "anthropic"
        };
      }
      
      mockIdeMessenger.llmStreamChat.mockReturnValue(mockStreamGenerator());

      // Execute thunk
      const result = await mockStore.dispatch(streamNormalInput({}));

      // Verify dispatch calls in order
      const dispatchedActions = mockStore.getActions();
      
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setAppliedRulesAtIndex" })
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setActive" })
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setInlineErrorMessage", payload: undefined })
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setIsPruned", payload: false })
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setContextPercentage", payload: 0.8 })
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/streamUpdate" })
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/addPromptCompletionPair" })
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setInactive" })
      );

      // Verify IDE messenger calls
      expect(mockIdeMessenger.request).toHaveBeenCalledWith("llm/compileChat", {
        messages: expect.any(Array),
        options: expect.objectContaining({
          tools: [mockTool]
        })
      });

      expect(mockIdeMessenger.llmStreamChat).toHaveBeenCalledWith(
        expect.objectContaining({
          completionOptions: expect.objectContaining({
            tools: [mockTool]
          }),
          title: "Claude 3.5 Sonnet",
          messages: expect.any(Array),
          messageOptions: { precompiled: true }
        }),
        expect.any(AbortSignal)
      );

      expect(result.type).toBe("chat/streamNormalInput/fulfilled");
    });

    it("should handle reasoning enabled models", async () => {
      // Enable reasoning in state
      mockStore = createMockStore({
        session: {
          hasReasoningEnabled: true,
          history: [{ message: { id: "1", role: "user", content: "Hello" }, contextItems: [] }],
          isStreaming: true,
          id: "session-123",
          mode: "chat",
          streamAborter: new AbortController(),
          contextPercentage: 0,
          isPruned: false,
          isInEdit: false,
          title: "",
          lastSessionId: undefined,
        },
        config: {
          config: {
            models: [mockClaudeModel],
            tools: [mockTool],
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
              onlyUseSystemMessageTools: false  // Ensure native tools are used
            }
          },
          lastSelectedModelByRole: {
            chat: mockClaudeModel.title
          }
        },
        ui: {
          toolSettings: {},
          ruleSettings: {},
          showDialog: false,
          dialogMessage: null,
        }
      });

      // Use the store's ideMessenger instance  
      mockIdeMessenger = mockStore.mockIdeMessenger;

      mockIdeMessenger.request.mockResolvedValue({
        status: "success", 
        content: {
          compiledChatMessages: [],
          didPrune: false,
          contextPercentage: 0.5
        }
      });

      async function* mockStreamGenerator() {
        return { prompt: "Test", completion: "Response" };
      }
      
      mockIdeMessenger.llmStreamChat.mockReturnValue(mockStreamGenerator());

      await mockStore.dispatch(streamNormalInput({}));

      // Verify reasoning options are included
      expect(mockIdeMessenger.request).toHaveBeenCalledWith("llm/compileChat", {
        messages: expect.any(Array),
        options: expect.objectContaining({
          reasoning: true,
          reasoningBudgetTokens: 2048,
          tools: [mockTool]
        })
      });
    });
  });

  describe("error scenarios", () => {
    it("should handle no chat model selected", async () => {
      // Create store with no selected model
      mockStore = createMockStore({
        config: {
          config: {
            models: [],
            tools: [],
            rules: [],
            tabAutocompleteModel: undefined,
          },
          lastSelectedModelByRole: {}
        }
      });

      // Use the store's ideMessenger instance  
      mockIdeMessenger = mockStore.mockIdeMessenger;

      await expect(mockStore.dispatch(streamNormalInput({}))).rejects.toThrow(
        "No chat model selected"
      );
    });

    it("should handle out-of-context compilation error", async () => {
      mockIdeMessenger.request.mockResolvedValue({
        status: "error",
        error: "Not enough context space available"
      });

      await mockStore.dispatch(streamNormalInput({}));

      const dispatchedActions = mockStore.getActions();
      
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ 
          type: "session/setInlineErrorMessage", 
          payload: "out-of-context" 
        })
      );
      expect(dispatchedActions).toContainEqual(
        expect.objectContaining({ type: "session/setInactive" })
      );
    });

    it("should handle other compilation errors", async () => {
      mockIdeMessenger.request.mockResolvedValue({
        status: "error", 
        error: "Model unavailable"
      });

      await expect(mockStore.dispatch(streamNormalInput({}))).rejects.toThrow(
        "Model unavailable"
      );
    });
  });

  describe("dev data logging", () => {
    it("should log successful completion to dev data", async () => {
      mockIdeMessenger.request.mockResolvedValue({
        status: "success",
        content: {
          compiledChatMessages: [],
          didPrune: false,
          contextPercentage: 0.5
        }
      });

      const completionData = {
        prompt: "Hello",
        completion: "Hi there!",
        modelProvider: "anthropic"
      };

      const mockStreamGenerator = {
        async *[Symbol.asyncIterator]() {
          return completionData;
        }
      };
      
      mockIdeMessenger.llmStreamChat.mockReturnValue(mockStreamGenerator());

      await mockStore.dispatch(streamNormalInput({}));

      expect(mockIdeMessenger.post).toHaveBeenCalledWith("devdata/log", {
        name: "chatInteraction",
        data: expect.objectContaining({
          prompt: "Hello",
          completion: "Hi there!",
          modelProvider: "anthropic",
          modelTitle: "Claude 3.5 Sonnet",
          sessionId: "session-123",
          tools: ["EditExistingFile"]
        })
      });
    });

    it("should handle dev data logging errors gracefully", async () => {
      mockIdeMessenger.request.mockResolvedValue({
        status: "success",
        content: {
          compiledChatMessages: [],
          didPrune: false,
          contextPercentage: 0.5
        }
      });

      async function* mockStreamGenerator() {
        return { prompt: "Test", completion: "Response" };
      }
      
      mockIdeMessenger.llmStreamChat.mockReturnValue(mockStreamGenerator());
      mockIdeMessenger.post.mockRejectedValue(new Error("Logging failed"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await mockStore.dispatch(streamNormalInput({}));

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to send dev data interaction log",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});