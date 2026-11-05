import type { ChatMessage, ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import {
  detectCacheMiss,
  expectedRebuildCauses,
  MODEL_CHANGED,
  promptCacheKey,
  SHORTER_PROMPT_CAUSE,
} from "./cacheSafeguards";
import type { PromptCacheSessionState } from "./promptCache";

const MIN = 60 * 1000;
const t0 = 1_000_000_000;

const model = (id: string): ModelDescription => ({
  title: id,
  provider: "anthropic",
  model: id,
  underlyingProviderName: "anthropic",
});
const sonnet = model("claude-sonnet-4-6");
const opus = model("claude-opus-4-6");
const msgs: ChatMessage[] = [{ role: "user", content: "hi" }];

const key = (m: ModelDescription) =>
  promptCacheKey(m, ["read_file"], "sys", msgs);
const before = (
  extra: Partial<PromptCacheSessionState> = {},
): PromptCacheSessionState => ({
  escalated: false,
  lastRequestAt: t0,
  lastTtl: "5m",
  lastInputTokens: 200_000,
  lastKey: key(sonnet),
  ...extra,
});
const request = (extra: object = {}) => ({
  before: before(),
  key: key(sonnet),
  requestAt: t0 + 30 * 1000,
  readTokens: 0,
  totalInputTokens: 210_000,
  ...extra,
});

describe("expectedRebuildCauses", () => {
  it("names a model switch that read none of the cache", () => {
    expect(expectedRebuildCauses(request({ key: key(opus) }))).toEqual([
      MODEL_CHANGED,
    ]);
  });

  it("names a conversation that got shorter (compaction or a cut)", () => {
    expect(
      expectedRebuildCauses(request({ totalInputTokens: 40_000 })),
    ).toEqual([SHORTER_PROMPT_CAUSE]);
  });

  it("names both when both happened", () => {
    expect(
      expectedRebuildCauses(
        request({ key: key(opus), totalInputTokens: 40_000 }),
      ),
    ).toEqual([MODEL_CHANGED, SHORTER_PROMPT_CAUSE]);
  });

  it("is undefined when the cache was read", () => {
    expect(
      expectedRebuildCauses(request({ key: key(opus), readTokens: 150_000 })),
    ).toBeUndefined();
  });

  it("is undefined for an ordinary request, so detectCacheMiss keeps the faults", () => {
    expect(expectedRebuildCauses(request())).toBeUndefined();
  });

  it("is undefined when the previous cache had already expired", () => {
    expect(
      expectedRebuildCauses(
        request({ key: key(opus), requestAt: t0 + 6 * MIN }),
      ),
    ).toBeUndefined();
  });

  it("uses the 1-hour lifetime the last request was written with", () => {
    expect(
      expectedRebuildCauses(
        request({
          key: key(opus),
          before: before({ lastTtl: "1h" }),
          requestAt: t0 + 30 * MIN,
        }),
      ),
    ).toEqual([MODEL_CHANGED]);
  });

  it("is undefined for a small previous prompt, or before any request", () => {
    expect(
      expectedRebuildCauses(
        request({
          key: key(opus),
          before: before({ lastInputTokens: 10_000 }),
        }),
      ),
    ).toBeUndefined();
    expect(
      expectedRebuildCauses(
        request({ key: key(opus), before: { escalated: false } }),
      ),
    ).toBeUndefined();
  });

  it("does not call a switch when the previous key is unknown", () => {
    expect(
      expectedRebuildCauses(
        request({ key: key(opus), before: before({ lastKey: undefined }) }),
      ),
    ).toBeUndefined();
  });
});

describe("expectedRebuildCauses and detectCacheMiss never both claim a request", () => {
  it("a model switch alone is the detector's silence and ours", () => {
    const r = request({ key: key(opus) });
    expect(detectCacheMiss(r)).toBeUndefined();
    expect(expectedRebuildCauses(r)).toEqual([MODEL_CHANGED]);
  });

  it("a shortened conversation is the detector's silence and ours", () => {
    const r = request({ totalInputTokens: 40_000 });
    expect(detectCacheMiss(r)).toBeUndefined();
    expect(expectedRebuildCauses(r)).toEqual([SHORTER_PROMPT_CAUSE]);
  });

  it("a real fault is the detector's, not ours", () => {
    const changedTools = promptCacheKey(
      sonnet,
      ["read_file", "grep"],
      "sys",
      msgs,
    );
    const r = request({ key: changedTools });
    expect(detectCacheMiss(r)?.causes).toEqual(["the tools changed"]);
    expect(expectedRebuildCauses(r)).toBeUndefined();
  });
});
