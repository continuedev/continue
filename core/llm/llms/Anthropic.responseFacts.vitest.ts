import { beforeEach, describe, expect, test, vi } from "vitest";

// handleResponse reads events through streamSse. Feed it parsed events
// directly: building a real SSE Response is unreliable across Node versions
// (https://github.com/nodejs/undici/issues/2888) and is not what is under test.
const events = vi.hoisted(() => ({ list: [] as any[] }));
vi.mock("@continuedev/fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@continuedev/fetch")>()),
  streamSse: async function* () {
    for (const e of events.list) yield e;
  },
}));

import Anthropic from "./Anthropic.js";

const start = {
  type: "message_start",
  message: {
    id: "msg_123",
    usage: {
      input_tokens: 10,
      cache_read_input_tokens: 5000,
      cache_creation_input_tokens: 700,
      cache_creation: {
        ephemeral_5m_input_tokens: 200,
        ephemeral_1h_input_tokens: 500,
      },
    },
  },
};
const delta = (stop: string | null) => ({
  type: "message_delta",
  delta: { stop_reason: stop, stop_sequence: null },
  usage: { output_tokens: 42 },
});

/** A response with the given headers; its body is ignored (streamSse is mocked). */
const response = (headers: Record<string, string> = {}) =>
  new Response("", { status: 200, headers });

async function lastUsage(res: Response) {
  const a = new Anthropic({ apiKey: "k", model: "claude-sonnet-4-6" } as any);
  const out: any[] = [];
  for await (const m of (a as any).handleResponse(res, true)) out.push(m);
  return out.filter((m) => m.usage).pop()?.usage;
}

describe("Anthropic stream response facts", () => {
  beforeEach(() => {
    events.list = [];
  });

  test("passes on the stop reason and the request-id header", async () => {
    events.list = [start, delta("tool_use")];
    const u = await lastUsage(response({ "request-id": "req_abc" }));
    expect(u.promptTokens).toBe(10);
    expect(u.completionTokens).toBe(42);
    expect(u.promptTokensDetails).toMatchObject({
      cachedTokens: 5000,
      cacheWriteTokens: 700,
      cacheWriteTokens5m: 200,
      cacheWriteTokens1h: 500,
    });
    expect(u.response).toEqual({
      stopReason: "tool_use",
      requestId: "req_abc",
    });
  });

  test("falls back to the message ID when a proxy strips the header", async () => {
    events.list = [start, delta("end_turn")];
    const u = await lastUsage(response());
    expect(u.response).toEqual({
      stopReason: "end_turn",
      requestId: "msg_123",
    });
  });

  test("has no stop reason when the stream never says one", async () => {
    events.list = [start, delta(null)];
    const u = await lastUsage(response());
    expect(u.response).toEqual({ requestId: "msg_123" });
  });

  test("never carries a latency: Anthropic does not send one", async () => {
    events.list = [start, delta("end_turn")];
    const u = await lastUsage(response());
    expect(u.response.latencyMs).toBeUndefined();
  });
});
