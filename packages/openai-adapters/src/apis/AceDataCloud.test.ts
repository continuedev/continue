import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAceDataCloudApi,
  fetchAceDataCloudCatalog,
} from "./AceDataCloud.js";

vi.mock("../util.js", () => ({ customFetch: () => globalThis.fetch }));

describe("Ace Data Cloud adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps an exact gpt-5 model on Chat Completions with bearer auth", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "test",
          object: "chat.completion",
          created: 1,
          model: "gpt-5.5",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "OK" },
              finish_reason: "stop",
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "gpt-5.5",
              type: "chat",
              endpoints: [
                {
                  protocol: "chat_completions",
                  path: "/v1/chat/completions",
                  base_url: "https://api.acedata.cloud/v1",
                  auth: "bearer",
                },
              ],
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createAceDataCloudApi({
      provider: "acedatacloud",
      apiKey: "test-key",
    });
    expect(api.responsesStream).toBeUndefined();
    expect(api.responsesNonStream).toBeUndefined();
    const result = await api.chatCompletionNonStream(
      {
        model: "gpt-5.5",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 16,
      },
      new AbortController().signal,
    );
    expect(result.choices[0].message.content).toBe("OK");
    const [url, init] = fetch.mock.calls[1];
    expect(String(url)).toBe("https://api.acedata.cloud/v1/chat/completions");
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer test-key",
    );
    expect(JSON.parse(init.body).model).toBe("gpt-5.5");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("streams exact-model tool calls on Chat Completions", async () => {
    const data = [
      {
        id: "test",
        object: "chat.completion.chunk",
        created: 1,
        model: "gpt-5.5",
        choices: [
          {
            index: 0,
            delta: {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: "call_read",
                  type: "function",
                  function: {
                    name: "Read",
                    arguments: '{"filepath":"fixture.txt"}',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        id: "test",
        object: "chat.completion.chunk",
        created: 1,
        model: "gpt-5.5",
        choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
      },
    ];
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          data.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
            "data: [DONE]\n\n",
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      );
    fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "gpt-5.5",
              type: "chat",
              endpoints: [
                {
                  protocol: "chat_completions",
                  path: "/v1/chat/completions",
                  base_url: "https://api.acedata.cloud/v1",
                  auth: "bearer",
                },
              ],
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createAceDataCloudApi({
      provider: "acedatacloud",
      apiKey: "test-key",
      useResponsesApi: true,
    });
    const chunks = [];
    for await (const chunk of api.chatCompletionStream(
      {
        model: "gpt-5.5",
        stream: true,
        messages: [{ role: "user", content: "Read fixture.txt" }],
      },
      new AbortController().signal,
    )) {
      chunks.push(chunk);
    }
    expect(chunks[0].choices[0].delta.tool_calls?.[0].function?.name).toBe(
      "Read",
    );
    expect(chunks[1].choices[0].finish_reason).toBe("tool_calls");
    expect(String(fetch.mock.calls[1][0])).toBe(
      "https://api.acedata.cloud/v1/chat/completions",
    );
    expect(api.responsesStream).toBeUndefined();
  });

  it("honors a test endpoint and surfaces authentication errors without fallback", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Invalid key", type: "authentication_error" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createAceDataCloudApi({
      provider: "acedatacloud",
      apiBase: "http://127.0.0.1:12345/v1/",
      apiKey: "invalid",
    });
    await expect(
      api.chatCompletionNonStream(
        {
          model: "exact-model",
          messages: [{ role: "user", content: "Hi" }],
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(String(fetch.mock.calls[0][0])).toBe(
      "http://127.0.0.1:12345/v1/chat/completions",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses typed protocols rather than names for account model discovery", async () => {
    const fetch = vi.fn().mockImplementation(async (url) => {
      const data = String(url).startsWith("https://platform.acedata.cloud")
        ? [
            { id: "gpt-4o-image", type: "chat" },
            {
              id: "future-chat-id",
              type: "chat",
              recommended: false,
              visible: false,
            },
            { id: "not-authorized", type: "chat" },
            { id: "nano-banana", type: "image" },
            { id: "future-vector", type: "embedding" },
          ]
        : [
            "gpt-4o-image",
            "future-chat-id",
            "nano-banana",
            "future-vector",
          ].map((id) => ({
            id,
            object: "model",
            created: 1,
            owned_by: "acedatacloud",
          }));
      return new Response(JSON.stringify({ object: "list", data }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetch);
    const api = createAceDataCloudApi({
      provider: "acedatacloud",
      apiKey: "test-key",
    });
    expect((await api.list()).map((model) => model.id)).toEqual([
      "gpt-4o-image",
      "future-chat-id",
    ]);
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://api.acedata.cloud/v1/models",
    );
    const publicRequest = fetch.mock.calls.find(([url]) =>
      String(url).startsWith("https://platform.acedata.cloud"),
    );
    expect(new Headers(publicRequest?.[1]?.headers).has("authorization")).toBe(
      false,
    );
  });

  it("fetches all public chat models without a key or inferred limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "new-chat",
                label: "New Chat",
                type: "chat",
                capabilities: ["vision"],
                recommended: false,
                visible: false,
              },
              { id: "new-video", type: "video" },
              { id: "new-audio", type: "audio" },
              { id: "new-embedding", type: "embedding" },
            ],
          }),
        ),
      ),
    );
    expect(await fetchAceDataCloudCatalog()).toEqual([
      {
        id: "new-chat",
        label: "New Chat",
        type: "chat",
        capabilities: ["vision"],
      },
    ]);
  });

  it("reports a failed or malformed public catalog instead of falling back to a preset", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "untyped-model" }] })),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(fetchAceDataCloudCatalog()).rejects.toThrow("503");
    await expect(fetchAceDataCloudCatalog()).rejects.toThrow();
  });
});
