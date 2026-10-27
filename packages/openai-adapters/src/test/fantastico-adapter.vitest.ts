import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@continuedev/fetch", async () => {
  const actual = await vi.importActual("@continuedev/fetch");
  return {
    ...actual,
    fetchwithRequestOptions: vi.fn(),
  };
});

const CONTROL_PLANE = "https://fantastico.cc/api";
const PROVIDER_BASE = "https://provider.example/api/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mintResponse(runtimeKey = "rk-1") {
  return json({
    runtimeKey,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    recordId: "rec-1",
    baseUrl: PROVIDER_BASE,
    defaultModel: "anthropic/claude-sonnet-4.5",
    chatDefaults: { usage: { include: true } },
  });
}

const completion = {
  id: "test-id",
  object: "chat.completion",
  created: 1234567890,
  model: "anthropic/claude-sonnet-4.5",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hello!" },
      finish_reason: "stop",
    },
  ],
};

function chatBody() {
  return {
    model: "anthropic/claude-sonnet-4.5",
    messages: [{ role: "user" as const, content: "hello" }],
  };
}

function header(init: any, name: string): string | null {
  const headers = init?.headers;
  if (!headers) {
    return null;
  }
  if (typeof headers.get === "function") {
    return headers.get(name);
  }
  return headers[name] ?? null;
}

describe("Fantastico Adapter Tests", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockFetch = vi.fn();
    const fetchPackage = await import("@continuedev/fetch");
    vi.mocked(fetchPackage.fetchwithRequestOptions).mockImplementation(((
      url: any,
      init: any,
    ) => mockFetch(url.toString(), init)) as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function construct(apiKey: string) {
    const { constructLlmApi } = await import("../index.js");
    const api = constructLlmApi({ provider: "fantastico", apiKey });
    if (!api) {
      throw new Error("Failed to construct Fantastico adapter");
    }
    return api;
  }

  test("account key mints on /edge/key and calls the provider directly", async () => {
    mockFetch
      .mockResolvedValueOnce(mintResponse())
      .mockResolvedValueOnce(json(completion));

    const api = await construct("ck-fant-test");
    await api.chatCompletionNonStream(chatBody(), new AbortController().signal);

    const [mintUrl, mintInit] = mockFetch.mock.calls[0];
    expect(mintUrl).toBe(`${CONTROL_PLANE}/edge/key`);
    expect(mintInit.method).toBe("POST");
    expect(header(mintInit, "Authorization")).toBe("Bearer ck-fant-test");

    const [chatUrl, chatInit] = mockFetch.mock.calls[1];
    expect(chatUrl).toBe(`${PROVIDER_BASE}/chat/completions`);
    expect(header(chatInit, "Authorization")).toBe("Bearer rk-1");
    expect(JSON.parse(chatInit.body)).toEqual({
      ...chatBody(),
      usage: { include: true },
    });
  });

  test("project key mints on /runtime/key", async () => {
    mockFetch
      .mockResolvedValueOnce(mintResponse())
      .mockResolvedValueOnce(json(completion));

    const api = await construct("sk-fant-prod-test");
    await api.chatCompletionNonStream(chatBody(), new AbortController().signal);

    expect(mockFetch.mock.calls[0][0]).toBe(`${CONTROL_PLANE}/runtime/key`);
  });

  test("rejects a key that is not a Fantastico key", async () => {
    const api = await construct("sk-or-something-else");
    await expect(
      api.chatCompletionNonStream(chatBody(), new AbortController().signal),
    ).rejects.toThrow(/ck-fant-/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("reuses the runtime key until it expires", async () => {
    mockFetch
      .mockResolvedValueOnce(mintResponse())
      .mockResolvedValueOnce(json(completion))
      .mockResolvedValueOnce(json(completion));

    const api = await construct("ck-fant-test");
    await api.chatCompletionNonStream(chatBody(), new AbortController().signal);
    await api.chatCompletionNonStream(chatBody(), new AbortController().signal);

    const mintCalls = mockFetch.mock.calls.filter(([url]) =>
      url.startsWith(CONTROL_PLANE),
    );
    expect(mintCalls).toHaveLength(1);
  });

  test("mints a new key and retries once when the provider answers 402", async () => {
    mockFetch
      .mockResolvedValueOnce(mintResponse("rk-1"))
      .mockResolvedValueOnce(
        json({ error: { code: 402, message: "Insufficient credits" } }, 402),
      )
      .mockResolvedValueOnce(mintResponse("rk-2"))
      .mockResolvedValueOnce(json(completion));

    const api = await construct("ck-fant-test");
    const result = await api.chatCompletionNonStream(
      chatBody(),
      new AbortController().signal,
    );

    expect(result.choices[0].message.content).toBe("Hello!");
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(header(mockFetch.mock.calls[3][1], "Authorization")).toBe(
      "Bearer rk-2",
    );
  });

  test("surfaces the control plane error when the account is out of credit", async () => {
    mockFetch.mockResolvedValueOnce(
      json(
        {
          type: "ALLOWANCE_EXHAUSTED",
          message: "The account is out of credit",
        },
        402,
      ),
    );

    const api = await construct("ck-fant-test");
    await expect(
      api.chatCompletionNonStream(chatBody(), new AbortController().signal),
    ).rejects.toThrow(/402 ALLOWANCE_EXHAUSTED.*out of credit/);
  });

  test("chatCompletionStream mints first and streams from the provider", async () => {
    const encoder = new TextEncoder();
    const chunk = {
      id: "test-id",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "anthropic/claude-sonnet-4.5",
      choices: [{ index: 0, delta: { content: "Hi" }, finish_reason: null }],
    };
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    mockFetch.mockResolvedValueOnce(mintResponse()).mockResolvedValueOnce(
      new Response(stream, {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const api = await construct("ck-fant-test");
    const chunks = [];
    for await (const c of api.chatCompletionStream(
      { ...chatBody(), stream: true },
      new AbortController().signal,
    )) {
      chunks.push(c);
    }

    expect(chunks).toHaveLength(1);
    const [chatUrl, chatInit] = mockFetch.mock.calls[1];
    expect(chatUrl).toBe(`${PROVIDER_BASE}/chat/completions`);
    expect(JSON.parse(chatInit.body)).toEqual({
      ...chatBody(),
      stream: true,
      stream_options: { include_usage: true },
      usage: { include: true },
    });
  });
});
