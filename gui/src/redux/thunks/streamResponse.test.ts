import { describe, expect, it, vi } from "vitest";
import { JSONContent } from "@tiptap/core";
import { InputModifiers } from "core";
import { createMockStore } from "../../util/test/mockStore";
import { streamResponseThunk } from "./streamResponse";

// Mock only the external dependencies - let thunks run naturally
vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-123"),
}));

vi.mock("../../components/mainInput/TipTapEditor/utils/resolveEditorContent", () => ({
  resolveEditorContent: vi.fn(),
}));

// Mock selectors that streamNormalInput uses
vi.mock("../selectors/selectActiveTools", () => ({
  selectActiveTools: vi.fn(() => []),
}));

vi.mock("../selectors/selectUseSystemMessageTools", () => ({
  selectUseSystemMessageTools: vi.fn(() => false),
}));

vi.mock("../util/constructMessages", () => ({
  constructMessages: vi.fn(() => ({
    messages: [{ role: "user", content: "Hello" }],
    appliedRules: [],
    appliedRuleIndex: 0,
  })),
}));

vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(() => "You are a helpful assistant"),
}));

vi.mock("core/llm/toolSupport", () => ({
  modelSupportsNativeTools: vi.fn(() => true),
}));

vi.mock("core/config/shouldAutoEnableSystemMessageTools", () => ({
  shouldAutoEnableSystemMessageTools: vi.fn(() => undefined),
}));

import posthog from "posthog-js";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";
import { ModelDescription } from "core";

const mockPosthog = vi.mocked(posthog);
const mockResolveEditorContent = vi.mocked(resolveEditorContent);

const mockClaudeModel: ModelDescription = {
  title: "Claude 3.5 Sonnet",
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
  completionOptions: {
    reasoningBudgetTokens: 2048,
  },
};

const mockEditorState: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hello, please help me with this code" }],
    },
  ],
};

const mockModifiers: InputModifiers = {
  useCodebase: true,
  noContext: false,
};

function setupTest() {
  vi.clearAllMocks();

  const mockStore = createMockStore({
    session: {
      history: [
        {
          message: {
            id: "1",
            role: "user",
            content: "Previous message",
          },
          contextItems: [],
        },
      ],
      hasReasoningEnabled: false,
      isStreaming: false,
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
        slashCommands: [],
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
          defaultContext: ["codebase"],
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

  // Setup IDE messenger responses for streamNormalInput
  mockStore.mockIdeMessenger.request.mockImplementation((endpoint: string) => {
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
    }
    return Promise.resolve({ status: "success", content: {} });
  });

  // Setup streaming generator for streamNormalInput
  async function* mockStreamGenerator() {
    yield [{ role: "assistant", content: "I'll help you with that." }];
    return {
      prompt: "Hello",
      completion: "I'll help you with that.",
      modelProvider: "anthropic",
    };
  }

  mockStore.mockIdeMessenger.llmStreamChat.mockReturnValue(mockStreamGenerator());

  return { mockStore };
}

describe("streamResponseThunk", () => {
  it("should execute complete chat flow without slash commands", async () => {
    const { mockStore } = setupTest();

    // Mock resolveEditorContent for basic chat
    mockResolveEditorContent.mockResolvedValue({
      selectedContextItems: [],
      selectedCode: [],
      content: "Hello, please help me with this code",
      legacyCommandWithInput: null,
    });

    // Execute thunk
    const result = await mockStore.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify thunk completed successfully
    expect(result.type).toBe("chat/streamResponse/fulfilled");
  });
});