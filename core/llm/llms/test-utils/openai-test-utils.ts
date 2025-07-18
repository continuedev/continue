import { afterEach, describe, expect, test, vi } from "vitest";
import { ILLM } from "../../../index.js";
import OpenAI from "../OpenAI.js";

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

  // Disable OpenAI adapter to use our custom fetch mock
  (llm as any).useOpenAIAdapterFor = [];

  await executeLlmMethod(llm, methodToTest, params);
  assertFetchCall(mockFetch, expectedRequest);
}

export interface OpenAISubclassConfig {
  providerName: string;
  defaultApiBase: string;
  modelConversions?: { [key: string]: string };
  customOptions?: any;
  modelConversionContent?: string;
  modelConversionMaxTokens?: number;
  customStreamCompleteEndpoint?: string;
  customEmbeddingsUrl?: string;
  customEmbeddingsHeaders?: { [key: string]: string };
  customEmbeddingsBody?: any;
}

export const createOpenAISubclassTests = (
  ProviderClass: typeof OpenAI,
  config: OpenAISubclassConfig,
) => {
  describe(config.providerName, () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    test("should have correct provider name", () => {
      expect(ProviderClass.providerName).toBe(config.providerName);
    });

    test("should have correct default API base", () => {
      expect(ProviderClass.defaultOptions?.apiBase).toBe(config.defaultApiBase);
    });

    test("streamChat should send a valid request", async () => {
      const provider = new ProviderClass({
        apiKey: "test-api-key",
        model: "gpt-4",
        apiBase: config.defaultApiBase,
      });

      await runLlmTest({
        llm: provider,
        methodToTest: "streamChat",
        params: [
          [{ role: "user", content: "hello" }],
          new AbortController().signal,
        ],
        expectedRequest: {
          url: `${config.defaultApiBase}chat/completions`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            model: "gpt-4",
            messages: [{ role: "user", content: "hello" }],
            stream: true,
            max_tokens: 2048,
          },
        },
        mockStream: [
          { choices: [{ delta: { content: "Hello" } }] },
          { choices: [{ delta: { content: " world" } }] },
        ],
      });
    });

    test("chat should send a valid request", async () => {
      const provider = new ProviderClass({
        apiKey: "test-api-key",
        model: "gpt-4",
        apiBase: config.defaultApiBase,
      });

      await runLlmTest({
        llm: provider,
        methodToTest: "chat",
        params: [
          [{ role: "user", content: "hello" }],
          new AbortController().signal,
        ],
        expectedRequest: {
          url: `${config.defaultApiBase}chat/completions`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            model: "gpt-4",
            messages: [{ role: "user", content: "hello" }],
            stream: true,
            max_tokens: 2048,
          },
        },
        mockStream: [
          { choices: [{ delta: { content: "Hello" } }] },
          { choices: [{ delta: { content: " world" } }] },
        ],
      });
    });

    test("streamComplete should send a valid request", async () => {
      const provider = new ProviderClass({
        apiKey: "test-api-key",
        model: "gpt-4",
        apiBase: config.defaultApiBase,
      });

      await runLlmTest({
        llm: provider,
        methodToTest: "streamComplete",
        params: ["Hello", new AbortController().signal],
        expectedRequest: {
          url: `${config.defaultApiBase}${config.customStreamCompleteEndpoint || "chat/completions"}`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: config.customStreamCompleteEndpoint === "completions" ? {
            model: "gpt-4",
            prompt: "Hello",
            stream: true,
            max_tokens: 2048,
          } : {
            model: "gpt-4",
            messages: [{ role: "user", content: "Hello" }],
            stream: true,
            max_tokens: 2048,
          },
        },
        mockStream: [
          { choices: [{ delta: { content: "Hello" } }] },
          { choices: [{ delta: { content: " world" } }] },
        ],
      });
    });

    test("complete should send a valid request", async () => {
      const provider = new ProviderClass({
        apiKey: "test-api-key",
        model: "gpt-4",
        apiBase: config.defaultApiBase,
      });

      await runLlmTest({
        llm: provider,
        methodToTest: "complete",
        params: ["Hello", new AbortController().signal],
        expectedRequest: {
          url: `${config.defaultApiBase}chat/completions`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            model: "gpt-4",
            messages: [{ role: "user", content: "Hello" }],
            stream: true,
            max_tokens: 2048,
          },
        },
        mockStream: [
          { choices: [{ delta: { content: "Hello" } }] },
          { choices: [{ delta: { content: " world" } }] },
        ],
      });
    });

    // Test model conversions if provided
    if (config.modelConversions) {
      test("should convert model names correctly", async () => {
        const testModel = Object.keys(config.modelConversions!)[0];
        const expectedModel = config.modelConversions![testModel];

        const provider = new ProviderClass({
          apiKey: "test-api-key",
          model: testModel,
          apiBase: config.defaultApiBase,
        });

        await runLlmTest({
          llm: provider,
          methodToTest: "chat",
          params: [
            [{ role: "user", content: "hello" }],
            new AbortController().signal,
          ],
          expectedRequest: {
            url: `${config.defaultApiBase}chat/completions`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer test-api-key",
              "api-key": "test-api-key",
            },
            body: {
              model: expectedModel,
              messages: [{ role: "user", content: config.modelConversionContent || "[INST] hello [/INST]" }],
              stream: true,
              max_tokens: config.modelConversionMaxTokens || 4096,
            },
          },
          mockStream: [{ choices: [{ delta: { content: "Hello" } }] }],
        });
      });
    }

    test("should handle embeddings", async () => {
      const provider = new ProviderClass({
        apiKey: "test-api-key",
        model: "text-embedding-ada-002",
        apiBase: config.defaultApiBase,
      });

      await runLlmTest({
        llm: provider,
        methodToTest: "embed",
        params: [["Hello", "World"]],
        expectedRequest: {
          url: config.customEmbeddingsUrl || `${config.defaultApiBase}embeddings`,
          method: "POST",
          headers: config.customEmbeddingsHeaders || {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
            "api-key": "test-api-key",
          },
          body: config.customEmbeddingsBody || {
            input: ["Hello", "World"],
            model: "text-embedding-ada-002",
          },
        },
        mockResponse: {
          data: [
            { embedding: [0.1, 0.2, 0.3] },
            { embedding: [0.4, 0.5, 0.6] },
          ],
        },
      });
    });
  });
};
