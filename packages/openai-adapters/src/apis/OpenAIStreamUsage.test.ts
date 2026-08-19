import { ChatCompletionChunk } from "openai/resources/index";
import { describe, expect, it, vi } from "vitest";

import { OpenAIApi } from "./OpenAI.js";

/**
 * Regression tests for streaming chunks that carry `usage`.
 *
 * The adapter defers usage chunks so that usage is reported after content.
 * OpenAI sends usage exactly once, in a terminal chunk with empty `choices`.
 * llama.cpp-based servers can instead attach a *running* usage object to every
 * chunk; deferring on the presence of `usage` alone swallowed those streams
 * entirely, producing empty assistant messages.
 */

function chunk(
  delta: Record<string, unknown>,
  usage?: { completion_tokens: number },
  finish_reason: string | null = null,
): ChatCompletionChunk {
  return {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "test-model",
    choices: [{ index: 0, delta, finish_reason }],
    ...(usage
      ? {
          usage: {
            prompt_tokens: 10,
            total_tokens: 10 + usage.completion_tokens,
            ...usage,
          },
        }
      : {}),
  } as unknown as ChatCompletionChunk;
}

/** Multi-choice chunk, for `n > 1` requests. */
function multiChoiceChunk(
  deltas: Record<string, unknown>[],
  usage?: { completion_tokens: number },
): ChatCompletionChunk {
  return {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "test-model",
    choices: deltas.map((delta, index) => ({
      index,
      delta,
      finish_reason: null,
    })),
    ...(usage
      ? {
          usage: {
            prompt_tokens: 10,
            total_tokens: 10 + usage.completion_tokens,
            ...usage,
          },
        }
      : {}),
  } as unknown as ChatCompletionChunk;
}

function apiYielding(chunks: ChatCompletionChunk[]) {
  const api = new OpenAIApi({
    provider: "openai",
    apiKey: "test-key",
    apiBase: "http://custom:8080/v1/",
  });
  vi.spyOn(api["openai"].chat.completions, "create").mockResolvedValue({
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) {
        yield c;
      }
    },
  } as any);
  return api;
}

async function collect(api: OpenAIApi, body: any) {
  const out: ChatCompletionChunk[] = [];
  for await (const c of api.chatCompletionStream(
    body,
    new AbortController().signal,
  )) {
    out.push(c);
  }
  return out;
}

const body = {
  model: "test-model",
  messages: [{ role: "user" as const, content: "hi" }],
  stream: true as const,
};

describe("chatCompletionStream usage handling", () => {
  it("preserves content when every chunk carries a running usage object", async () => {
    // Shape observed from the local orchestrator: usage increments per token.
    const api = apiYielding([
      chunk({ role: "assistant", content: null }, { completion_tokens: 1 }),
      chunk({ reasoning_content: "think" }, { completion_tokens: 2 }),
      chunk({ content: "Hello" }, { completion_tokens: 3 }),
      chunk({ content: " world" }, { completion_tokens: 4 }),
      chunk({}, { completion_tokens: 5 }, "stop"),
    ]);

    const out = await collect(api, body);

    const text = out
      .map((c) => (c.choices?.[0]?.delta as any)?.content ?? "")
      .join("");
    expect(text).toBe("Hello world");

    const reasoning = out
      .map((c) => (c.choices?.[0]?.delta as any)?.reasoning_content ?? "")
      .join("");
    expect(reasoning).toBe("think");

    // Nothing is dropped, and the finish_reason chunk still arrives.
    expect(out).toHaveLength(5);
    expect(out.at(-1)?.choices?.[0]?.finish_reason).toBe("stop");
  });

  it("still defers a terminal usage-only chunk to the end", async () => {
    // OpenAI shape with stream_options.include_usage: usage arrives alone.
    const api = apiYielding([
      chunk({ content: "Hello" }),
      chunk({ content: " world" }),
      {
        id: "chatcmpl-test",
        object: "chat.completion.chunk",
        created: 0,
        model: "test-model",
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      } as unknown as ChatCompletionChunk,
    ]);

    const out = await collect(api, body);

    expect(out).toHaveLength(3);
    expect(out.at(-1)?.usage?.completion_tokens).toBe(2);
    expect(
      out
        .slice(0, 2)
        .map((c) => (c.choices?.[0]?.delta as any)?.content)
        .join(""),
    ).toBe("Hello world");
  });

  it("does not emit a duplicate trailing chunk when usage rides on content", async () => {
    const api = apiYielding([
      // Leading usage-only chunk, so a deferred chunk actually exists to be
      // cleared. Without it this test passes even if clearing is broken.
      chunk({}, { completion_tokens: 0 }),
      chunk({ content: "A" }, { completion_tokens: 1 }),
      chunk({ content: "B" }, { completion_tokens: 2 }, "stop"),
    ]);

    const out = await collect(api, body);

    expect(out).toHaveLength(2);
    expect(
      out.map((c) => (c.choices?.[0]?.delta as any)?.content).join(""),
    ).toBe("AB");
  });

  it("does not defer a chunk when a later choice carries content (n > 1)", async () => {
    const api = apiYielding([
      // choices[0] is empty but choices[1] has content: inspecting only the
      // first choice would classify this as usage-only and drop "B".
      multiChoiceChunk([{}, { content: "B" }], { completion_tokens: 1 }),
      chunk({ content: "A" }, { completion_tokens: 2 }, "stop"),
    ]);

    const out = await collect(api, body);

    expect(out).toHaveLength(2);
    expect((out[0].choices?.[1]?.delta as any)?.content).toBe("B");
  });

  it("still defers a chunk when every choice is empty (n > 1)", async () => {
    const api = apiYielding([
      chunk({ content: "A" }, undefined, "stop"),
      multiChoiceChunk([{}, {}], { completion_tokens: 3 }),
    ]);

    const out = await collect(api, body);

    // The usage-only chunk is deferred, then emitted last.
    expect(out).toHaveLength(2);
    expect((out[0].choices?.[0]?.delta as any)?.content).toBe("A");
    expect(out[1].usage?.completion_tokens).toBe(3);
  });
});
