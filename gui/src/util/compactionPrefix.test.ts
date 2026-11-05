import type { ModelDescription } from "core";
import { describe, expect, it, vi } from "vitest";
import type { RootState } from "../redux/store";
import { compactionPrefix } from "./compactionPrefix";
import type { PromptCacheSetting } from "./promptCache";
import { getEmptyRootState } from "./test/mockStore";

vi.mock("../redux/util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(() => "You are a helpful assistant."),
}));

const MIN = 60_000;
const NOW = 1_000_000_000_000;

const claude: ModelDescription = {
  title: "Claude Sonnet",
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
};

interface Options {
  model?: ModelDescription;
  setting?: PromptCacheSetting | undefined;
  /** How long ago the last request started; undefined means none yet. */
  agoMs?: number;
  lastTtl?: "5m" | "1h";
  lastInputTokens?: number;
  isPruned?: boolean;
  isStreaming?: boolean;
  summaryAt?: number;
}

/** A session of two exchanges (index 3 is the last item). */
function stateWith(opts: Options = {}): RootState {
  const model = opts.model ?? claude;
  const state = getEmptyRootState();
  state.session.id = "s1";
  state.session.history = [
    { message: { role: "user", content: "one" }, contextItems: [] },
    { message: { role: "assistant", content: "ok" }, contextItems: [] },
    { message: { role: "user", content: "two" }, contextItems: [] },
    { message: { role: "assistant", content: "ok" }, contextItems: [] },
  ] as any;
  if (opts.summaryAt !== undefined) {
    (state.session.history[opts.summaryAt] as any).conversationSummary = "sum";
  }
  state.session.isPruned = !!opts.isPruned;
  state.session.isStreaming = !!opts.isStreaming;
  state.session.mode = "agent";
  state.session.promptCache = {
    escalated: false,
    ...(opts.agoMs !== undefined && {
      lastRequestAt: NOW - opts.agoMs,
      lastTtl: opts.lastTtl ?? "5m",
      lastInputTokens: opts.lastInputTokens ?? 20_000,
    }),
  };
  state.ui.promptCacheSettings =
    "setting" in opts
      ? { [model.title]: opts.setting as any }
      : { [model.title]: "5m" };
  state.config.config = {
    ...state.config.config,
    selectedModelByRole: {
      ...state.config.config.selectedModelByRole,
      chat: model,
    },
  };
  return state;
}

const LAST = 3;

describe("compactionPrefix: when it sends the conversation's prefix", () => {
  it("does, while the cache is warm and the whole conversation is compacted", () => {
    const p = compactionPrefix(stateWith({ agoMs: 1 * MIN }), LAST, NOW);
    expect(p).toBeDefined();
    expect(p!.messages[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining("You are a helpful assistant."),
    });
    expect(p!.messages.filter((m) => m.role !== "system")).toHaveLength(4);
    expect(p!.options.promptCaching).toBe(true);
  });

  it("uses the lifetime the last request wrote with, not what Auto would pick now", () => {
    const p = compactionPrefix(
      stateWith({ setting: "auto", agoMs: 10 * MIN, lastTtl: "1h" }),
      LAST,
      NOW,
    );
    expect(p?.options.promptCacheTtl).toBe("1h");
    const q = compactionPrefix(
      stateWith({ setting: "auto", agoMs: 1 * MIN, lastTtl: "5m" }),
      LAST,
      NOW,
    );
    expect(q?.options.promptCacheTtl).toBe("5m");
  });
});

describe("compactionPrefix: when it does not (the plain request is cheaper)", () => {
  it("when the cache has expired", () => {
    expect(
      compactionPrefix(stateWith({ agoMs: 6 * MIN }), LAST, NOW),
    ).toBeUndefined();
  });

  it("when a 5-minute entry is just past its lifetime, but a 1-hour one is not", () => {
    expect(
      compactionPrefix(stateWith({ agoMs: 5 * MIN + 1 }), LAST, NOW),
    ).toBeUndefined();
    expect(
      compactionPrefix(
        stateWith({ agoMs: 30 * MIN, lastTtl: "1h" }),
        LAST,
        NOW,
      ),
    ).toBeDefined();
  });

  it("when there has been no request yet", () => {
    expect(compactionPrefix(stateWith(), LAST, NOW)).toBeUndefined();
  });

  it("when caching is off, by the toolbar or by config", () => {
    expect(
      compactionPrefix(stateWith({ setting: "off", agoMs: MIN }), LAST, NOW),
    ).toBeUndefined();
    const configOff = {
      ...claude,
      completionOptions: { promptCaching: false },
    } as ModelDescription;
    expect(
      compactionPrefix(
        stateWith({ model: configOff, setting: undefined, agoMs: MIN }),
        LAST,
        NOW,
      ),
    ).toBeUndefined();
  });

  it("when nothing is chosen in Chat, where caching is not on by default", () => {
    const s = stateWith({ setting: undefined, agoMs: MIN });
    s.session.mode = "chat";
    expect(compactionPrefix(s, LAST, NOW)).toBeUndefined();
  });

  it("in Agent when nothing is chosen and config is silent, where it is on by default", () => {
    expect(
      compactionPrefix(
        stateWith({ setting: undefined, agoMs: MIN }),
        LAST,
        NOW,
      ),
    ).toBeDefined();
  });

  it("when the last prompt was below the model's cache minimum", () => {
    expect(
      compactionPrefix(
        stateWith({ agoMs: MIN, lastInputTokens: 500 }),
        LAST,
        NOW,
      ),
    ).toBeUndefined();
  });

  it("when only part of the conversation is compacted", () => {
    expect(compactionPrefix(stateWith({ agoMs: MIN }), 1, NOW)).toBeUndefined();
  });

  it("when the target already has a summary (a re-compaction ignores it)", () => {
    expect(
      compactionPrefix(stateWith({ agoMs: MIN, summaryAt: LAST }), LAST, NOW),
    ).toBeUndefined();
  });

  it("when the last request was pruned to fit, or a response is streaming", () => {
    expect(
      compactionPrefix(stateWith({ agoMs: MIN, isPruned: true }), LAST, NOW),
    ).toBeUndefined();
    expect(
      compactionPrefix(stateWith({ agoMs: MIN, isStreaming: true }), LAST, NOW),
    ).toBeUndefined();
  });

  it("for a model the cache button does not cover", () => {
    const gpt = {
      title: "GPT",
      model: "gpt-4o",
      provider: "openai",
      underlyingProviderName: "openai",
    };
    expect(
      compactionPrefix(stateWith({ model: gpt, agoMs: MIN }), LAST, NOW),
    ).toBeUndefined();
  });

  it("when no chat model is selected", () => {
    const s = stateWith({ agoMs: MIN });
    s.config.config = {
      ...s.config.config,
      selectedModelByRole: {
        ...s.config.config.selectedModelByRole,
        chat: null,
      },
    };
    expect(compactionPrefix(s, LAST, NOW)).toBeUndefined();
  });
});
