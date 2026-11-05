import { describe, expect, it } from "vitest";

import { GeminiApi } from "./Gemini.js";

const api = () =>
  new GeminiApi({ provider: "gemini", apiKey: "k" } as any) as any;

async function* stream(chunks: any[]) {
  for (const c of chunks) yield c;
}

async function usageOf(chunks: any[]) {
  const out: any[] = [];
  for await (const c of api().processStreamResponse(
    stream(chunks),
    "gemini-2.5-pro",
  )) {
    out.push(c);
  }
  return out.find((c) => c.usage)?.usage;
}

// A real stream ends with a finishReason on the candidate.
const text = {
  candidates: [{ content: { parts: [{ text: "hi" }] }, finishReason: "STOP" }],
};

describe("Gemini usage with implicit caching", () => {
  it("reports the cached part of the prompt as cache reads", async () => {
    const usage = await usageOf([
      text,
      {
        usageMetadata: {
          promptTokenCount: 9000,
          cachedContentTokenCount: 7000,
          candidatesTokenCount: 20,
          totalTokenCount: 9020,
        },
      },
    ]);
    expect(usage).toEqual({
      prompt_tokens: 9000,
      completion_tokens: 20,
      total_tokens: 9020,
      prompt_tokens_details: { cached_tokens: 7000, cache_read_tokens: 7000 },
    });
  });

  it("leaves usage as it was when nothing was cached", async () => {
    for (const cachedContentTokenCount of [undefined, 0]) {
      const usage = await usageOf([
        text,
        {
          usageMetadata: {
            promptTokenCount: 120,
            cachedContentTokenCount,
            candidatesTokenCount: 5,
            totalTokenCount: 125,
          },
        },
      ]);
      expect(usage).toEqual({
        prompt_tokens: 120,
        completion_tokens: 5,
        total_tokens: 125,
      });
    }
  });

  it("uses the last usage block, as it did before", async () => {
    const usage = await usageOf([
      { usageMetadata: { promptTokenCount: 100, totalTokenCount: 100 } },
      text,
      {
        usageMetadata: {
          promptTokenCount: 100,
          cachedContentTokenCount: 64,
          candidatesTokenCount: 9,
          totalTokenCount: 109,
        },
      },
    ]);
    expect(usage.prompt_tokens_details.cache_read_tokens).toBe(64);
    expect(usage.completion_tokens).toBe(9);
  });
});
