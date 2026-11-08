import { beforeEach, describe, expect, it, vi } from "vitest";

const requests: { path: string; body: any }[] = [];
const server = vi.fn();

vi.mock("@continuedev/fetch", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchwithRequestOptions: (url: URL, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    requests.push({ path: new URL(url).pathname, body });
    return server(new URL(url).pathname, body);
  },
}));

import OpenAI from "./OpenAI";

const sse = (...deltas: object[]) =>
  new Response(
    deltas
      .map(
        (delta) =>
          `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`,
      )
      .join("") + "data: [DONE]\n\n",
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
const notFound = () =>
  new Response(JSON.stringify({ error: { message: "not found" } }), {
    status: 404,
  });

/** Answers chat only, as Strata does: `/v1/completions` is a 404. */
function chatOnlyServer(path: string) {
  if (path.endsWith("/chat/completions")) {
    return sse(
      { reasoning_content: "The hole wants a distance." },
      { content: "return 1;" },
    );
  }
  return notFound();
}

async function complete(llm: OpenAI) {
  let out = "";
  for await (const chunk of llm.streamComplete(
    "prompt",
    new AbortController().signal,
    { raw: true },
  )) {
    out += chunk;
  }
  return out;
}

let n = 0;
/** A fresh address each time, as what the provider learns is per server. */
function modelAt(host = "127.0.0.1") {
  return new OpenAI({
    model: "qwen3.8-flash-next",
    apiBase: `http://${host}:${9000 + n++}/v1/`,
    apiKey: "k",
  });
}

describe("OpenAI provider and a server that serves only chat", () => {
  beforeEach(() => {
    requests.length = 0;
    server.mockReset();
    server.mockImplementation(chatOnlyServer);
  });

  it("sends a raw prompt over chat when /completions is missing, and remembers", async () => {
    const llm = modelAt();
    expect(await complete(llm)).toBe("return 1;");
    expect(requests.map((r) => r.path)).toEqual([
      "/v1/completions",
      "/v1/chat/completions",
    ]);
    expect(requests[1].body.messages).toEqual([
      { role: "user", content: "prompt" },
    ]);

    // The next prompt goes straight to chat.
    expect(await complete(llm)).toBe("return 1;");
    expect(requests.map((r) => r.path).slice(2)).toEqual([
      "/v1/chat/completions",
    ]);
  });

  it("turns thinking off for a raw prompt to a local server", async () => {
    await complete(modelAt());
    expect(requests[1].body.chat_template_kwargs).toEqual({
      enable_thinking: false,
    });
  });

  it("does not send the thinking switch to a cloud server", async () => {
    await complete(modelAt("api.example.com"));
    expect(requests[1].body.chat_template_kwargs).toBeUndefined();
  });

  it("leaves the reasoning out of the completion", async () => {
    expect(await complete(modelAt())).not.toContain("distance");
  });

  it("still uses /completions on servers that have it", async () => {
    server.mockImplementation((path: string) =>
      path.endsWith("/v1/completions")
        ? new Response(
            `data: ${JSON.stringify({ choices: [{ text: "fim" }] })}\n\ndata: [DONE]\n\n`,
            { status: 200 },
          )
        : notFound(),
    );
    expect(await complete(modelAt())).toBe("fim");
    expect(requests.map((r) => r.path)).toEqual(["/v1/completions"]);
  });

  it("does not hide other errors", async () => {
    server.mockImplementation(
      () =>
        new Response(JSON.stringify({ error: "bad prompt" }), { status: 400 }),
    );
    await expect(complete(modelAt())).rejects.toThrow(/400/);
    expect(requests).toHaveLength(1);
  });
});

describe("Edit and Apply on a local server", () => {
  async function chatBody(apiBase: string, reasoning?: boolean) {
    const llm = new OpenAI({ model: "qwen3.8", apiBase, apiKey: "k" });
    const sent: any[] = [];
    (llm as any).openaiAdapter = {
      chatCompletionStream: async function* (body: any) {
        sent.push(body);
      },
    };
    for await (const _ of llm.streamChat(
      [{ role: "user", content: "x" }],
      new AbortController().signal,
      { reasoning },
    )) {
      // drain
    }
    return sent[0];
  }

  it("turns thinking off when the request asks for no reasoning", async () => {
    const body = await chatBody(`http://127.0.0.1:${9000 + n++}/v1/`, false);
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("leaves chat's thinking alone", async () => {
    const body = await chatBody(`http://127.0.0.1:${9000 + n++}/v1/`);
    expect(body.chat_template_kwargs).toBeUndefined();
  });
});
