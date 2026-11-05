import { describe, expect, it } from "vitest";

import {
  fromChatCompletionChunk,
  fromChatResponse,
  usageFromCompletionUsage,
} from "./openaiTypeConverters";

describe("usage from OpenAI-format responses", () => {
  it("surfaces the usage-only last chunk of a stream", () => {
    const msg = fromChatCompletionChunk({
      id: "c",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-5",
      choices: [],
      usage: {
        prompt_tokens: 12_000,
        completion_tokens: 300,
        total_tokens: 12_300,
        prompt_tokens_details: { cached_tokens: 10_000 },
      },
    } as any);
    expect(msg).toEqual({
      role: "assistant",
      content: "",
      usage: {
        promptTokens: 12_000,
        completionTokens: 300,
        promptTokensDetails: { cachedTokens: 10_000 },
      },
    });
  });

  it("keeps the content of a chunk that also carries usage", () => {
    const msg = fromChatCompletionChunk({
      choices: [{ index: 0, delta: { content: "done" } }],
      usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
    } as any);
    expect(msg).toMatchObject({
      role: "assistant",
      content: "done",
      usage: { promptTokens: 5, completionTokens: 1 },
    });
  });

  it("leaves chunks without usage as they were", () => {
    expect(
      fromChatCompletionChunk({
        choices: [{ index: 0, delta: { content: "hi" } }],
      } as any),
    ).toEqual({ role: "assistant", content: "hi" });
    expect(fromChatCompletionChunk({ choices: [] } as any)).toBeUndefined();
  });

  it("reads the Anthropic adapter's cache fields", () => {
    expect(
      usageFromCompletionUsage({
        prompt_tokens: 50,
        completion_tokens: 10,
        prompt_tokens_details: {
          cached_tokens: 0,
          cache_read_tokens: 9_000,
          cache_write_tokens: 1_200,
        },
      }),
    ).toEqual({
      promptTokens: 50,
      completionTokens: 10,
      promptTokensDetails: { cachedTokens: 9_000, cacheWriteTokens: 1_200 },
    });
  });

  it("attaches usage to a non-streamed response", () => {
    const messages = fromChatResponse({
      choices: [{ index: 0, message: { role: "assistant", content: "ok" } }],
      usage: { prompt_tokens: 7, completion_tokens: 2, total_tokens: 9 },
    } as any);
    expect(messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "ok",
      usage: { promptTokens: 7, completionTokens: 2 },
    });
  });
});
