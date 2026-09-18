import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VercelAIGatewayApi } from "../apis/VercelAIGateway.js";
import { constructLlmApi } from "../index.js";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("../util.js", async (original) => ({
  ...(await original<any>()),
  customFetch: () => fetchMock,
}));
const config = {
  provider: "vercel-ai-gateway" as const,
  apiKey: "gateway-test-key",
};
const model = "anthropic/claude-sonnet-4.6";
const signal = () => new AbortController().signal;
const chatResult = {
  id: "chat-1",
  created: 1,
  object: "chat.completion",
  model,
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      message: { role: "assistant", content: "ok" },
    },
  ],
  usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
function stream(chunks: unknown[]) {
  return new Response(
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
      "data: [DONE]\n\n",
    { headers: { "content-type": "text/event-stream" } },
  );
}
const contentChunk = {
  id: "chat-1",
  created: 1,
  object: "chat.completion.chunk",
  model,
  choices: [
    {
      index: 0,
      delta: { role: "assistant", content: "inserted" },
      finish_reason: null,
    },
  ],
};

beforeEach(() => fetchMock.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe("Vercel Gateway wire contract", () => {
  it("keeps Gateway routing even when the legacy AI SDK switch is enabled", async () => {
    vi.stubEnv("CONTINUE_USE_AI_SDK", "true");
    fetchMock.mockResolvedValue(json(chatResult));
    const api = constructLlmApi(config)!;
    expect(api).toBeInstanceOf(VercelAIGatewayApi);
    await api.chatCompletionNonStream(
      { model, messages: [{ role: "user", content: "hello" }] },
      signal(),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://ai-gateway.vercel.sh/v1/chat/completions",
    );
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer gateway-test-key",
    );
    expect(JSON.parse(init.body).model).toBe(model);
  });

  it("preserves streaming tool deltas, tool results, and usage", async () => {
    const toolChunk = {
      ...contentChunk,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call-1",
                type: "function",
                function: {
                  name: "read_skill",
                  arguments: '{"skillName":"review"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };
    fetchMock.mockResolvedValue(
      stream([
        toolChunk,
        { ...contentChunk, choices: [], usage: chatResult.usage },
      ]),
    );
    const api = new VercelAIGatewayApi(config);
    const chunks = [];
    for await (const chunk of api.chatCompletionStream(
      {
        model,
        stream: true,
        messages: [
          {
            role: "assistant",
            tool_calls: [
              {
                id: "earlier",
                type: "function",
                function: { name: "read_skill", arguments: "{}" },
              },
            ],
          },
          {
            role: "tool",
            tool_call_id: "earlier",
            content: "skill instructions",
          },
        ],
        tools: [
          {
            type: "function",
            function: { name: "read_skill", parameters: { type: "object" } },
          },
        ],
      },
      signal(),
    ))
      chunks.push(chunk);
    expect(chunks[0].choices[0].delta.tool_calls?.[0].function?.name).toBe(
      "read_skill",
    );
    expect(chunks.at(-1)?.usage?.total_tokens).toBe(3);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1]).toMatchObject({
      role: "tool",
      tool_call_id: "earlier",
    });
    expect(body.stream_options.include_usage).toBe(true);
  });

  it("translates autocomplete prefix/suffix into chat, never a legacy FIM endpoint", async () => {
    fetchMock.mockResolvedValue(stream([contentChunk]));
    const api = new VercelAIGatewayApi(config);
    const chunks = [];
    for await (const chunk of api.fimStream(
      {
        model,
        prompt: "const x = ",
        suffix: ";",
        stream: true,
        max_tokens: 64,
      },
      signal(),
    ))
      chunks.push(chunk);
    expect(chunks[0].choices[0].delta.content).toBe("inserted");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url).endsWith("/chat/completions")).toBe(true);
    expect(JSON.parse(init.body).messages[1].content).toContain("SUFFIX:\n;");
  });

  it("translates text completions to chat responses", async () => {
    fetchMock
      .mockResolvedValueOnce(json(chatResult))
      .mockResolvedValueOnce(stream([contentChunk]));
    const api = new VercelAIGatewayApi(config);
    expect(
      (await api.completionNonStream({ model, prompt: "code" }, signal()))
        .choices[0].text,
    ).toBe("ok");
    const chunks = [];
    for await (const chunk of api.completionStream(
      { model, prompt: "code", stream: true },
      signal(),
    ))
      chunks.push(chunk);
    expect(chunks[0].choices[0].text).toBe("inserted");
    expect(
      fetchMock.mock.calls.every(([url]) =>
        String(url).endsWith("/chat/completions"),
      ),
    ).toBe(true);
  });

  it("uses Gateway embeddings and model catalog endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          data: [{ index: 0, embedding: [0.1, 0.2], object: "embedding" }],
          model: "openai/text-embedding-3-small",
          object: "list",
          usage: { total_tokens: 1, prompt_tokens: 1 },
        }),
      )
      .mockResolvedValueOnce(
        json({
          object: "list",
          data: [
            { id: model, object: "model", created: 1, owned_by: "anthropic" },
          ],
        }),
      );
    const api = new VercelAIGatewayApi(config);
    expect(
      (
        await api.embed({
          model: "openai/text-embedding-3-small",
          input: ["code"],
        })
      ).data[0].embedding,
    ).toEqual([0.1, 0.2]);
    expect((await api.list())[0].id).toBe(model);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://ai-gateway.vercel.sh/v1/embeddings",
      "https://ai-gateway.vercel.sh/v1/models",
    ]);
  });

  it("adapts Cohere-compatible reranking to core score format", async () => {
    fetchMock.mockResolvedValue(
      json({ results: [{ index: 1, relevance_score: 0.9 }] }),
    );
    const response = await new VercelAIGatewayApi(config).rerank({
      model: "cohere/rerank-v3.5",
      query: "q",
      documents: ["a", "b"],
      top_k: 1,
    });
    expect(response.data).toEqual([{ index: 1, relevance_score: 0.9 }]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://ai-gateway.vercel.sh/v2/rerank",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).top_n).toBe(1);
  });

  it("reports authentication errors without a direct-provider fallback", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { message: "Invalid key" } }, 401),
    );
    await expect(
      new VercelAIGatewayApi(config).chatCompletionNonStream(
        { model, messages: [] },
        signal(),
      ),
    ).rejects.toThrow("Invalid key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("honors an aborted generation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new VercelAIGatewayApi(config).chatCompletionNonStream(
        { model, messages: [] },
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects other endpoints and missing credentials", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    expect(() => new VercelAIGatewayApi({ ...config, apiKey: "" })).toThrow(
      "API key",
    );
    expect(
      () =>
        new VercelAIGatewayApi({
          ...config,
          apiBase: "https://example.com/v1/",
        }),
    ).toThrow("exclusively");
  });
});
