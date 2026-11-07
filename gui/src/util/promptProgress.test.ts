import type { ChatMessage } from "core";
import { describe, expect, it } from "vitest";
import { formatPromptProgress, splitPromptProgress } from "./promptProgress";

describe("splitPromptProgress", () => {
  it("keeps the server's updates out of the reply, the latest winning", () => {
    const batch: ChatMessage[] = [
      {
        role: "assistant",
        content: "",
        promptProgress: { total: 100, cache: 0, processed: 10, timeMs: 5 },
      },
      {
        role: "assistant",
        content: "",
        promptProgress: { total: 100, cache: 0, processed: 50, timeMs: 25 },
      },
      { role: "assistant", content: "Hello" },
    ];
    const { progress, reply } = splitPromptProgress(batch);
    expect(progress?.processed).toBe(50);
    expect(reply).toEqual([{ role: "assistant", content: "Hello" }]);
  });

  it("passes a batch without updates through", () => {
    const batch: ChatMessage[] = [{ role: "assistant", content: "Hi" }];
    expect(splitPromptProgress(batch)).toEqual({
      progress: undefined,
      reply: batch,
    });
  });
});

describe("formatPromptProgress", () => {
  it("counts only what is left to read after the cache, with the time left", () => {
    // 300k prompt, 120k from the cache: 180k to read, 60k read in 20 s
    expect(
      formatPromptProgress({
        total: 300_000,
        cache: 120_000,
        processed: 180_000,
        timeMs: 20_000,
      }),
    ).toBe(
      "Reading the prompt: 60k of 180k tokens, 120k from the cache, about 40 s left",
    );
  });

  it("says minutes for a long wait and leaves out what it cannot know", () => {
    expect(
      formatPromptProgress({
        total: 200_000,
        cache: 0,
        processed: 10_000,
        timeMs: 10_000,
      }),
    ).toBe("Reading the prompt: 10k of 200k tokens, about 3 min left");
    expect(
      formatPromptProgress({
        total: 50_000,
        cache: 0,
        processed: 0,
        timeMs: 0,
      }),
    ).toBe("Reading the prompt: 0 of 50k tokens");
  });
});
