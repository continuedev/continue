import { JSONContent } from "@tiptap/core";
import { ModelDescription } from "core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import { streamResponseThunk } from "./streamResponse";

vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(() => "You are a helpful assistant."),
}));
vi.mock("uuid", () => ({ v4: vi.fn(() => "mock-uuid") }));
vi.mock(
  "../../components/mainInput/TipTapEditor/utils/resolveEditorContent",
  () => ({
    resolveEditorContent: vi.fn(async () => ({
      selectedContextItems: [],
      selectedCode: [],
      content: "hello",
      legacyCommandWithInput: undefined,
    })),
  }),
);

const model: ModelDescription = {
  title: "Claude Opus",
  model: "anthropic.claude-opus",
  provider: "bedrock",
  underlyingProviderName: "bedrock",
};

const editorState: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
};

/** Runs one chat turn and returns the completionOptions sent to core. */
async function sentCompletionOptions(opts: {
  mode: "chat" | "agent" | "plan";
  effort?: "off" | "low" | "medium" | "high";
  hasReasoningEnabled?: boolean;
}) {
  const state = getEmptyRootState();
  state.session.id = "s1";
  state.session.mode = opts.mode;
  state.session.hasReasoningEnabled = opts.hasReasoningEnabled;
  state.session.history = [
    { message: { id: "1", role: "user", content: "hello" }, contextItems: [] },
  ];
  state.config.config = {
    ...state.config.config,
    selectedModelByRole: {
      ...state.config.config.selectedModelByRole,
      chat: model,
    },
    ...(opts.effort
      ? {
          modeModels: {
            [opts.mode]: { title: "Claude Opus", reasoningEffort: opts.effort },
          } as any,
        }
      : {}),
  };
  const store = createMockStore(state);
  store.mockIdeMessenger.responses["llm/compileChat"] = {
    compiledChatMessages: [{ role: "user", content: "hello" }],
    didPrune: false,
    contextPercentage: 0.5,
  };
  const sent: any[] = [];
  store.mockIdeMessenger.llmStreamChat = vi.fn(async function* (msg: any) {
    sent.push(msg);
    return undefined;
  }) as any;

  await store.dispatch(
    streamResponseThunk({
      editorState,
      modifiers: { useCodebase: false, noContext: true },
    }) as any,
  );
  return sent[0]?.completionOptions;
}

beforeEach(() => vi.clearAllMocks());

describe("per-mode reasoning effort", () => {
  it("enables reasoning with the effort's budget when the user has not toggled it", async () => {
    const opts = await sentCompletionOptions({
      mode: "plan",
      effort: "medium",
    });
    expect(opts).toMatchObject({
      reasoning: true,
      reasoningBudgetTokens: 4096,
    });
  });

  it("uses a larger budget for high effort", async () => {
    const opts = await sentCompletionOptions({ mode: "plan", effort: "high" });
    expect(opts.reasoningBudgetTokens).toBe(16384);
  });

  it("turns reasoning off for effort 'off'", async () => {
    const opts = await sentCompletionOptions({ mode: "plan", effort: "off" });
    expect(opts.reasoning).toBe(false);
    expect(opts.reasoningBudgetTokens).toBeUndefined();
  });

  it("lets an explicit reasoning toggle win over the mode's effort", async () => {
    const opts = await sentCompletionOptions({
      mode: "plan",
      effort: "high",
      hasReasoningEnabled: false,
    });
    expect(opts.reasoning).toBe(false);
    expect(opts.reasoningBudgetTokens).toBeUndefined();
  });

  it("does not touch reasoning when the mode has no effort configured", async () => {
    const opts = await sentCompletionOptions({ mode: "agent" });
    expect(opts?.reasoning).toBeUndefined();
  });
});
