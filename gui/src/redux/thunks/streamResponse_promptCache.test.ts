import { JSONContent } from "@tiptap/core";
import { ModelDescription } from "core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import type { PromptCacheSetting } from "../../util/promptCache";
import type { RootState } from "../store";
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

const claude: ModelDescription = {
  title: "Claude Sonnet",
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
};
const gpt: ModelDescription = {
  title: "GPT",
  model: "gpt-4o",
  provider: "openai",
  underlyingProviderName: "openai",
};

const editorState: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
};

/** Runs one chat turn and returns the completionOptions sent to core. */
async function sentOptions(opts: {
  model?: ModelDescription;
  setting?: PromptCacheSetting;
  lastRequestAgoMs?: number;
  /** Chunks the mocked model streams back (the last may carry usage). */
  reply?: any[];
}) {
  const model = opts.model ?? claude;
  const state = getEmptyRootState();
  state.session.id = "s1";
  state.session.history = [
    { message: { id: "1", role: "user", content: "hello" }, contextItems: [] },
  ];
  if (opts.lastRequestAgoMs !== undefined) {
    state.session.promptCache = {
      escalated: false,
      lastRequestAt: Date.now() - opts.lastRequestAgoMs,
      lastTtl: "5m",
    };
  }
  if (opts.setting) {
    state.ui.promptCacheSettings = { [model.title]: opts.setting };
  }
  state.config.config = {
    ...state.config.config,
    selectedModelByRole: {
      ...state.config.config.selectedModelByRole,
      chat: model,
    },
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
    if (opts.reply) {
      yield opts.reply;
    }
    return undefined;
  }) as any;

  await store.dispatch(
    streamResponseThunk({
      editorState,
      modifiers: { useCodebase: false, noContext: true },
    }) as any,
  );
  return {
    options: sent[0]?.completionOptions,
    store,
    /** The session's prompt cache state after the turn. */
    cache: () => (store.getState() as RootState).session.promptCache,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("prompt cache options in the chat request", () => {
  it("sends nothing when the toolbar has no choice and config is silent", async () => {
    const { options } = await sentOptions({});
    expect(options.promptCaching).toBeUndefined();
    expect(options.promptCacheTtl).toBeUndefined();
  });

  it("sends the 5-minute lifetime for Auto on a fresh session", async () => {
    const { options } = await sentOptions({ setting: "auto" });
    expect(options).toMatchObject({
      promptCaching: true,
      promptCacheTtl: "5m",
    });
  });

  it("sends the 1-hour lifetime for Auto after a pause 1 hour would have covered", async () => {
    const { options, cache } = await sentOptions({
      setting: "auto",
      lastRequestAgoMs: 11 * 60 * 1000,
    });
    expect(options).toMatchObject({
      promptCaching: true,
      promptCacheTtl: "1h",
    });
    expect(cache()?.escalated).toBe(true);
  });

  it("sends the chosen fixed lifetime", async () => {
    const { options } = await sentOptions({ setting: "1h" });
    expect(options).toMatchObject({
      promptCaching: true,
      promptCacheTtl: "1h",
    });
  });

  it("turns caching off explicitly", async () => {
    const { options } = await sentOptions({ setting: "off" });
    expect(options.promptCaching).toBe(false);
    expect(options.promptCacheTtl).toBeUndefined();
  });

  it("records when the request went out", async () => {
    const before = Date.now();
    const { cache } = await sentOptions({ setting: "auto" });
    expect(cache()?.lastRequestAt).toBeGreaterThanOrEqual(before);
  });

  it("never adds cache options for a provider that ignores them", async () => {
    const { options } = await sentOptions({ model: gpt, setting: "1h" });
    expect(options.promptCaching).toBeUndefined();
    expect(options.promptCacheTtl).toBeUndefined();
  });

  it("remembers the API's input size from the usage chunk", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      reply: [
        { role: "assistant", content: "hi" },
        {
          role: "assistant",
          content: "",
          usage: {
            promptTokens: 12,
            completionTokens: 5,
            promptTokensDetails: {
              cachedTokens: 80_000,
              cacheWriteTokens: 4_000,
            },
          },
        },
      ],
    });
    // 12 uncached + 80,000 read + 4,000 written
    expect(cache()?.lastInputTokens).toBe(84_012);
  });
});
