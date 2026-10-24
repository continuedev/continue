import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./llms/index.js", () => ({
  LLMClasses: [],
  llmFromProviderAndOptions: vi.fn(),
}));

import { fetchDotHooshModels, fetchModels } from "./fetchModels";

const catalog = {
  object: "list",
  data: [
    {
      id: "gpt-5",
      name: "gpt-5",
      context_length: 400000,
      max_output_tokens: 128000,
      top_provider: { context_length: 400000, max_completion_tokens: 128000 },
      supported_parameters: ["max_tokens", "tool_choice", "tools"],
    },
    {
      id: "kimi-k3",
      context_length: 262144,
      max_output_tokens: 16000,
      supported_parameters: ["max_tokens"],
    },
    { id: "bare" },
    { name: "no id" },
  ],
};

function mockFetch(response: Partial<Response> | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("fetchDotHooshModels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads the public catalog without a key", async () => {
    const fetchFn = mockFetch({ ok: true, json: async () => catalog });

    await fetchDotHooshModels();

    expect(fetchFn).toHaveBeenCalledWith(
      "https://www.dothoosh.com/gateway/v1/models",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("maps context, max output and the tools flag from the listing", async () => {
    mockFetch({ ok: true, json: async () => catalog });

    const models = await fetchDotHooshModels();

    expect(models.find((m) => m.modelId === "gpt-5")).toMatchObject({
      name: "gpt-5",
      contextLength: 400000,
      maxTokens: 128000,
      supportsTools: true,
      icon: "dothoosh.png",
    });
    expect(models.find((m) => m.modelId === "kimi-k3")).toMatchObject({
      name: "kimi-k3",
      contextLength: 262144,
      maxTokens: 16000,
      supportsTools: false,
    });
  });

  it("skips entries without an id and tolerates missing fields", async () => {
    mockFetch({ ok: true, json: async () => catalog });

    const models = await fetchDotHooshModels();

    expect(models.map((m) => m.modelId)).toEqual(["gpt-5", "kimi-k3", "bare"]);
    expect(models.find((m) => m.modelId === "bare")).toMatchObject({
      contextLength: undefined,
      supportsTools: false,
    });
  });

  it("returns an empty list on an HTTP error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch({ ok: false, status: 503 });

    expect(await fetchDotHooshModels()).toEqual([]);
  });

  it("returns an empty list on a network failure or a malformed body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(new Error("offline"));
    expect(await fetchDotHooshModels()).toEqual([]);

    mockFetch({ ok: true, json: async () => ({ nope: true }) });
    expect(await fetchDotHooshModels()).toEqual([]);
  });

  it("is used for the dothoosh provider in fetchModels", async () => {
    mockFetch({ ok: true, json: async () => catalog });

    const models = await fetchModels("dothoosh");

    expect(models).toHaveLength(3);
  });
});

describe("fetchDotHooshModels with a damaged listing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the good entries when the listing also holds null or non-object entries", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        data: [null, 42, "gpt-5", { id: "gpt-5" }, { id: "kimi-k3" }],
      }),
    });

    const models = await fetchDotHooshModels();

    expect(models.map((m) => m.modelId)).toEqual(["gpt-5", "kimi-k3"]);
  });

  it("skips entries whose id is not a non-empty string", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        data: [{ id: 7 }, { id: "  " }, { id: {} }, { id: "kimi-k3" }],
      }),
    });

    const models = await fetchDotHooshModels();

    expect(models.map((m) => m.modelId)).toEqual(["kimi-k3"]);
  });

  it("drops limits that are not positive numbers instead of passing them on", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "odd",
            context_length: "128000",
            top_provider: { context_length: null, max_completion_tokens: -1 },
            max_output_tokens: 0,
          },
        ],
      }),
    });

    const [model] = await fetchDotHooshModels();

    expect(model.contextLength).toBeUndefined();
    expect(model.maxTokens).toBeUndefined();
  });

  it("prefers the live top_provider limits over the top-level ones", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "m",
            context_length: 100,
            max_output_tokens: 10,
            top_provider: { context_length: 200, max_completion_tokens: 20 },
          },
        ],
      }),
    });

    const [model] = await fetchDotHooshModels();

    expect(model).toMatchObject({ contextLength: 200, maxTokens: 20 });
  });
});

// The real shape of the two public listings (trimmed to the fields the picker reads).
const liveOpenAI = {
  object: "list",
  data: [
    {
      id: "deepseek-flash",
      name: "deepseek-flash",
      context_length: 1048576,
      top_provider: { context_length: 1048576, max_completion_tokens: 393216 },
      supported_parameters: ["max_tokens", "reasoning", "tool_choice", "tools"],
      protocols: [
        { protocol: "anthropic-messages" },
        { protocol: "openai-chat-completions" },
      ],
    },
    {
      id: "gpt-6-luna",
      name: "gpt-6-luna",
      context_length: 1050000,
      top_provider: { context_length: 1050000, max_completion_tokens: 128000 },
      supported_parameters: ["max_tokens", "tools"],
      protocols: [
        { protocol: "openai-chat-completions" },
        { protocol: "openai-responses" },
      ],
    },
  ],
};
const liveAnthropic = {
  data: [
    {
      type: "model",
      id: "claude-haiku-5-5",
      display_name: "Claude Haiku 5.5",
      name: "claude-haiku-5-5",
      context_length: 1000000,
      top_provider: { context_length: 1000000, max_completion_tokens: 128000 },
      supported_parameters: ["max_tokens", "reasoning", "tool_choice", "tools"],
    },
    {
      type: "model",
      id: "deepseek-flash",
      name: "deepseek-flash",
      context_length: 1048576,
      top_provider: { context_length: 1048576, max_completion_tokens: 393216 },
      supported_parameters: ["max_tokens"],
    },
  ],
  has_more: false,
};

