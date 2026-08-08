import { createOpenAISubclassTests } from "./test-utils/openai-test-utils.js";

// Import core OpenAI-compatible providers
import OpenAI from "./OpenAI.js";
import Groq from "./Groq.js";
import Fireworks from "./Fireworks.js";
import Together from "./Together.js";
import Deepseek from "./Deepseek.js";
import OpenRouter from "./OpenRouter.js";
import xAI from "./xAI.js";
import Mistral from "./Mistral.js";
import LMStudio from "./LMStudio.js";
import Cerebras from "./Cerebras.js";
import DeepInfra from "./DeepInfra.js";
import Nvidia from "./Nvidia.js";
import CometAPI from "./CometAPI.js";

// Base OpenAI tests
import { afterEach, describe, expect, test, vi } from "vitest";
import { ILLM } from "../../index.js";

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

describe("OpenAI", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("streamChat should send a valid request", async () => {
    const openai = new OpenAI({
      apiKey: "test-api-key",
      model: "gpt-4",
      apiBase: "https://api.openai.com/v1/",
    });

    await runLlmTest({
      llm: openai,
      methodToTest: "streamChat",
      params: [
        [{ role: "user", content: "hello" }],
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.openai.com/v1/chat/completions",
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
});

// Core OpenAI-compatible providers
createOpenAISubclassTests(Groq, {
  providerName: "groq",
  defaultApiBase: "https://api.groq.com/openai/v1/",
  modelConversions: {
    "mistral-8x7b": "mistral-8x7b",
    "llama3-8b": "llama3-8b-8192",
  },
  modelConversionContent: "[INST] hello [/INST]",
  modelConversionMaxTokens: 4096,
});

createOpenAISubclassTests(Fireworks, {
  providerName: "fireworks",
  defaultApiBase: "https://api.fireworks.ai/inference/v1/",
  modelConversions: {
    "starcoder-7b": "starcoder-7b",
  },
  modelConversionContent:
    "<|im_start|>user\nhello<|im_end|>\n<|im_start|>assistant\n",
});

createOpenAISubclassTests(Together, {
  providerName: "together",
  defaultApiBase: "https://api.together.xyz/v1/",
  modelConversions: {
    "codellama-7b": "codellama-7b",
    "llama3-8b": "meta-llama/Llama-3-8b-chat-hf",
  },
  modelConversionContent: "hello",
  customStreamCompleteEndpoint: "completions",
});

createOpenAISubclassTests(Deepseek, {
  providerName: "deepseek",
  defaultApiBase: "https://api.deepseek.com/",
});

createOpenAISubclassTests(OpenRouter, {
  providerName: "openrouter",
  defaultApiBase: "https://openrouter.ai/api/v1/",
});

createOpenAISubclassTests(xAI, {
  providerName: "xAI",
  defaultApiBase: "https://api.x.ai/v1/",
  modelConversions: {
    "grok-beta": "grok-beta",
  },
  modelConversionContent: "hello",
});

createOpenAISubclassTests(Mistral, {
  providerName: "mistral",
  defaultApiBase: "https://api.mistral.ai/v1/",
  modelConversions: {
    "mistral-7b": "mistral-7b",
    "mistral-8x7b": "open-mixtral-8x7b",
  },
  modelConversionContent: "hello",
});

createOpenAISubclassTests(LMStudio, {
  providerName: "lmstudio",
  defaultApiBase: "http://localhost:1234/v1/",
});

createOpenAISubclassTests(Cerebras, {
  providerName: "cerebras",
  defaultApiBase: "https://api.cerebras.ai/v1/",
  modelConversions: {
    "llama3.1-8b": "llama3.1-8b",
    "llama3.1-70b": "llama3.1-70b",
  },
  modelConversionContent:
    "<|start_header_id|>user<|end_header_id|>\nhello<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n",
});

createOpenAISubclassTests(DeepInfra, {
  providerName: "deepinfra",
  defaultApiBase: "https://api.deepinfra.com/v1/openai/",
  customEmbeddingsUrl:
    "https://api.deepinfra.com/v1/inference/text-embedding-ada-002",
  customEmbeddingsHeaders: {
    Authorization: "bearer test-api-key",
  },
  customEmbeddingsBody: {
    inputs: ["Hello", "World"],
  },
});

createOpenAISubclassTests(Nvidia, {
  providerName: "nvidia",
  defaultApiBase: "https://integrate.api.nvidia.com/v1/",
  customEmbeddingsHeaders: {
    Authorization: "Bearer test-api-key",
    "Content-Type": "application/json",
  },
  customEmbeddingsBody: {
    input: ["Hello", "World"],
    model: "text-embedding-ada-002",
    input_type: "passage",
    truncate: "END",
  },
});

createOpenAISubclassTests(CometAPI, {
  providerName: "cometapi",
  defaultApiBase: "https://api.cometapi.com/v1/",
  modelConversions: {
    "gpt-5-mini": "gpt-5-mini",
    "claude-4-sonnet": "claude-sonnet-4-20250514",
  },
  modelConversionContent: "hello",
});
