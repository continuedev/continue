import { afterEach, expect, test, vi } from "vitest";

import { createAceDataCloudApi } from "./AceDataCloud.js";

vi.mock("../util.js", () => ({ customFetch: () => globalThis.fetch }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const endpoint = (protocol = "messages") => ({
  protocol,
  path: protocol === "messages" ? "/v1/messages" : "/v1/responses",
  base_url:
    protocol === "messages"
      ? "https://api.acedata.cloud"
      : "https://api.acedata.cloud/v1",
  auth: "bearer",
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const publicCatalog = (endpoints = [endpoint()]) =>
  json({ data: [{ id: "arbitrary-model", type: "chat", endpoints }] });
const reply = {
  id: "message_test",
  type: "message",
  role: "assistant",
  model: "arbitrary-model",
  stop_reason: "tool_use",
  stop_sequence: null,
  content: [
    { type: "text", text: "Checking " },
    { type: "text", text: "files." },
    {
      type: "tool_use",
      id: "call_read",
      name: "Read",
      input: { file: "fixture.txt" },
    },
    { type: "tool_use", id: "call_list", name: "List", input: {} },
  ],
  usage: { input_tokens: 7, output_tokens: 3 },
};
const config = { provider: "acedatacloud" as const, apiKey: "test-key" };
const request = {
  model: "arbitrary-model",
  messages: [{ role: "user" as const, content: "Hello" }],
};

test("createAceDataCloudApi routes by published Messages metadata and preserves tools, images, usage and token budget", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(publicCatalog())
    .mockResolvedValueOnce(json(reply));
  vi.stubGlobal("fetch", fetch);
  const result = await createAceDataCloudApi(config).chatCompletionNonStream(
    {
      ...request,
      max_tokens: 64,
      messages: [
        { role: "system", content: "Use the selected model" },
        {
          role: "user",
          content: [
            { type: "text", text: "Read this" },
            {
              type: "image_url",
              image_url: { url: "https://example.test/image.png" },
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "Read",
            parameters: {
              type: "object",
              properties: { file: { type: "string" } },
            },
          },
        },
      ],
    },
    new AbortController().signal,
  );
  const [url, init] = fetch.mock.calls[1];
  expect(String(url)).toBe("https://api.acedata.cloud/v1/messages");
  expect(new Headers(init.headers).get("authorization")).toBe(
    "Bearer test-key",
  );
  expect(new Headers(init.headers).has("x-api-key")).toBe(false);
  const body = JSON.parse(init.body);
  expect(body.model).toBe("arbitrary-model");
  expect(body.max_tokens).toBe(64);
  expect(body.system).toEqual([
    { type: "text", text: "Use the selected model" },
  ]);
  expect(body.messages[0].content[1]).toEqual({
    type: "image",
    source: { type: "url", url: "https://example.test/image.png" },
  });
  expect(body.tools[0].name).toBe("Read");
  expect(JSON.stringify(body)).not.toContain("cache_control");
  expect(result.choices[0].message.content).toBe("Checking files.");
  expect(result.choices[0].message.tool_calls).toHaveLength(2);
  expect(result.choices[0].finish_reason).toBe("tool_calls");
  expect(result.usage).toEqual({
    prompt_tokens: 7,
    completion_tokens: 3,
    total_tokens: 10,
  });
  expect(new Headers(fetch.mock.calls[0][1].headers).has("authorization")).toBe(
    false,
  );
});

test("createAceDataCloudApi preserves distinct tool indices and stop reason through a Messages stream", async () => {
  const events = [
    {
      type: "message_start",
      message: { id: "message_stream", usage: { input_tokens: 7 } },
    },
    {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Checking files." },
    },
    {
      type: "content_block_start",
      index: 1,
      content_block: { type: "tool_use", id: "tool1", name: "Read", input: {} },
    },
    {
      type: "content_block_delta",
      index: 1,
      delta: {
        type: "input_json_delta",
        partial_json: '{"file":"fixture.txt"}',
      },
    },
    { type: "content_block_stop", index: 1 },
    {
      type: "content_block_start",
      index: 2,
      content_block: { type: "tool_use", id: "tool2", name: "List", input: {} },
    },
    {
      type: "content_block_delta",
      index: 2,
      delta: { type: "input_json_delta", partial_json: "{}" },
    },
    {
      type: "message_delta",
      delta: { stop_reason: "tool_use" },
      usage: { output_tokens: 3 },
    },
    { type: "message_stop" },
  ];
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(publicCatalog())
    .mockResolvedValueOnce(
      new Response(
        events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  const chunks = [];
  for await (const chunk of createAceDataCloudApi(config).chatCompletionStream(
    { ...request, stream: true },
    signal,
  )) {
    chunks.push(chunk);
  }
  const tools = chunks.flatMap((c) => c.choices[0]?.delta.tool_calls ?? []);
  expect(tools.map((tool) => tool.index)).toEqual([0, 0, 1, 1]);
  expect(tools.filter((tool) => tool.id).map((tool) => tool.id)).toEqual([
    "tool1",
    "tool2",
  ]);
  expect(chunks[0].choices[0].finish_reason).toBeNull();
  expect(chunks.at(-2)?.choices[0].finish_reason).toBe("tool_calls");
  expect(chunks.at(-1)?.usage?.total_tokens).toBe(10);
  expect(fetch.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
});

test.each([401, 403, 429, 500])(
  "createAceDataCloudApi preserves Messages HTTP %i and does not retry or select a substitute",
  async (status) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(publicCatalog())
      .mockResolvedValueOnce(
        json({ error: { message: "fixture failure" } }, status),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      createAceDataCloudApi(config).chatCompletionNonStream(
        request,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status });
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);

test("createAceDataCloudApi does not transfer keys to endpoint URLs from catalog data", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      publicCatalog([{ ...endpoint(), base_url: "https://example.test" }]),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    createAceDataCloudApi(config).chatCompletionNonStream(
      request,
      new AbortController().signal,
    ),
  ).rejects.toThrow("no published chat protocol");
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("createAceDataCloudApi honours custom endpoint configuration without applying official metadata", async () => {
  const fetch = vi.fn().mockResolvedValue(
    json({
      id: "custom",
      choices: [{ message: { content: "custom response" } }],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  await createAceDataCloudApi({
    ...config,
    apiBase: "https://custom.example/v1/",
  }).chatCompletionNonStream(request, new AbortController().signal);
  expect(String(fetch.mock.calls[0][0])).toBe(
    "https://custom.example/v1/chat/completions",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("createAceDataCloudApi cancels before metadata or inference when already aborted", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  controller.abort();
  await expect(
    createAceDataCloudApi(config).chatCompletionNonStream(
      request,
      controller.signal,
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).not.toHaveBeenCalled();
});

test("createAceDataCloudApi uses only the declared Responses route when Chat Completions is absent", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(publicCatalog([endpoint("responses")]))
    .mockResolvedValueOnce(
      json({
        id: "resp_fixture",
        object: "response",
        model: "arbitrary-model",
        created_at: 1,
        status: "completed",
        output: [
          {
            type: "message",
            id: "msg_fixture",
            role: "assistant",
            status: "completed",
            content: [
              { type: "output_text", text: "Response route", annotations: [] },
            ],
          },
        ],
        usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const result = await createAceDataCloudApi(config).chatCompletionNonStream(
    request,
    new AbortController().signal,
  );
  expect(String(fetch.mock.calls[1][0])).toBe(
    "https://api.acedata.cloud/v1/responses",
  );
  expect(result.choices[0].message.content).toBe("Response route");
});

test("createAceDataCloudApi aborts its HTTP request when a stream consumer closes early", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          [
            { type: "message_start", message: { id: "cancelled", usage: {} } },
            {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text: "First" },
            },
            {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text: "Second" },
            },
          ]
            .map((event) => `data: ${JSON.stringify(event)}\n\n`)
            .join(""),
        ),
      );
    },
  });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(publicCatalog())
    .mockResolvedValueOnce(new Response(stream));
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  const iterator = createAceDataCloudApi(config).chatCompletionStream(
    { ...request, stream: true },
    controller.signal,
  );
  expect((await iterator.next()).value?.choices[0].delta.content).toBe("First");
  await iterator.return(undefined);
  expect(fetch.mock.calls[1][1].signal.aborted).toBe(true);
  expect(controller.signal.aborted).toBe(false);
});

test("createAceDataCloudApi retains known protocol metadata during a temporary catalog outage", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(0);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(publicCatalog())
    .mockResolvedValueOnce(json(reply))
    .mockResolvedValueOnce(json({}, 503))
    .mockResolvedValueOnce(json(reply));
  vi.stubGlobal("fetch", fetch);
  const api = createAceDataCloudApi(config);
  await api.chatCompletionNonStream(request, new AbortController().signal);
  now.mockReturnValue(400_000);
  const result = await api.chatCompletionNonStream(
    request,
    new AbortController().signal,
  );
  expect(result.model).toBe("arbitrary-model");
  expect(String(fetch.mock.calls[3][0])).toBe(
    "https://api.acedata.cloud/v1/messages",
  );
  expect(fetch).toHaveBeenCalledTimes(4);
});
