import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatMessage } from "../index.js";
import OpenAI from "./llms/OpenAI";
import {
  promptProgressOf,
  resetPromptProgressSupport,
  streamsPromptProgress,
} from "./localServers";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** A server that answers /props as llama.cpp and Strata do. */
const llamaCppServer = vi.fn(async (url: URL | string) =>
  new URL(String(url)).pathname === "/props"
    ? json({ default_generation_settings: { n_ctx: 4096 }, total_slots: 1 })
    : json({ error: "not found" }, 404),
);

const progressChunk = {
  id: "c",
  object: "chat.completion.chunk",
  choices: [{ index: 0, delta: {}, finish_reason: null }],
  prompt_progress: { total: 1000, cache: 200, processed: 600, time_ms: 400 },
};
const textChunk = {
  id: "c",
  object: "chat.completion.chunk",
  choices: [{ index: 0, delta: { content: "hi" }, finish_reason: null }],
};

function modelAt(apiBase: string) {
  const llm = new OpenAI({ model: "qwen", apiBase, apiKey: "k" });
  const sent: any[] = [];
  (llm as any).openaiAdapter = {
    chatCompletionStream: async function* (body: any) {
      sent.push(body);
      yield progressChunk;
      yield textChunk;
    },
  };
  return { llm, sent };
}

async function collect(llm: OpenAI): Promise<ChatMessage[]> {
  const out: ChatMessage[] = [];
  for await (const m of llm.streamChat(
    [{ role: "user", content: "x" }],
    new AbortController().signal,
  )) {
    out.push(m);
  }
  return out;
}

beforeEach(() => {
  resetPromptProgressSupport();
  llamaCppServer.mockClear();
  vi.stubGlobal("fetch", llamaCppServer);
});
afterEach(() => vi.unstubAllGlobals());

describe("prompt progress from a local server", () => {
  it("asks a llama.cpp-style server for it and passes the updates on apart from the reply", async () => {
    const { llm, sent } = modelAt("http://127.0.0.1:8083/v1/");
    const out = await collect(llm);
    expect(sent[0].return_progress).toBe(true);
    expect(out[0]).toEqual({
      role: "assistant",
      content: "",
      promptProgress: { total: 1000, cache: 200, processed: 600, timeMs: 400 },
    });
    expect(out.some((m) => m.content === "hi")).toBe(true);
  });

  it("asks a server about it once", async () => {
    const { llm } = modelAt("http://127.0.0.1:8083/v1/");
    await collect(llm);
    await collect(llm);
    expect(
      llamaCppServer.mock.calls.filter(
        ([url]) => new URL(String(url)).pathname === "/props",
      ),
    ).toHaveLength(1);
  });

  it("never sends the field to, or asks, a cloud API", async () => {
    const { llm, sent } = modelAt("https://api.openai.com/v1/");
    await collect(llm);
    expect(sent[0]).not.toHaveProperty("return_progress");
    expect(llamaCppServer).not.toHaveBeenCalled();
  });

  it("does not send it to a local server without /props (vLLM, LM Studio)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "not found" }, 404)),
    );
    expect(await streamsPromptProgress("http://127.0.0.1:8000/v1/")).toBe(
      false,
    );
  });
});

describe("promptProgressOf", () => {
  it("reads llama.cpp's fields and ignores chunks without them", () => {
    expect(promptProgressOf(progressChunk)).toEqual({
      total: 1000,
      cache: 200,
      processed: 600,
      timeMs: 400,
    });
    expect(promptProgressOf(textChunk)).toBeUndefined();
    expect(promptProgressOf({ prompt_progress: { total: 0 } })).toBeUndefined();
  });
});

describe("prompt read speed", () => {
  it("carries the server's timings.prompt_per_second on the usage", async () => {
    const llm = new OpenAI({
      model: "qwen",
      apiBase: "http://127.0.0.1:8083/v1/",
      apiKey: "k",
    });
    (llm as any).openaiAdapter = {
      chatCompletionStream: async function* () {
        yield textChunk;
        yield {
          id: "c",
          object: "chat.completion.chunk",
          choices: [],
          usage: {
            prompt_tokens: 120_000,
            completion_tokens: 10,
            total_tokens: 120_010,
            prompt_tokens_details: { cached_tokens: 100_000 },
          },
          timings: { prompt_per_second: 950.5, cache_n: 100_000 },
        };
      },
    };
    const out = await collect(llm);
    const usage = out.find((m) => m.role === "assistant" && m.usage) as any;
    expect(usage.usage).toMatchObject({
      promptTokens: 120_000,
      promptTokensPerSecond: 950.5,
    });
  });
});
