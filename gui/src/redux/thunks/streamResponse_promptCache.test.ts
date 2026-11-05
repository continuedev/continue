import { promptCacheKey } from "../../util/cacheSafeguards";
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
  /** Input size of the previous request, in tokens. */
  lastInputTokens?: number;
  /** Chunks the mocked model streams back (the last may carry usage). */
  reply?: any[];
  /** Requests this conversation has already sent. */
  requests?: number;
  /** The model the previous request was made with, when it differs. */
  previousModel?: string;
  mode?: "chat" | "agent" | "plan" | "background";
}) {
  const model = opts.model ?? claude;
  const state = getEmptyRootState();
  state.session.id = "s1";
  state.session.history = [
    { message: { id: "1", role: "user", content: "hello" }, contextItems: [] },
  ];
  if (opts.mode) state.session.mode = opts.mode;
  if (opts.requests !== undefined && opts.lastRequestAgoMs === undefined) {
    state.session.promptCache = { escalated: false, requests: opts.requests };
  }
  if (opts.lastRequestAgoMs !== undefined) {
    state.session.promptCache = {
      escalated: false,
      requests: opts.requests,
      lastRequestAt: Date.now() - opts.lastRequestAgoMs,
      lastTtl: "5m",
      lastInputTokens: opts.lastInputTokens,
      ...(opts.previousModel && {
        lastKey: promptCacheKey(
          { ...model, model: opts.previousModel, provider: model.provider },
          [],
          "You are a helpful assistant.",
        ),
      }),
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
  it("sends nothing in Chat when the toolbar has no choice and config is silent", async () => {
    const { options } = await sentOptions({ mode: "chat" });
    expect(options.promptCaching).toBeUndefined();
    expect(options.promptCacheTtl).toBeUndefined();
  });

  it("turns caching on with Auto in Agent when the toolbar has no choice and config is silent", async () => {
    const { options } = await sentOptions({ mode: "agent" });
    expect(options).toMatchObject({
      promptCaching: true,
      promptCacheTtl: "5m",
    });
  });

  it.each(["plan", "background"] as const)(
    "does the same in %s mode",
    async (mode) => {
      const { options } = await sentOptions({ mode });
      expect(options.promptCaching).toBe(true);
    },
  );

  it("respects an explicit Off in Agent", async () => {
    const { options } = await sentOptions({ mode: "agent", setting: "off" });
    expect(options.promptCaching).toBe(false);
  });

  it("respects promptCaching: false in config, in Agent", async () => {
    const off = { ...claude, completionOptions: { promptCaching: false } };
    const { options } = await sentOptions({ mode: "agent", model: off as any });
    expect(options.promptCaching).toBeUndefined();
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

  it("moves Auto to 1 hour on the 5th request of an agent conversation", async () => {
    const fourth = await sentOptions({
      setting: "auto",
      mode: "agent",
      requests: 3,
    });
    expect(fourth.options.promptCacheTtl).toBe("5m");
    expect(fourth.cache()?.requests).toBe(4);

    const fifth = await sentOptions({
      setting: "auto",
      mode: "agent",
      requests: 4,
    });
    expect(fifth.options).toMatchObject({
      promptCaching: true,
      promptCacheTtl: "1h",
    });
    expect(fifth.cache()).toMatchObject({
      requests: 5,
      escalated: true,
      escalatedBy: "requests",
    });
  });

  it("does not move Auto to 1 hour by count in chat mode", async () => {
    const { options, cache } = await sentOptions({
      setting: "auto",
      mode: "chat",
      requests: 20,
    });
    expect(options.promptCacheTtl).toBe("5m");
    expect(cache()?.escalated).toBe(false);
  });

  it("does not count requests when caching is off", async () => {
    const { cache } = await sentOptions({
      setting: "off",
      mode: "agent",
      requests: 4,
    });
    expect(cache()?.requests).toBe(4);
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

  it("records a miss when a warm cache was barely read", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      lastRequestAgoMs: 30_000,
      lastInputTokens: 120_000,
      reply: [
        {
          role: "assistant",
          content: "hi",
          usage: {
            promptTokens: 5,
            completionTokens: 5,
            promptTokensDetails: {
              cachedTokens: 1_000,
              cacheWriteTokens: 125_000,
            },
          },
        },
      ],
    });
    expect(cache()?.misses).toBe(1);
    expect(cache()?.lastMiss).toMatchObject({
      readTokens: 1_000,
      expectedTokens: 120_000,
    });
    // the new request's size and make-up are remembered for the next check
    expect(cache()?.lastInputTokens).toBe(126_005);
    expect(cache()?.lastKey).toBeDefined();
  });

  it("does not record a miss when the cache was read", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      lastRequestAgoMs: 30_000,
      lastInputTokens: 120_000,
      reply: [
        {
          role: "assistant",
          content: "hi",
          usage: {
            promptTokens: 5,
            completionTokens: 5,
            promptTokensDetails: {
              cachedTokens: 119_000,
              cacheWriteTokens: 6_000,
            },
          },
        },
      ],
    });
    expect(cache()?.misses).toBeUndefined();
  });
  it("records a model switch as an expected rebuild, not a miss", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      lastRequestAgoMs: 30_000,
      lastInputTokens: 120_000,
      previousModel: "claude-opus-4-6",
      reply: [
        {
          role: "assistant",
          content: "hi",
          usage: {
            promptTokens: 5,
            completionTokens: 5,
            promptTokensDetails: { cachedTokens: 0, cacheWriteTokens: 125_000 },
          },
        },
      ],
    });
    expect(cache()?.misses).toBeUndefined();
    expect(cache()?.ledger?.[0].missCauses).toEqual(["the model changed"]);
  });

  it("records a shortened conversation as an expected rebuild", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      lastRequestAgoMs: 30_000,
      lastInputTokens: 120_000,
      reply: [
        {
          role: "assistant",
          content: "hi",
          usage: {
            promptTokens: 5,
            completionTokens: 5,
            promptTokensDetails: { cachedTokens: 0, cacheWriteTokens: 30_000 },
          },
        },
      ],
    });
    expect(cache()?.misses).toBeUndefined();
    expect(cache()?.ledger?.[0].missCauses).toEqual([
      "the conversation was shortened (compaction or truncation)",
    ]);
  });

  it("leaves an ordinary request without causes", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      lastRequestAgoMs: 30_000,
      lastInputTokens: 120_000,
      reply: [
        {
          role: "assistant",
          content: "hi",
          usage: {
            promptTokens: 5,
            completionTokens: 5,
            promptTokensDetails: {
              cachedTokens: 119_000,
              cacheWriteTokens: 6_000,
            },
          },
        },
      ],
    });
    expect("missCauses" in (cache()?.ledger?.[0] as object)).toBe(false);
  });

  it("does not look for misses when caching is off", async () => {
    const { cache } = await sentOptions({
      setting: "off",
      lastRequestAgoMs: 30_000,
      lastInputTokens: 120_000,
      reply: [
        {
          role: "assistant",
          content: "hi",
          usage: { promptTokens: 126_000, completionTokens: 5 },
        },
      ],
    });
    expect(cache()?.misses).toBeUndefined();
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

  it("records one ledger entry per request, with counts only", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      mode: "agent",
      lastRequestAgoMs: 60_000,
      lastInputTokens: 80_000,
      reply: [
        {
          role: "assistant",
          content: "hi",
          usage: {
            promptTokens: 12,
            completionTokens: 5,
            promptTokensDetails: {
              cachedTokens: 80_000,
              cacheWriteTokens: 4_000,
              cacheWriteTokens1h: 1_000,
            },
          },
        },
      ],
    });
    const ledger = cache()?.ledger;
    expect(ledger).toHaveLength(1);
    expect(ledger![0]).toMatchObject({
      mode: "agent",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      cachingOn: true,
      ttl: "5m",
      oneHour: true,
      uncached: 12,
      read: 80_000,
      write5m: 3_000,
      write1h: 1_000,
      output: 5,
    });
    // No message text is kept
    expect(JSON.stringify(ledger)).not.toContain("hello");
    expect(JSON.stringify(ledger)).not.toContain('hi"');
  });

  it("keeps what the provider said about the response in the ledger", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      reply: [
        {
          role: "assistant",
          content: "",
          usage: {
            promptTokens: 12,
            completionTokens: 5,
            response: {
              stopReason: "tool_use",
              latencyMs: 812,
              requestId: "req-abc",
            },
          },
        },
      ],
    });
    expect(cache()?.ledger?.[0]).toMatchObject({
      stopReason: "tool_use",
      latencyMs: 812,
      requestId: "req-abc",
    });
  });

  it("leaves those fields out when the provider sent none", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      reply: [
        {
          role: "assistant",
          content: "",
          usage: { promptTokens: 12, completionTokens: 5 },
        },
      ],
    });
    const e = cache()?.ledger?.[0] as any;
    expect("stopReason" in e).toBe(false);
    expect("latencyMs" in e).toBe(false);
    expect("requestId" in e).toBe(false);
  });

  it("notes that caching was off, and keeps recording", async () => {
    const { cache } = await sentOptions({
      setting: "off",
      reply: [
        {
          role: "assistant",
          content: "",
          usage: { promptTokens: 9_000, completionTokens: 5 },
        },
      ],
    });
    expect(cache()?.ledger?.[0]).toMatchObject({
      cachingOn: false,
      uncached: 9_000,
    });
    expect(cache()?.ledger?.[0].ttl).toBeUndefined();
  });

  it("records nothing when the response carries no usage", async () => {
    const { cache } = await sentOptions({
      setting: "auto",
      reply: [{ role: "assistant", content: "hi" }],
    });
    expect(cache()?.ledger).toBeUndefined();
  });
});
