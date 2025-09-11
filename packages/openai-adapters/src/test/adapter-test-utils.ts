import { afterEach, describe, expect, test, vi } from "vitest";
import { BaseLlmApi } from "../apis/base.js";
import { LLMConfig } from "../types.js";
import { constructLlmApi } from "../index.js";

interface AdapterTestCase {
  config: LLMConfig;
  methodToTest: keyof BaseLlmApi;
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

async function executeAdapterMethod(
  api: BaseLlmApi,
  methodToTest: keyof BaseLlmApi,
  params: any[],
) {
  if (typeof (api as any)[methodToTest] !== "function") {
    throw new Error(
      `Method ${String(methodToTest)} does not exist on the adapter instance.`,
    );
  }

  const result = await (api as any)[methodToTest](...params);

  // If it's a generator/async iterator, consume it to trigger the HTTP request
  if (result?.next) {
    for await (const _ of result) {
      // Just consume the generator to trigger the request
    }
  }
}

function assertFetchCall(mockFetch: any, expectedRequest: any) {
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, options] = mockFetch.mock.calls[0];

  expect(url.toString()).toBe(expectedRequest.url);
  expect(options.method).toBe(expectedRequest.method);

  if (expectedRequest.headers) {
    // Handle both plain objects and Headers objects
    const actualHeaders = options.headers;
    if (
      actualHeaders &&
      typeof actualHeaders === "object" &&
      "get" in actualHeaders
    ) {
      // This is a Headers-like object, convert to plain object for comparison
      const headersObj: Record<string, string> = {};
      for (const key of Object.keys(expectedRequest.headers)) {
        const value = actualHeaders.get(key);
        if (value !== null && value !== undefined) {
          headersObj[key] = value;
        }
      }
      expect(headersObj).toEqual(
        expect.objectContaining(expectedRequest.headers),
      );
    } else {
      expect(actualHeaders).toEqual(
        expect.objectContaining(expectedRequest.headers),
      );
    }
  }

  if (expectedRequest.body) {
    const actualBody = JSON.parse(options.body as string);
    expect(actualBody).toEqual(expectedRequest.body);
  }
}

export async function runAdapterTest(testCase: AdapterTestCase) {
  const {
    config,
    methodToTest,
    params,
    expectedRequest,
    mockResponse,
    mockStream,
  } = testCase;

  const mockFetch = setupMockFetch(mockResponse, mockStream);
  setupReadableStreamPolyfill();

  // Mock fetch globally before constructing the API
  vi.stubGlobal("fetch", mockFetch);

  // For non-OpenAI adapters, mock the fetch package
  const fetchPackage = await import("@continuedev/fetch");
  if (fetchPackage.fetchwithRequestOptions) {
    vi.mocked(fetchPackage.fetchwithRequestOptions).mockImplementation(
      mockFetch as any,
    );
  }

  const api = constructLlmApi(config);
  if (!api) {
    throw new Error(`Failed to construct API for provider: ${config.provider}`);
  }

  // For OpenAI adapters, we need to replace the fetch on the OpenAI client
  if ((api as any).openai) {
    (api as any).openai.fetch = mockFetch;
  }

  await executeAdapterMethod(api, methodToTest, params);
  assertFetchCall(mockFetch, expectedRequest);
}

export interface AdapterTestConfig {
  providerName: string;
  config: LLMConfig;
  expectedApiBase: string;
  customHeaders?: Record<string, string>;
  customBodyOptions?: any;
}

export const createAdapterTests = (testConfig: AdapterTestConfig) => {
  describe(testConfig.providerName, () => {
    afterEach(() => {
      vi.clearAllMocks();
      vi.unstubAllGlobals();
    });

    test("should construct API correctly", () => {
      const api = constructLlmApi(testConfig.config);
      expect(api).toBeDefined();
    });

    test("chatCompletionNonStream should send a valid request", async () => {
      await runAdapterTest({
        config: testConfig.config,
        methodToTest: "chatCompletionNonStream",
        params: [
          {
            model: "gpt-4",
            messages: [{ role: "user", content: "hello" }],
          },
          new AbortController().signal,
        ],
        expectedRequest: {
          url: `${testConfig.expectedApiBase}chat/completions`,
          method: "POST",
          headers: {
            ...testConfig.customHeaders,
          },
          body: {
            model: "gpt-4",
            messages: [{ role: "user", content: "hello" }],
            ...testConfig.customBodyOptions,
          },
        },
        mockResponse: {
          id: "test-id",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello! How can I help you today?",
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25,
          },
        },
      });
    });

    test("chatCompletionStream should send a valid request", async () => {
      await runAdapterTest({
        config: testConfig.config,
        methodToTest: "chatCompletionStream",
        params: [
          {
            model: "gpt-4",
            messages: [{ role: "user", content: "hello" }],
            stream: true,
          },
          new AbortController().signal,
        ],
        expectedRequest: {
          url: `${testConfig.expectedApiBase}chat/completions`,
          method: "POST",
          headers: {
            ...testConfig.customHeaders,
          },
          body: {
            model: "gpt-4",
            messages: [{ role: "user", content: "hello" }],
            stream: true,
            stream_options: { include_usage: true },
            ...testConfig.customBodyOptions,
          },
        },
        mockStream: [
          {
            id: "test-id",
            object: "chat.completion.chunk",
            created: 1234567890,
            model: "gpt-4",
            choices: [
              {
                index: 0,
                delta: { content: "Hello" },
                finish_reason: null,
              },
            ],
          },
          {
            id: "test-id",
            object: "chat.completion.chunk",
            created: 1234567890,
            model: "gpt-4",
            choices: [
              {
                index: 0,
                delta: { content: " world" },
                finish_reason: null,
              },
            ],
          },
        ],
      });
    });

    test("embed should send a valid request", async () => {
      await runAdapterTest({
        config: testConfig.config,
        methodToTest: "embed",
        params: [
          {
            model: "text-embedding-ada-002",
            input: ["Hello", "World"],
          },
        ],
        expectedRequest: {
          url: `${testConfig.expectedApiBase}embeddings`,
          method: "POST",
          headers: {
            ...testConfig.customHeaders,
          },
          body: {
            model: "text-embedding-ada-002",
            input: ["Hello", "World"],
            encoding_format: "base64",
            ...testConfig.customBodyOptions,
          },
        },
        mockResponse: {
          object: "list",
          data: [
            {
              object: "embedding",
              embedding: [0.1, 0.2, 0.3],
              index: 0,
            },
            {
              object: "embedding",
              embedding: [0.4, 0.5, 0.6],
              index: 1,
            },
          ],
          model: "text-embedding-ada-002",
          usage: {
            prompt_tokens: 6,
            total_tokens: 6,
          },
        },
      });
    });
  });
};
