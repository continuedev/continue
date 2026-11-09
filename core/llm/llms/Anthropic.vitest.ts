import { afterEach, describe, expect, test, vi } from "vitest";
import { ILLM } from "../../index.js";
import Anthropic, { anthropicSamplingParams } from "./Anthropic.js";

interface LlmTestCase {
  llm: ILLM;
  methodToTest: keyof ILLM;
  params: any[];
  expectedRequest: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: Record<string, any>;
  };
  mockResponse?: any;
  mockStream?: any[];
}

function createMockStream(mockStream: any[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of mockStream) {
        controller.enqueue(
          encoder.encode(
            `data: ${
              typeof chunk === "string" ? chunk : JSON.stringify(chunk)
            }\n\n`,
          ),
        );
      }
      controller.close();
    },
  });
}

function setupMockFetch(mockResponse?: any, mockStream?: any[]) {
  const mockFetch = vi.fn();

  if (mockStream) {
    const stream = createMockStream(mockStream);
    mockFetch.mockResolvedValue(
      new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
        },
      }),
    );
  } else {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  return mockFetch;
}

function setupReadableStreamPolyfill() {
  // This can be removed if https://github.com/nodejs/undici/issues/2888 is resolved
  // @ts-ignore
  const originalFrom = ReadableStream.from;
  // @ts-ignore
  ReadableStream.from = (body) => {
    if (body?.source) {
      return body;
    }
    return originalFrom(body);
  };
}

async function executeLlmMethod(
  llm: ILLM,
  methodToTest: keyof ILLM,
  params: any[],
) {
  if (typeof (llm as any)[methodToTest] !== "function") {
    throw new Error(
      `Method ${String(methodToTest)} does not exist on the LLM instance.`,
    );
  }

  const result = await (llm as any)[methodToTest](...params);
  if (result?.next) {
    for await (const _ of result) {
    }
  }
}

function assertFetchCall(mockFetch: any, expectedRequest: any) {
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, options] = mockFetch.mock.calls[0];

  expect(url.toString()).toBe(expectedRequest.url);
  expect(options.method).toBe(expectedRequest.method);

  if (expectedRequest.headers) {
    expect(options.headers).toEqual(
      expect.objectContaining(expectedRequest.headers),
    );
  }

  if (expectedRequest.body) {
    const actualBody = JSON.parse(options.body as string);
    expect(actualBody).toEqual(expectedRequest.body);
  }
}

async function runLlmTest(testCase: LlmTestCase) {
  const {
    llm,
    methodToTest,
    params,
    expectedRequest,
    mockResponse,
    mockStream,
  } = testCase;

  const mockFetch = setupMockFetch(mockResponse, mockStream);
  setupReadableStreamPolyfill();

  (llm as any).fetch = mockFetch;

  await executeLlmMethod(llm, methodToTest, params);
  assertFetchCall(mockFetch, expectedRequest);
}

