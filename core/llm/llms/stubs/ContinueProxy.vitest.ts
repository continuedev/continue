import { afterEach, describe, expect, test, vi } from "vitest";
import { ILLM } from "../../../index.js";
import ContinueProxy from "./ContinueProxy.js";

vi.mock("@continuedev/config-yaml", async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    parseProxyModelName: vi.fn(() => ({
      provider: "test-provider",
      model: "test-model",
      ownerSlug: "test-owner",
      packageSlug: "test-package",
    })),
  };
});

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

describe("ContinueProxy", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("rerank should send a valid request", async () => {
    const proxy = new ContinueProxy({
      apiKey: "test-api-key",
      model: "test-model",
      apiBase: "https://proxy.continue.dev/model-proxy/v1/",
    });

    await runLlmTest({
      llm: proxy,
      methodToTest: "rerank",
      params: [
        "test query",
        [{ content: "document1" }, { content: "document2" }],
      ],
      expectedRequest: {
        url: "https://proxy.continue.dev/model-proxy/v1/rerank",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-api-key",
        },
        body: {
          query: "test query",
          documents: ["document1", "document2"],
          model: "test-model",
          continueProperties: {
            apiBase: "https://proxy.continue.dev/model-proxy/v1/",
            orgScopeId: null,
          },
        },
      },
      mockResponse: {
        data: [
          { index: 0, relevance_score: 0.9 },
          { index: 1, relevance_score: 0.1 },
        ],
      },
    });
  });

  test("streamChat should send a valid request", async () => {
    const proxy = new ContinueProxy({
      apiKey: "test-api-key",
      model: "test-model",
      apiBase: "https://proxy.continue.dev/model-proxy/v1/",
    });

    await runLlmTest({
      llm: proxy,
      methodToTest: "streamChat",
      params: [[{ role: "user", content: "hello" }]],
      expectedRequest: {
        url: "https://proxy.continue.dev/model-proxy/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-api-key",
          "api-key": "test-api-key",
          "x-continue-unique-id": "NOT_UNIQUE",
        },
        body: {
          model: "test-model",
          messages: [{ role: "user", content: "hello" }],
          max_tokens: 4096,
          stream: true,
          continueProperties: {
            apiBase: "https://proxy.continue.dev/model-proxy/v1/",
            orgScopeId: null,
          },
        },
      },
      mockStream: [
        '{"choices": [{"delta": {"content": "response"}}]}',
        "[DONE]",
      ],
    });
  });

  test("chat should send a valid request", async () => {
    const proxy = new ContinueProxy({
      apiKey: "test-api-key",
      model: "test-model",
      apiBase: "https://proxy.continue.dev/model-proxy/v1/",
    });

    await runLlmTest({
      llm: proxy,
      methodToTest: "chat",
      params: [[{ role: "user", content: "hello" }]],
      expectedRequest: {
        url: "https://proxy.continue.dev/model-proxy/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-api-key",
          "api-key": "test-api-key",
          "x-continue-unique-id": "NOT_UNIQUE",
        },
        body: {
          model: "test-model",
          messages: [{ role: "user", content: "hello" }],
          max_tokens: 4096,
          stream: true,
          continueProperties: {
            apiBase: "https://proxy.continue.dev/model-proxy/v1/",
            orgScopeId: null,
          },
        },
      },
      mockStream: [
        '{"choices": [{"delta": {"content": "Hello! How can I help you today?"}}]}',
        "[DONE]",
      ],
    });
  });

  test("streamComplete should send a valid request", async () => {
    const proxy = new ContinueProxy({
      apiKey: "test-api-key",
      model: "test-model",
      apiBase: "https://proxy.continue.dev/model-proxy/v1/",
    });

    await runLlmTest({
      llm: proxy,
      methodToTest: "streamComplete",
      params: ["Complete this: Hello"],
      expectedRequest: {
        url: "https://proxy.continue.dev/model-proxy/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-api-key",
          "api-key": "test-api-key",
          "x-continue-unique-id": "NOT_UNIQUE",
        },
        body: {
          model: "test-model",
          messages: [{ role: "user", content: "Complete this: Hello" }],
          max_tokens: 4096,
          stream: true,
          continueProperties: {
            apiBase: "https://proxy.continue.dev/model-proxy/v1/",
            orgScopeId: null,
          },
        },
      },
      mockStream: [
        '{"choices": [{"delta": {"content": " world!"}}]}',
        "[DONE]",
      ],
    });
  });

  test("complete should send a valid request", async () => {
    const proxy = new ContinueProxy({
      apiKey: "test-api-key",
      model: "test-model",
      apiBase: "https://proxy.continue.dev/model-proxy/v1/",
    });

    await runLlmTest({
      llm: proxy,
      methodToTest: "complete",
      params: ["Complete this: Hello"],
      expectedRequest: {
        url: "https://proxy.continue.dev/model-proxy/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-api-key",
          "api-key": "test-api-key",
          "x-continue-unique-id": "NOT_UNIQUE",
        },
        body: {
          model: "test-model",
          messages: [{ role: "user", content: "Complete this: Hello" }],
          max_tokens: 4096,
          stream: true,
          continueProperties: {
            apiBase: "https://proxy.continue.dev/model-proxy/v1/",
            orgScopeId: null,
          },
        },
      },
      mockStream: [
        '{"choices": [{"delta": {"content": " world!"}}]}',
        "[DONE]",
      ],
    });
  });

  test("streamFim should send a valid request", async () => {
    const proxy = new ContinueProxy({
      apiKey: "test-api-key",
      model: "test-model",
      apiBase: "https://proxy.continue.dev/model-proxy/v1/",
    });

    await runLlmTest({
      llm: proxy,
      methodToTest: "streamFim",
      params: ["function test() {\n  ", "\n}"],
      expectedRequest: {
        url: "https://proxy.continue.dev/model-proxy/v1/fim/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": "test-api-key",
          Authorization: "Bearer test-api-key",
        },
        body: {
          model: "test-model",
          prompt: "function test() {\n  ",
          suffix: "\n}",
          max_tokens: 4096,
          stream: true,
          continueProperties: {
            apiBase: "https://proxy.continue.dev/model-proxy/v1/",
            orgScopeId: null,
          },
        },
      },
      mockStream: [
        '{"choices": [{"delta": {"content": "console.log("Hello");"}}]}',
        "[DONE]",
      ],
    });
  });

  test("embed should send a valid request", async () => {
    const proxy = new ContinueProxy({
      apiKey: "test-api-key",
      model: "test-model",
      apiBase: "https://proxy.continue.dev/model-proxy/v1/",
    });

    await runLlmTest({
      llm: proxy,
      methodToTest: "embed",
      params: [["text to embed", "another text"]],
      expectedRequest: {
        url: "https://proxy.continue.dev/model-proxy/v1/embeddings",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-api-key",
          "api-key": "test-api-key",
        },
        body: {
          input: ["text to embed", "another text"],
          model: "test-model",
          continueProperties: {
            apiBase: "https://proxy.continue.dev/model-proxy/v1/",
            orgScopeId: null,
          },
        },
      },
      mockResponse: {
        data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
      },
    });
  });

  test("listModels should send a valid request", async () => {
    const proxy = new ContinueProxy({
      apiKey: "test-api-key",
      model: "test-model",
      apiBase: "https://proxy.continue.dev/model-proxy/v1/",
    });

    await runLlmTest({
      llm: proxy,
      methodToTest: "listModels",
      params: [],
      expectedRequest: {
        url: "https://proxy.continue.dev/model-proxy/v1/models",
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-api-key",
          "api-key": "test-api-key",
        },
      },
      mockResponse: {
        data: [{ id: "gpt-4" }, { id: "gpt-3.5-turbo" }],
      },
    });
  });

  describe("Different provider configurations", () => {
    test("should handle on-prem proxy URL", async () => {
      const proxy = new ContinueProxy({
        apiKey: "test-api-key",
        model: "test-model",
        onPremProxyUrl: "https://my-proxy.company.com/",
      });

      await runLlmTest({
        llm: proxy,
        methodToTest: "rerank",
        params: [
          "test query",
          [{ content: "document1" }, { content: "document2" }],
        ],
        expectedRequest: {
          url: "https://my-proxy.company.com/model-proxy/v1/rerank",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          },
          body: {
            query: "test query",
            documents: ["document1", "document2"],
            model: "test-model",
            continueProperties: {
              apiBase: undefined,
              apiKeyLocation: undefined,
              env: undefined,
              envSecretLocations: undefined,
              orgScopeId: null,
            },
          },
        },
        mockResponse: {
          data: [
            { index: 0, relevance_score: 0.9 },
            { index: 1, relevance_score: 0.1 },
          ],
        },
      });
    });

    test("should handle environment variables", async () => {
      const proxy = new ContinueProxy({
        apiKey: "test-api-key",
        model: "test-model",
        apiBase: "https://proxy.continue.dev/model-proxy/v1/",
        env: {
          CUSTOM_VAR: "custom-value",
          ANOTHER_VAR: "another-value",
        },
      });

      await runLlmTest({
        llm: proxy,
        methodToTest: "streamChat",
        params: [[{ role: "user", content: "hello" }]],
        expectedRequest: {
          url: "https://proxy.continue.dev/model-proxy/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
            "x-continue-unique-id": "NOT_UNIQUE",
          },
          body: {
            model: "test-model",
            messages: [{ role: "user", content: "hello" }],
            max_tokens: 4096,
            stream: true,
            continueProperties: {
              apiBase: "https://proxy.continue.dev/model-proxy/v1/",
              env: {
                CUSTOM_VAR: "custom-value",
                ANOTHER_VAR: "another-value",
              },
              orgScopeId: null,
            },
          },
        },
        mockStream: [
          '{"choices": [{"delta": {"content": "response"}}]}',
          "[DONE]",
        ],
      });
    });

    test("should handle API key location", async () => {
      const proxy = new ContinueProxy({
        apiKey: "test-api-key",
        model: "test-model",
        apiBase: "https://proxy.continue.dev/model-proxy/v1/",
        apiKeyLocation: "env:OPENAI_API_KEY",
      });

      await runLlmTest({
        llm: proxy,
        methodToTest: "embed",
        params: [["test text"]],
        expectedRequest: {
          url: "https://proxy.continue.dev/model-proxy/v1/embeddings",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            input: ["test text"],
            model: "test-model",
            continueProperties: {
              apiBase: "https://proxy.continue.dev/model-proxy/v1/",
              apiKeyLocation: "env:OPENAI_API_KEY",
              env: undefined,
              envSecretLocations: undefined,
              orgScopeId: null,
            },
          },
        },
        mockResponse: {
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        },
      });
    });

    test("should handle env secret locations", async () => {
      const proxy = new ContinueProxy({
        apiKey: "test-api-key",
        model: "test-model",
        apiBase: "https://proxy.continue.dev/model-proxy/v1/",
        envSecretLocations: {
          AZURE_API_KEY: "env:AZURE_API_KEY",
          AZURE_ENDPOINT: "env:AZURE_ENDPOINT",
        },
      });

      await runLlmTest({
        llm: proxy,
        methodToTest: "streamFim",
        params: ["const x = ", ";"],
        expectedRequest: {
          url: "https://proxy.continue.dev/model-proxy/v1/fim/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-api-key": "test-api-key",
            Authorization: "Bearer test-api-key",
          },
          body: {
            model: "test-model",
            prompt: "const x = ",
            suffix: ";",
            max_tokens: 4096,
            stream: true,
            continueProperties: {
              apiBase: "https://proxy.continue.dev/model-proxy/v1/",
              envSecretLocations: {
                AZURE_API_KEY: "env:AZURE_API_KEY",
                AZURE_ENDPOINT: "env:AZURE_ENDPOINT",
              },
              orgScopeId: null,
            },
          },
        },
        mockStream: ['{"choices": [{"delta": {"content": "42"}}]}', "[DONE]"],
      });
    });

    test("should handle organization scope ID", async () => {
      const proxy = new ContinueProxy({
        apiKey: "test-api-key",
        model: "test-model",
        apiBase: "https://proxy.continue.dev/model-proxy/v1/",
        orgScopeId: "org_12345",
      });

      await runLlmTest({
        llm: proxy,
        methodToTest: "listModels",
        params: [],
        expectedRequest: {
          url: "https://proxy.continue.dev/model-proxy/v1/models",
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
        },
        mockResponse: {
          data: [{ id: "gpt-4" }],
        },
      });
    });
  });

  describe("Edge cases", () => {
    test("should handle empty chunks array for rerank", async () => {
      const proxy = new ContinueProxy({
        apiKey: "test-api-key",
        model: "test-model",
        apiBase: "https://proxy.continue.dev/model-proxy/v1/",
      });

      await runLlmTest({
        llm: proxy,
        methodToTest: "rerank",
        params: ["test query", []],
        expectedRequest: {
          url: "https://proxy.continue.dev/model-proxy/v1/rerank",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          },
          body: {
            query: "test query",
            documents: [],
            model: "test-model",
            continueProperties: {
              apiBase: "https://proxy.continue.dev/model-proxy/v1/",
              apiKeyLocation: undefined,
              env: undefined,
              envSecretLocations: undefined,
              orgScopeId: null,
            },
          },
        },
        mockResponse: {
          data: [],
        },
      });
    });

    test("should handle complex chat messages", async () => {
      const proxy = new ContinueProxy({
        apiKey: "test-api-key",
        model: "test-model",
        apiBase: "https://proxy.continue.dev/model-proxy/v1/",
      });

      const complexMessages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello!" },
        { role: "assistant", content: "Hi there! How can I help you today?" },
        { role: "user", content: "What's the weather like?" },
      ];

      await runLlmTest({
        llm: proxy,
        methodToTest: "streamChat",
        params: [complexMessages],
        expectedRequest: {
          url: "https://proxy.continue.dev/model-proxy/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
            "x-continue-unique-id": "NOT_UNIQUE",
          },
          body: {
            model: "test-model",
            messages: complexMessages,
            max_tokens: 4096,
            stream: true,
            continueProperties: {
              apiBase: "https://proxy.continue.dev/model-proxy/v1/",
              orgScopeId: null,
            },
          },
        },
        mockStream: [
          '{"choices": [{"delta": {"content": "I don\'t have access to current weather data."}}]}',
          "[DONE]",
        ],
      });
    });

    test("should handle single embedding chunk", async () => {
      const proxy = new ContinueProxy({
        apiKey: "test-api-key",
        model: "test-model",
        apiBase: "https://proxy.continue.dev/model-proxy/v1/",
      });

      await runLlmTest({
        llm: proxy,
        methodToTest: "embed",
        params: [["single text"]],
        expectedRequest: {
          url: "https://proxy.continue.dev/model-proxy/v1/embeddings",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
            "api-key": "test-api-key",
          },
          body: {
            input: ["single text"],
            model: "test-model",
            continueProperties: {
              apiBase: "https://proxy.continue.dev/model-proxy/v1/",
              apiKeyLocation: undefined,
              env: undefined,
              envSecretLocations: undefined,
              orgScopeId: null,
            },
          },
        },
        mockResponse: {
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        },
      });
    });
  });
});
