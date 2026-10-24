import { describe, expect, it, vi } from "vitest";

import { OpenAIApi } from "../apis/OpenAI.js";

function chunk(partial: Record<string, unknown>) {
  return {
    id: "chatcmpl-gemini",
    object: "chat.completion.chunk",
    created: 1,
    model: "gemini-2.5-flash",
    ...partial,
  };
}

describe("OpenAI adapter Gemini-style usage chunks", () => {
  function api() {
    return new OpenAIApi({
      provider: "openai",
      apiKey: "test",
      apiBase: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }

  async function collect(
    openai: OpenAIApi,
    chunks: ReturnType<typeof chunk>[],
  ) {
    vi.spyOn(openai.openai.chat.completions, "create").mockResolvedValue(
      (async function* () {
        for (const item of chunks) {
          yield item;
        }
      })() as any,
    );

    const out = [];
    for await (const item of openai.chatCompletionStream(
      {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      new AbortController().signal,
    )) {
      out.push(item);
    }
    return out;
  }

  it("keeps content and tool calls when every chunk also has usage", async () => {
    const out = await collect(api(), [
      chunk({
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "Hello " },
            finish_reason: null,
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
      }),
      chunk({
        choices: [
          {
            index: 0,
            delta: {
              content: "world",
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  type: "function",
                  function: { name: "read_file", arguments: '{"path":"a"}' },
                  extra_content: { google: { thought_signature: "sig" } },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 },
        extra_field_ignored_by_spec: true,
      }),
      chunk({
        choices: [],
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      }),
    ]);

    const text = out
      .map((item) => item.choices?.[0]?.delta?.content ?? "")
      .join("");
    expect(text).toBe("Hello world");

    const toolCalls = out.flatMap(
      (item) => item.choices?.[0]?.delta?.tool_calls ?? [],
    );
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]?.function?.name).toBe("read_file");
    expect(toolCalls[0]?.function?.arguments).toBe('{"path":"a"}');
    expect((toolCalls[0] as { extra_content?: unknown }).extra_content).toEqual(
      { google: { thought_signature: "sig" } },
    );

    const withUsage = out.filter((item) => item.usage);
    expect(withUsage[withUsage.length - 1]?.usage).toMatchObject({
      prompt_tokens: 8,
      completion_tokens: 4,
      total_tokens: 12,
    });
    expect(out[out.length - 1]?.choices).toEqual([]);
  });

  it("still emits the spec usage chunk after content that has no usage", async () => {
    const out = await collect(api(), [
      chunk({
        choices: [
          {
            index: 0,
            delta: { content: "Hi" },
            finish_reason: null,
          },
        ],
      }),
      chunk({
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      }),
      chunk({
        choices: [],
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
      }),
    ]);

    expect(
      out
        .filter((item) => (item.choices?.length ?? 0) > 0)
        .map((item) => item.choices[0]?.delta?.content ?? "")
        .join(""),
    ).toBe("Hi");
    expect(out[out.length - 1]?.usage).toMatchObject({
      prompt_tokens: 3,
      completion_tokens: 1,
    });
    expect(out[out.length - 1]?.choices).toEqual([]);
  });
});