const OPENAI_URL = "https://www.dothoosh.com/gateway/v1/models";
const ANTHROPIC_URL = "https://www.dothoosh.com/gateway/anthropic/v1/models";

function mockListings(
  openai: Partial<Response> | Error,
  anthropic: Partial<Response> | Error,
) {
  const fn = vi.fn(async (url: string) => {
    const response = url === ANTHROPIC_URL ? anthropic : openai;
    if (response instanceof Error) throw response;
    return response as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
const ok = (body: unknown): Partial<Response> => ({
  ok: true,
  json: async () => body,
});

describe("fetchDotHooshModels with the Anthropic listing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads both public listings without credentials", async () => {
    const fetchFn = mockListings(ok(liveOpenAI), ok(liveAnthropic));

    await fetchDotHooshModels();

    const urls = fetchFn.mock.calls.map((call) => call[0]).sort();
    expect(urls).toEqual([ANTHROPIC_URL, OPENAI_URL].sort());
    for (const call of fetchFn.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(JSON.stringify(call[1]?.headers ?? {})).not.toMatch(
        /authorization|x-api-key/i,
      );
    }
  });

  it("offers Claude through the anthropic provider on the DotHoosh Anthropic endpoint", async () => {
    mockListings(ok(liveOpenAI), ok(liveAnthropic));

    const models = await fetchDotHooshModels();
    const claude = models.find((m) => m.modelId === "claude-haiku-5-5");

    expect(claude).toMatchObject({
      name: "Claude Haiku 5.5",
      provider: "anthropic",
      apiBase: "https://gateway.dothoosh.com/anthropic/v1/",
      contextLength: 1000000,
      maxTokens: 128000,
      supportsTools: true,
    });
  });

  it("keeps a model listed on both routes on Chat Completions, once", async () => {
    mockListings(ok(liveOpenAI), ok(liveAnthropic));

    const models = await fetchDotHooshModels();
    const flash = models.filter((m) => m.modelId === "deepseek-flash");

    expect(flash).toHaveLength(1);
    expect(flash[0].provider).toBeUndefined();
    expect(flash[0].apiBase).toBeUndefined();
    expect(flash[0].supportsTools).toBe(true);
  });

  it.each([
    ["an HTTP error", { ok: false, status: 503 } as Partial<Response>],
    ["a network failure", new Error("offline")],
    [
      "a non-JSON body",
      {
        ok: true,
        json: async () => {
          throw new Error("x");
        },
      } as Partial<Response>,
    ],
    ["an error envelope", ok({ error: { message: "down" } })],
  ])(
    "still lists the OpenAI models when the Anthropic listing has %s",
    async (_n, bad) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockListings(ok(liveOpenAI), bad);

      const models = await fetchDotHooshModels();

      expect(models.map((m) => m.modelId)).toEqual([
        "deepseek-flash",
        "gpt-6-luna",
      ]);
    },
  );

  it.each([
    ["an HTTP error", { ok: false, status: 503 } as Partial<Response>],
    ["a network failure", new Error("offline")],
    ["an error envelope", ok({ error: { message: "down" } })],
  ])(
    "still lists the Claude models when the OpenAI listing has %s",
    async (_n, bad) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockListings(bad, ok(liveAnthropic));

      const models = await fetchDotHooshModels();

      expect(models.map((m) => m.modelId)).toEqual([
        "claude-haiku-5-5",
        "deepseek-flash",
      ]);
    },
  );

  it("returns an empty list when both listings fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockListings(new Error("offline"), { ok: false, status: 503 });

    expect(await fetchDotHooshModels()).toEqual([]);
  });
});

describe("fetchDotHooshModels field validation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not read tools from a supported_parameters that is not a list", async () => {
    mockListings(
      ok({
        data: [
          { id: "a", supported_parameters: "tools" },
          { id: "b", supported_parameters: { tools: true } },
          { id: "c", supported_parameters: [null, 5, "tools"] },
        ],
      }),
      ok({ data: [] }),
    );

    const models = await fetchDotHooshModels();

    expect(models.map((m) => [m.modelId, m.supportsTools])).toEqual([
      ["a", false],
      ["b", false],
      ["c", true],
    ]);
  });

  it("falls back to the id when the name is not a non-empty string", async () => {
    mockListings(
      ok({
        data: [
          { id: "n1", name: 5 },
          { id: "n2", name: "" },
          { id: "n3", name: "  " },
          { id: "n4", name: { x: 1 } },
          { id: "n5", name: "Fine" },
        ],
      }),
      ok({ data: [] }),
    );

    const models = await fetchDotHooshModels();

    expect(models.map((m) => m.name)).toEqual(["n1", "n2", "n3", "n4", "Fine"]);
  });

  it("gives every listing request a timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    mockListings(ok(liveOpenAI), ok(liveAnthropic));

    await fetchDotHooshModels();

    expect(timeout).toHaveBeenCalledWith(10_000);
  });
});