describe("Anthropic", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("streamChat should send a valid request", async () => {
    const anthropic = new Anthropic({
      apiKey: "test-api-key",
      model: "claude-sonnet-4-5",
      apiBase: "https://api.anthropic.com/v1/",
    });

    await runLlmTest({
      llm: anthropic,
      methodToTest: "streamChat",
      params: [
        [{ role: "user", content: "hello" }],
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": "test-api-key",
        },
        body: {
          model: "claude-sonnet-4-5",
          max_tokens: 8192,
          stream: true,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: "hello" }],
            },
          ],
          system: "",
        },
      },
      mockStream: [
        '{"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello! How can I help you today?"}}',
        '{"type": "content_block_stop"}',
      ],
    });
  });

  test("chat should send a valid request", async () => {
    const anthropic = new Anthropic({
      apiKey: "test-api-key",
      model: "claude-sonnet-4-5",
      apiBase: "https://api.anthropic.com/v1/",
    });

    await runLlmTest({
      llm: anthropic,
      methodToTest: "chat",
      params: [
        [{ role: "user", content: "hello" }],
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": "test-api-key",
        },
        body: {
          model: "claude-sonnet-4-5",
          max_tokens: 8192,
          stream: true,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: "hello" }],
            },
          ],
          system: "",
        },
      },
      mockStream: [
        '{"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello! How can I help you today?"}}',
        '{"type": "content_block_stop"}',
      ],
    });
  });

  test("streamComplete should send a valid request", async () => {
    const anthropic = new Anthropic({
      apiKey: "test-api-key",
      model: "claude-sonnet-4-5",
      apiBase: "https://api.anthropic.com/v1/",
    });

    await runLlmTest({
      llm: anthropic,
      methodToTest: "streamComplete",
      params: ["Complete this: Hello", new AbortController().signal],
      expectedRequest: {
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": "test-api-key",
        },
        body: {
          model: "claude-sonnet-4-5",
          max_tokens: 8192,
          stream: true,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: "Complete this: Hello" }],
            },
          ],
          system: "",
        },
      },
      mockStream: [
        '{"type": "content_block_delta", "delta": {"type": "text_delta", "text": " world!"}}',
        '{"type": "content_block_stop"}',
      ],
    });
  });

  test("complete should send a valid request", async () => {
    const anthropic = new Anthropic({
      apiKey: "test-api-key",
      model: "claude-sonnet-4-5",
      apiBase: "https://api.anthropic.com/v1/",
    });

    await runLlmTest({
      llm: anthropic,
      methodToTest: "complete",
      params: ["Complete this: Hello", new AbortController().signal],
      expectedRequest: {
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": "test-api-key",
        },
        body: {
          model: "claude-sonnet-4-5",
          max_tokens: 8192,
          stream: true,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: "Complete this: Hello" }],
            },
          ],
          system: "",
        },
      },
      mockStream: [
        '{"type": "content_block_delta", "delta": {"type": "text_delta", "text": " world!"}}',
        '{"type": "content_block_stop"}',
      ],
    });
  });

  describe("Different configurations", () => {
    test("should handle system message", async () => {
      const anthropic = new Anthropic({
        apiKey: "test-api-key",
        model: "claude-sonnet-4-5",
        apiBase: "https://api.anthropic.com/v1/",
      });

      await runLlmTest({
        llm: anthropic,
        methodToTest: "streamChat",
        params: [
          [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello!" },
          ],
          new AbortController().signal,
        ],
        expectedRequest: {
          url: "https://api.anthropic.com/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": "test-api-key",
          },
          body: {
            model: "claude-sonnet-4-5",
            max_tokens: 8192,
            stream: true,
            messages: [
              {
                role: "user",
                content: [{ type: "text", text: "Hello!" }],
              },
            ],
            system: "You are a helpful assistant.",
          },
        },
        mockStream: [
          '{"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello! How can I help you today?"}}',
          '{"type": "content_block_stop"}',
        ],
      });
    });

    test("should handle tool calls", async () => {
      const anthropic = new Anthropic({
        apiKey: "test-api-key",
        model: "claude-sonnet-4-5",
        apiBase: "https://api.anthropic.com/v1/",
      });

      const tools = [
        {
          type: "function" as const,
          function: {
            name: "get_weather",
            description: "Get the current weather",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string" },
              },
              required: ["location"],
            },
          },
        },
      ];

      await runLlmTest({
        llm: anthropic,
        methodToTest: "streamChat",
        params: [
          [{ role: "user", content: "What's the weather in New York?" }],
          new AbortController().signal,
          { tools },
        ],
        expectedRequest: {
          url: "https://api.anthropic.com/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": "test-api-key",
          },
          body: {
            model: "claude-sonnet-4-5",
            max_tokens: 8192,
            stream: true,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "What's the weather in New York?" },
                ],
              },
            ],
            tools: [
              {
                name: "get_weather",
                description: "Get the current weather",
                input_schema: {
                  type: "object",
                  properties: {
                    location: { type: "string" },
                  },
                  required: ["location"],
                },
              },
            ],
            system: "",
          },
        },
        mockStream: [
          '{"type": "content_block_start", "content_block": {"type": "tool_use", "id": "toolu_123", "name": "get_weather"}}',
          '{"type": "content_block_delta", "delta": {"type": "input_json_delta", "partial_json": "{\\"location\\": \\"New York\\""}}',
          '{"type": "content_block_stop"}',
        ],
      });
    });

    test("should handle custom max tokens", async () => {
      const anthropic = new Anthropic({
        apiKey: "test-api-key",
        model: "claude-sonnet-4-5",
        apiBase: "https://api.anthropic.com/v1/",
      });

      await runLlmTest({
        llm: anthropic,
        methodToTest: "streamChat",
        params: [
          [{ role: "user", content: "hello" }],
          new AbortController().signal,
          { maxTokens: 1000 },
        ],
        expectedRequest: {
          url: "https://api.anthropic.com/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": "test-api-key",
          },
          body: {
            model: "claude-sonnet-4-5",
            max_tokens: 1000,
            stream: true,
            messages: [
              {
                role: "user",
                content: [{ type: "text", text: "hello" }],
              },
            ],
            system: "",
          },
        },
        mockStream: [
          '{"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello!"}}',
          '{"type": "content_block_stop"}',
        ],
      });
    });
  });

  describe("Usage", () => {
    // The suite's Response is node-fetch's, which cannot wrap a web
    // ReadableStream (it would send "[object ReadableStream]"), so the SSE
    // body is passed as a string.
    async function collectUsage(events: any[]) {
      const anthropic = new Anthropic({
        apiKey: "test-api-key",
        model: "claude-sonnet-4-5",
        apiBase: "https://api.anthropic.com/v1/",
      });
      const sse = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
      (anthropic as any).fetch = vi.fn().mockResolvedValue(
        new Response(sse, {
          headers: { "Content-Type": "text/event-stream" },
        }),
      );

      let usage: any;
      for await (const chunk of anthropic.streamChat(
        [{ role: "user", content: "hello" }],
        new AbortController().signal,
      )) {
        if (chunk.role === "assistant" && chunk.usage) {
          usage = chunk.usage;
        }
      }
      return usage;
    }

    test("keeps the 5-minute and 1-hour cache write split", async () => {
      const usage = await collectUsage([
        {
          type: "message_start",
          message: {
            usage: {
              input_tokens: 12,
              cache_read_input_tokens: 9000,
              cache_creation_input_tokens: 700,
              cache_creation: {
                ephemeral_5m_input_tokens: 200,
                ephemeral_1h_input_tokens: 500,
              },
            },
          },
        },
        { type: "message_delta", usage: { output_tokens: 33 } },
        { type: "content_block_stop" },
      ]);

      expect(usage.promptTokens).toBe(12);
      expect(usage.completionTokens).toBe(33);
      expect(usage.promptTokensDetails).toEqual({
        cachedTokens: 9000,
        cacheWriteTokens: 700,
        cacheWriteTokens5m: 200,
        cacheWriteTokens1h: 500,
      });
    });

    test("leaves the split unset when the API does not report it", async () => {
      const usage = await collectUsage([
        {
          type: "message_start",
          message: {
            usage: {
              input_tokens: 12,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 700,
            },
          },
        },
        { type: "content_block_stop" },
      ]);

      expect(usage.promptTokensDetails.cacheWriteTokens).toBe(700);
      expect(usage.promptTokensDetails.cacheWriteTokens5m).toBeUndefined();
      expect(usage.promptTokensDetails.cacheWriteTokens1h).toBeUndefined();
    });
  });

  describe("Prompt caching request body", () => {
    const tools = [
      {
        type: "function" as const,
        function: { name: "read_file", description: "Read", parameters: {} },
      },
      {
        type: "function" as const,
        function: { name: "ls", description: "List", parameters: {} },
      },
    ];
    const agentLoop: any[] = [
      { role: "system", content: "You are an agent." },
      { role: "user", content: "fix the bug" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "t1",
            type: "function",
            function: { name: "ls", arguments: "{}" },
          },
        ],
      },
      { role: "tool", content: "a.ts b.ts", toolCallId: "t1" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "t2",
            type: "function",
            function: { name: "read_file", arguments: "{}" },
          },
        ],
      },
      { role: "tool", content: "export const x = 1;", toolCallId: "t2" },
    ];

    async function sentBody(completionOptions: any, model: any = {}) {
      const anthropic = new Anthropic({
        apiKey: "test-api-key",
        model: "claude-sonnet-4-5",
        apiBase: "https://api.anthropic.com/v1/",
        ...model,
      });
      const fetchMock = vi.fn().mockResolvedValue(
        new Response('data: {"type":"content_block_stop"}\n\n', {
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
      (anthropic as any).fetch = fetchMock;
      for await (const _ of anthropic.streamChat(
        agentLoop,
        new AbortController().signal,
        { tools, ...completionOptions },
      )) {
      }
      const [, init] = fetchMock.mock.calls[0];
      return { body: JSON.parse(init.body), headers: init.headers };
    }

    const marked = (body: any) => ({
      tools: body.tools.map((t: any) => !!t.cache_control),
      system: Array.isArray(body.system) && !!body.system[0].cache_control,
      messages: body.messages.map((m: any) =>
        m.content.map((b: any) => !!b.cache_control),
      ),
    });

    test("sends no breakpoints unless caching is asked for", async () => {
      const { body, headers } = await sentBody({});
      expect(marked(body).tools).toEqual([false, false]);
      expect(marked(body).system).toBe(false);
      expect(marked(body).messages.flat()).not.toContain(true);
      expect(headers["anthropic-beta"]).toBeUndefined();
    });

    test("marks tools, system and the last two tool results in an Agent loop", async () => {
      const { body, headers } = await sentBody({ promptCaching: true });
      const m = marked(body);
      expect(m.tools).toEqual([false, true]);
      expect(m.system).toBe(true);
      // Assistant turns carry a placeholder text block before the tool_use, so
      // find the marked blocks by type rather than by position.
      const markedBlocks = body.messages.flatMap((msg: any, i: number) =>
        msg.content
          .filter((b: any) => b.cache_control)
          .map((b: any) => `${i}:${b.type}`),
      );
      // messages: 0 user text, 1 assistant, 2 tool_result, 3 assistant, 4 tool_result
      expect(markedBlocks).toEqual(["2:tool_result", "4:tool_result"]);
      expect(headers["anthropic-beta"]).toBeDefined();
    });

    test("sends the 1-hour lifetime on every breakpoint", async () => {
      const { body } = await sentBody({
        promptCaching: true,
        promptCacheTtl: "1h",
      });
      const controls = [
        body.tools[1].cache_control,
        body.system[0].cache_control,
        body.messages[2].content[0].cache_control,
        body.messages[4].content[0].cache_control,
      ];
      for (const c of controls) {
        expect(c).toEqual({ type: "ephemeral", ttl: "1h" });
      }
    });

    test("uses cacheBehavior.ttl when the request does not choose", async () => {
      const { body } = await sentBody(
        { promptCaching: true },
        { cacheBehavior: { ttl: "1h" } },
      );
      expect(body.system[0].cache_control).toEqual({
        type: "ephemeral",
        ttl: "1h",
      });
    });

    test("the request's lifetime wins over cacheBehavior.ttl", async () => {
      const { body } = await sentBody(
        { promptCaching: true, promptCacheTtl: "5m" },
        { cacheBehavior: { ttl: "1h" } },
      );
      expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    });

    test('cacheBehavior.ttl "auto" sends no lifetime on its own', async () => {
      const { body } = await sentBody(
        { promptCaching: true },
        { cacheBehavior: { ttl: "auto" } },
      );
      expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    });

    test("cacheBehavior.ttl does not turn caching on", async () => {
      const { body } = await sentBody({}, { cacheBehavior: { ttl: "1h" } });
      expect(marked(body).system).toBe(false);
    });

    test("keeps the default lifetime implicit for 5 minutes", async () => {
      const { body } = await sentBody({
        promptCaching: true,
        promptCacheTtl: "5m",
      });
      expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    });

    test("an explicit false overrides cacheBehavior", async () => {
      const { body } = await sentBody(
        { promptCaching: false },
        {
          cacheBehavior: { cacheConversation: true, cacheSystemMessage: true },
        },
      );
      expect(marked(body).system).toBe(false);
      expect(marked(body).messages.flat()).not.toContain(true);
    });

    test("cacheBehavior alone still works as before", async () => {
      const { body } = await sentBody(
        {},
        { cacheBehavior: { cacheConversation: true } },
      );
      expect(marked(body).messages.flat().filter(Boolean)).toHaveLength(2);
      expect(marked(body).tools).toEqual([false, false]);
    });
  });

  describe("Sampling fields", () => {
    // The API refuses temperature and top_p together, and with thinking on
    // any temperature other than 1 or top_p below 0.95.
    const anthropic = new Anthropic({
      apiKey: "test-api-key",
      model: "claude-sonnet-4-5",
      apiBase: "https://api.anthropic.com/v1/",
    });

    test("sends temperature or top_p, never both", () => {
      const both = anthropic.convertArgs({
        model: "claude-sonnet-4-5",
        temperature: 0.5,
        topP: 0.9,
      });
      expect(both.temperature).toBe(0.5);
      expect(both.top_p).toBeUndefined();

      const topOnly = anthropic.convertArgs({
        model: "claude-sonnet-4-5",
        topP: 0.9,
      });
      expect(topOnly.temperature).toBeUndefined();
      expect(topOnly.top_p).toBe(0.9);
    });

    test("sends neither while thinking is on", () => {
      const args = anthropic.convertArgs({
        model: "claude-sonnet-4-5",
        temperature: 0.5,
        topP: 0.9,
        reasoning: true,
        reasoningBudgetTokens: 2048,
      });
      expect(args.thinking).toBeDefined();
      expect(args.temperature).toBeUndefined();
      expect(args.top_p).toBeUndefined();
    });

    test("anthropicSamplingParams matches the Bedrock rule for Claude", () => {
      expect(anthropicSamplingParams(0.5, 0.9, false)).toEqual({
        temperature: 0.5,
      });
      expect(anthropicSamplingParams(undefined, 0.9, false)).toEqual({
        temperature: undefined,
        top_p: 0.9,
      });
      expect(anthropicSamplingParams(0.5, 0.9, true)).toEqual({});
    });
  });

  describe("Error handling", () => {
    test("should throw error when API key is missing", async () => {
      const anthropic = new Anthropic({
        apiKey: "",
        model: "claude-sonnet-4-5",
        apiBase: "https://api.anthropic.com/v1/",
      });

      await expect(
        runLlmTest({
          llm: anthropic,
          methodToTest: "streamChat",
          params: [
            [{ role: "user", content: "hello" }],
            new AbortController().signal,
          ],
          expectedRequest: {
            url: "https://api.anthropic.com/v1/messages",
            method: "POST",
          },
        }),
      ).rejects.toThrow(
        "Request not sent. You have an Anthropic model configured in your config.yaml, but the API key is not set.",
      );
    });
  });
});
