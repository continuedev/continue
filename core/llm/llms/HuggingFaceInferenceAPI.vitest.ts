import { afterEach, describe, expect, test, vi } from "vitest";
import { ILLM } from "../../index.js";
import HuggingFaceInferenceAPI from "./HuggingFaceInferenceAPI.js";

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

describe("HuggingFaceInferenceAPI", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("streamComplete should forward stop sequences", async () => {
    const hf = new HuggingFaceInferenceAPI({
      apiKey: "test-api-key",
      model: "bigcode/starcoder2-3b",
      apiBase: "https://example.endpoints.huggingface.cloud",
    });

    await runLlmTest({
      llm: hf,
      methodToTest: "streamComplete",
      params: [
        "def add(a, b): return ",
        new AbortController().signal,
        { raw: true, maxTokens: 1024, stop: ["<|endoftext|>", "<fim_prefix>"] },
      ],
      expectedRequest: {
        url: "https://example.endpoints.huggingface.cloud/",
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: {
          inputs: "def add(a, b): return ",
          stream: true,
          parameters: {
            max_new_tokens: 1024,
            stop: ["<|endoftext|>", "<fim_prefix>"],
          },
        },
      },
      mockStream: [{ token: { text: "a + b" } }],
    });
  });

  test("streamComplete should cap stop sequences at maxStopWords", async () => {
    const hf = new HuggingFaceInferenceAPI({
      apiKey: "test-api-key",
      model: "bigcode/starcoder2-3b",
      apiBase: "https://example.endpoints.huggingface.cloud",
      maxStopWords: 2,
    });

    await runLlmTest({
      llm: hf,
      methodToTest: "streamComplete",
      params: [
        "hello",
        new AbortController().signal,
        { raw: true, maxTokens: 1024, stop: ["a", "b", "c", "d"] },
      ],
      expectedRequest: {
        url: "https://example.endpoints.huggingface.cloud/",
        method: "POST",
        body: {
          inputs: "hello",
          stream: true,
          parameters: {
            max_new_tokens: 1024,
            stop: ["a", "b"],
          },
        },
      },
      mockStream: [{ token: { text: "ok" } }],
    });
  });

  test("streamComplete should omit stop when none are given", async () => {
    const hf = new HuggingFaceInferenceAPI({
      apiKey: "test-api-key",
      model: "bigcode/starcoder2-3b",
      apiBase: "https://example.endpoints.huggingface.cloud",
    });

    await runLlmTest({
      llm: hf,
      methodToTest: "streamComplete",
      params: [
        "hello",
        new AbortController().signal,
        { raw: true, maxTokens: 1024 },
      ],
      expectedRequest: {
        url: "https://example.endpoints.huggingface.cloud/",
        method: "POST",
        body: {
          inputs: "hello",
          stream: true,
          parameters: {
            max_new_tokens: 1024,
          },
        },
      },
      mockStream: [{ token: { text: "ok" } }],
    });
  });
});
