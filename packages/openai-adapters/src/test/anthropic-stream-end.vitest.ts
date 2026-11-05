import { describe, expect, test } from "vitest";

import { AnthropicApi } from "../apis/Anthropic.js";

/** An SSE response carrying these events, like the API sends them. */
function sse(events: object[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const e of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

const start = {
  type: "message_start",
  message: { usage: { input_tokens: 5, output_tokens: 0 } },
};
const blockStart = {
  type: "content_block_start",
  index: 0,
  content_block: { type: "text", text: "" },
};
const text = (t: string) => ({
  type: "content_block_delta",
  index: 0,
  delta: { type: "text_delta", text: t },
});

async function run(events: object[], signal?: AbortSignal) {
  const api = new AnthropicApi({ provider: "anthropic", apiKey: "k" } as any);
  const out: string[] = [];
  for await (const chunk of api.handleStreamResponse(
    sse(events),
    "m",
    signal,
  )) {
    const c = chunk.choices[0]?.delta?.content;
    if (c) out.push(c);
  }
  return out.join("");
}

describe("Anthropic adapter stream end", () => {
  test("a complete stream returns the whole reply", async () => {
    const reply = await run([
      start,
      blockStart,
      text("Hello"),
      { type: "content_block_stop", index: 0 },
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: { output_tokens: 1 },
      },
      { type: "message_stop" },
    ]);
    expect(reply).toBe("Hello");
  });

  test("a stream cut off inside a block is an error, not a short reply", async () => {
    await expect(run([start, blockStart, text("Hel")])).rejects.toThrow(
      /ended before the response was complete/,
    );
  });

  test("a server that closes its blocks but skips message_stop is fine", async () => {
    const reply = await run([
      start,
      blockStart,
      text("Hi"),
      { type: "content_block_stop", index: 0 },
    ]);
    expect(reply).toBe("Hi");
  });

  test("stopping the reply mid-block is not reported as a cut-off", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      run([start, blockStart, text("Hel")], controller.signal),
    ).resolves.toBe("Hel");
  });
});
