import { afterEach, describe, expect, test, vi } from "vitest";
import { ILLM } from "../../index.js";
import Cohere from "./Cohere.js";

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

describe("Cohere", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("streamChat should send a valid request", async () => {
    const cohere = new Cohere({
      apiKey: "test-api-key",
      model: "command-a-03-2025",
      apiBase: "https://api.cohere.com/v2/",
    });

    await runLlmTest({
      llm: cohere,
      methodToTest: "streamChat",
      params: [
        [{ role: "user", content: "hello" }],
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.cohere.com/v2/chat",
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: {
          model: "command-a-03-2025",
          max_tokens: 8192,
          messages: [{ role: "user", content: "hello" }],
          stream: true,
          thinking: { type: "disabled" },
        },
      },
      mockStream: [
        '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
        '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"text","text":""}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"Hello!"}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":" How can I help you today?"}}}}',
        '{"type":"content-end","index":0}',
        '{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":1,"output_tokens":9},"tokens":{"input_tokens":496,"output_tokens":11},"cached_tokens":448}}}',
      ],
    });
  });

  test("streamChat should send a valid request with tool calls messages", async () => {
    const cohere = new Cohere({
      apiKey: "test-api-key",
      model: "command-a-03-2025",
      apiBase: "https://api.cohere.com/v2/",
    });

    await runLlmTest({
      llm: cohere,
      methodToTest: "streamChat",
      params: [
        [
          { role: "user", content: "What's the weather in New York?" },
          {
            role: "thinking",
            content: "I will look up the weather in New York",
          },
          {
            role: "assistant",
            content: " ",
            toolCalls: [
              {
                id: "get_weather_qm3vz6v54dmw",
                function: {
                  name: "get_weather",
                  arguments: '{"location": "New York"}',
                },
              },
            ],
          },
          {
            role: "tool",
            content: "Sunny",
            toolCallId: "get_weather_qm3vz6v54dmw",
          },
        ],
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.cohere.com/v2/chat",
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: {
          model: "command-a-03-2025",
          max_tokens: 8192,
          messages: [
            { role: "user", content: "What's the weather in New York?" },
            {
              role: "assistant",
              content: [
                {
                  type: "thinking",
                  thinking: "I will look up the weather in New York",
                },
              ],
              tool_calls: [
                {
                  id: "get_weather_qm3vz6v54dmw",
                  type: "function",
                  function: {
                    name: "get_weather",
                    arguments: '{"location": "New York"}',
                  },
                },
              ],
            },
            {
              role: "tool",
              content: "Sunny",
              tool_call_id: "get_weather_qm3vz6v54dmw",
            },
          ],
          stream: true,
          thinking: { type: "disabled" },
        },
      },
      mockStream: [
        '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
        '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"text","text":""}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"It\'s sunny"}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":" in New York."}}}}',
        '{"type":"content-end","index":1}',
        '{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":11,"output_tokens":7},"tokens":{"input_tokens":600,"output_tokens":9},"cached_tokens":448}}}',
      ],
    });
  });

  test("streamChat should send a valid request with images", async () => {
    const cohere = new Cohere({
      apiKey: "test-api-key",
      model: "command-a-vision-07-2025",
      apiBase: "https://api.cohere.com/v2/",
    });

    await runLlmTest({
      llm: cohere,
      methodToTest: "streamChat",
      params: [
        [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "hello",
              },
              {
                type: "imageUrl",
                imageUrl: {
                  url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mMsKL5ZDwAFVAI9A6eNqwAAAABJRU5ErkJggg==",
                },
              },
            ],
          },
        ],
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.cohere.com/v2/chat",
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: {
          model: "command-a-vision-07-2025",
          max_tokens: 8192,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "hello",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mMsKL5ZDwAFVAI9A6eNqwAAAABJRU5ErkJggg==",
                  },
                },
              ],
            },
          ],
          stream: true,
          thinking: { type: "disabled" },
        },
      },
      mockStream: [
        '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
        '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"text","text":""}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"Hello!"}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":" How can I assist you today?"}}}}',
        '{"type":"content-end","index":0}',
        '{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":260,"output_tokens":10},"tokens":{"input_tokens":497,"output_tokens":10,"image_tokens":259},"cached_tokens":480}}}',
      ],
    });
  });

  test("streamChat should send a valid request with thinking messages", async () => {
    const cohere = new Cohere({
      apiKey: "test-api-key",
      model: "command-a-reasoning-08-2025",
      apiBase: "https://api.cohere.com/v2/",
      completionOptions: {
        model: "command-a-reasoning-08-2025",
        reasoning: true,
      },
    });

    await runLlmTest({
      llm: cohere,
      methodToTest: "streamChat",
      params: [
        [
          { role: "user", content: "hello" },
          {
            role: "thinking",
            content:
              'Okay, the user just said "hello". Let me figure out how to respond. Since they\'re greeting me, I should greet them back.',
          },
          { role: "assistant", content: "Hello! How can I assist you today?" },
          { role: "user", content: "hello again" },
        ],
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.cohere.com/v2/chat",
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: {
          model: "command-a-reasoning-08-2025",
          max_tokens: 32768,
          messages: [
            { role: "user", content: "hello" },
            {
              role: "assistant",
              content: [
                {
                  type: "thinking",
                  thinking:
                    'Okay, the user just said "hello". Let me figure out how to respond. Since they\'re greeting me, I should greet them back.',
                },
                { type: "text", text: "Hello! How can I assist you today?" },
              ],
            },
            { role: "user", content: "hello again" },
          ],
          stream: true,
          thinking: { type: "enabled", token_budget: 2048 },
        },
      },
      mockStream: [
        '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
        '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"thinking","thinking":""}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"thinking":"Alright, the user said \"hello again\". Let me check the chat history."}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"thinking":" The user first said \"hello\", and I\'ll keep it friendly and open-ended."}}}}',
        '{"type":"content-end","index":0}',
        '{"type":"content-start","index":1,"delta":{"message":{"content":{"type":"text","text":""}}}}',
        '{"type":"content-delta","index":1,"delta":{"message":{"content":{"text":"Hello again!"}}}}',
        '{"type":"content-delta","index":1,"delta":{"message":{"content":{"text":" It\'s nice to see you back. Is there something specific you need help with, or would you just like to chat?"}}}}',
        '{"type":"content-end","index":1}',
        '{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":12,"output_tokens":138},"tokens":{"input_tokens":1437,"output_tokens":142},"cached_tokens":1344}}}',
      ],
    });
  });

  test("chat should send a valid request", async () => {
    const cohere = new Cohere({
      apiKey: "test-api-key",
      model: "command-a-03-2025",
      apiBase: "https://api.cohere.com/v2/",
    });

    await runLlmTest({
      llm: cohere,
      methodToTest: "chat",
      params: [
        [{ role: "user", content: "hello" }],
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.cohere.com/v2/chat",
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: {
          model: "command-a-03-2025",
          max_tokens: 8192,
          messages: [{ role: "user", content: "hello" }],
          stream: true,
          thinking: { type: "disabled" },
        },
      },
      mockStream: [
        '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
        '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"text","text":""}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"Hello!"}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":" How can I help you today?"}}}}',
        '{"type":"content-end","index":0}',
        '{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":1,"output_tokens":9},"tokens":{"input_tokens":496,"output_tokens":11},"cached_tokens":448}}}',
      ],
    });
  });

  test("streamComplete should send a valid request", async () => {
    const cohere = new Cohere({
      apiKey: "test-api-key",
      model: "command-a-03-2025",
      apiBase: "https://api.cohere.com/v2/",
    });

    await runLlmTest({
      llm: cohere,
      methodToTest: "streamComplete",
      params: ["Complete this: Hello", new AbortController().signal],
      expectedRequest: {
        url: "https://api.cohere.com/v2/chat",
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: {
          model: "command-a-03-2025",
          max_tokens: 8192,
          messages: [{ role: "user", content: "Complete this: Hello" }],
          stream: true,
          thinking: { type: "disabled" },
        },
      },
      mockStream: [
        '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
        '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"text","text":""}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":" world!"}}}}',
        '{"type":"content-end","index":0}',
        '{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":4,"output_tokens":3},"tokens":{"input_tokens":499,"output_tokens":5},"cached_tokens":448}}}',
      ],
    });
  });

  test("complete should send a valid request", async () => {
    const cohere = new Cohere({
      apiKey: "test-api-key",
      model: "command-a-03-2025",
      apiBase: "https://api.cohere.com/v2/",
    });

    await runLlmTest({
      llm: cohere,
      methodToTest: "complete",
      params: ["Complete this: Hello", new AbortController().signal],
      expectedRequest: {
        url: "https://api.cohere.com/v2/chat",
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: {
          model: "command-a-03-2025",
          max_tokens: 8192,
          messages: [{ role: "user", content: "Complete this: Hello" }],
          stream: true,
          thinking: { type: "disabled" },
        },
      },
      mockStream: [
        '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
        '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"text","text":""}}}}',
        '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":" world!"}}}}',
        '{"type":"content-end","index":0}',
        '{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":4,"output_tokens":3},"tokens":{"input_tokens":499,"output_tokens":5},"cached_tokens":448}}}',
      ],
    });
  });

  describe("Different configurations", () => {
    test("should handle system message", async () => {
      const cohere = new Cohere({
        apiKey: "test-api-key",
        model: "command-a-03-2025",
        apiBase: "https://api.cohere.com/v2/",
      });

      await runLlmTest({
        llm: cohere,
        methodToTest: "streamChat",
        params: [
          [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello!" },
          ],
          new AbortController().signal,
        ],
        expectedRequest: {
          url: "https://api.cohere.com/v2/chat",
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
          body: {
            model: "command-a-03-2025",
            max_tokens: 8192,
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: "Hello!" },
            ],
            stream: true,
            thinking: { type: "disabled" },
          },
        },
        mockStream: [
          '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
          '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"text","text":""}}}}',
          '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"Hello!"}}}}',
          '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":" How can I assist you today?"}}}}',
          '{"type":"content-end","index":0}',
          '{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":10,"output_tokens":9},"tokens":{"input_tokens":539,"output_tokens":11},"cached_tokens":496}}}',
        ],
      });
    });

    test("should handle tool calls with tool plan (legacy)", async () => {
      const cohere = new Cohere({
        apiKey: "test-api-key",
        model: "command-a-03-2025",
        apiBase: "https://api.cohere.com/v2/",
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
        llm: cohere,
        methodToTest: "streamChat",
        params: [
          [{ role: "user", content: "What's the weather in New York?" }],
          new AbortController().signal,
          { tools },
        ],
        expectedRequest: {
          url: "https://api.cohere.com/v2/chat",
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
          body: {
            model: "command-a-03-2025",
            max_tokens: 8192,
            messages: [
              { role: "user", content: "What's the weather in New York?" },
            ],
            stream: true,
            thinking: { type: "disabled" },
            tools: [
              {
                type: "function",
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
            ],
          },
        },
        mockStream: [
          '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
          '{"type":"tool-plan-delta","delta":{"message":{"tool_plan":"I will look up the weather"}}}',
          '{"type":"tool-plan-delta","delta":{"message":{"tool_plan":" in New York"}}}',
          '{"type":"tool-call-start","index":0,"delta":{"message":{"tool_calls":{"id":"get_weather_qm3vz6v54dmw","type":"function","function":{"name":"get_weather","arguments":""}}}}}',
          '{"type":"tool-call-delta","index":0,"delta":{"message":{"tool_calls":{"function":{"arguments":"{\\"location\\": \\""}}}}',
          '{"type":"tool-call-delta","index":0,"delta":{"message":{"tool_calls":{"function":{"arguments":"\\"New York\\"}"}}}}',
          '{"type":"tool-call-end","index":0}',
          '{"type":"message-end","delta":{"finish_reason":"TOOL_CALL","usage":{"billed_units":{"input_tokens":17,"output_tokens":19},"tokens":{"input_tokens":1434,"output_tokens":48},"cached_tokens":992}}}',
        ],
      });
    });

    test("should handle tool calls with thinking disabled", async () => {
      const cohere = new Cohere({
        apiKey: "test-api-key",
        model: "command-a-reasoning-08-2025",
        apiBase: "https://api.cohere.com/v2/",
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
        llm: cohere,
        methodToTest: "streamChat",
        params: [
          [{ role: "user", content: "What's the weather in New York?" }],
          new AbortController().signal,
          { tools },
        ],
        expectedRequest: {
          url: "https://api.cohere.com/v2/chat",
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
          body: {
            model: "command-a-reasoning-08-2025",
            max_tokens: 32768,
            messages: [
              { role: "user", content: "What's the weather in New York?" },
            ],
            stream: true,
            thinking: { type: "disabled" },
            tools: [
              {
                type: "function",
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
            ],
          },
        },
        mockStream: [
          '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
          '{"type":"tool-call-start","index":0,"delta":{"message":{"tool_calls":{"id":"get_weather_qm3vz6v54dmw","type":"function","function":{"name":"get_weather","arguments":""}}}}}',
          '{"type":"tool-call-delta","index":0,"delta":{"message":{"tool_calls":{"function":{"arguments":"{\\"location\\": \\""}}}}',
          '{"type":"tool-call-delta","index":0,"delta":{"message":{"tool_calls":{"function":{"arguments":"\\"New York\\"}"}}}}',
          '{"type":"tool-call-end","index":0}',
          '{"type":"message-end","delta":{"finish_reason":"TOOL_CALL","usage":{"billed_units":{"input_tokens":17,"output_tokens":9},"tokens":{"input_tokens":1174,"output_tokens":36},"cached_tokens":0}}}',
        ],
      });
    });

    test("should handle tool calls with thinking enabled", async () => {
      const cohere = new Cohere({
        apiKey: "test-api-key",
        model: "command-a-reasoning-08-2025",
        apiBase: "https://api.cohere.com/v2/",
        completionOptions: {
          model: "command-a-reasoning-08-2025",
          reasoning: true,
        },
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
        llm: cohere,
        methodToTest: "streamChat",
        params: [
          [{ role: "user", content: "What's the weather in New York?" }],
          new AbortController().signal,
          { tools },
        ],
        expectedRequest: {
          url: "https://api.cohere.com/v2/chat",
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
          body: {
            model: "command-a-reasoning-08-2025",
            max_tokens: 32768,
            messages: [
              { role: "user", content: "What's the weather in New York?" },
            ],
            stream: true,
            thinking: { type: "enabled", token_budget: 2048 },
            tools: [
              {
                type: "function",
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
            ],
          },
        },
        mockStream: [
          '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
          '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"thinking","thinking":""}}}}',
          '{"type":"content-delta","index":0,"delta":{"message":{"content":{"thinking":"Okay, the user is asking for the weather in New York. Let me check the available tools. There\'s a tool called get_weather that requires a location parameter. Since the user mentioned New York, I can use that as the location."}}}}',
          '{"type":"content-delta","index":0,"delta":{"message":{"content":{"thinking":" I need to call the get_weather tool with location set to \"New York\" to retrieve the current weather data. No other tools are available, so this should be the only step needed. Once I get the weather data, I can present it to the user."}}}}',
          '{"type":"content-end","index":0}',
          '{"type":"tool-call-start","index":0,"delta":{"message":{"tool_calls":{"id":"get_weather_qm3vz6v54dmw","type":"function","function":{"name":"get_weather","arguments":""}}}}}',
          '{"type":"tool-call-delta","index":0,"delta":{"message":{"tool_calls":{"function":{"arguments":"{\\"location\\": \\""}}}}',
          '{"type":"tool-call-delta","index":0,"delta":{"message":{"tool_calls":{"function":{"arguments":"\\"New York\\"}"}}}}',
          '{"type":"tool-call-end","index":0}',
          '{"type":"message-end","delta":{"finish_reason":"TOOL_CALL","usage":{"billed_units":{"input_tokens":17,"output_tokens":9},"tokens":{"input_tokens":1174,"output_tokens":36},"cached_tokens":0}}}',
        ],
      });
    });

    test("should handle custom max tokens", async () => {
      const cohere = new Cohere({
        apiKey: "test-api-key",
        model: "command-a-03-2025",
        apiBase: "https://api.cohere.com/v2/",
      });

      await runLlmTest({
        llm: cohere,
        methodToTest: "streamChat",
        params: [
          [{ role: "user", content: "hello" }],
          new AbortController().signal,
          { maxTokens: 1000 },
        ],
        expectedRequest: {
          url: "https://api.cohere.com/v2/chat",
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
          body: {
            model: "command-a-03-2025",
            max_tokens: 1000,
            messages: [{ role: "user", content: "hello" }],
            stream: true,
            thinking: { type: "disabled" },
          },
        },
        mockStream: [
          '{"id":"94e3907b-d214-475e-a53f-ae81c76b6e43","type":"message-start","delta":{"message":{"role":"assistant","content":[],"tool_plan":"","tool_calls":[],"citations":[]}}}',
          '{"type":"content-start","index":0,"delta":{"message":{"content":{"type":"text","text":""}}}}',
          '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"Hello! "}}}}',
          '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"How can I help you today?"}}}}',
          '{"type":"content-end","index":0}',
          '{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":1,"output_tokens":9},"tokens":{"input_tokens":496,"output_tokens":11},"cached_tokens":448}}}',
        ],
      });
    });
  });
});
