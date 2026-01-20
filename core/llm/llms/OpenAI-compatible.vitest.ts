import { createOpenAISubclassTests } from "./test-utils/openai-test-utils.js";

// Import all OpenAI-compatible providers
import OpenAI from "./OpenAI.js";
import Groq from "./Groq.js";
import Fireworks from "./Fireworks.js";
import Together from "./Together.js";
import Deepseek from "./Deepseek.js";
import OpenRouter from "./OpenRouter.js";
import xAI from "./xAI.js";
import Mistral from "./Mistral.js";
import Mimo from "./Mimo.js";
import LMStudio from "./LMStudio.js";
import Cerebras from "./Cerebras.js";
import DeepInfra from "./DeepInfra.js";
import Nvidia from "./Nvidia.js";
import SambaNova from "./SambaNova.js";
import Scaleway from "./Scaleway.js";
import Venice from "./Venice.js";
import Moonshot from "./Moonshot.js";
import Novita from "./Novita.js";
import SiliconFlow from "./SiliconFlow.js";
import Kindo from "./Kindo.js";
import Azure from "./Azure.js";
import Inception from "./Inception.js";
import Docker from "./Docker.js";
import Voyage from "./Voyage.js";
import Vllm from "./Vllm.js";
import TextGenWebUI from "./TextGenWebUI.js";
// import Relace from "./Relace.js"; // Skip - causing import issues
import FunctionNetwork from "./FunctionNetwork.js";
import NCompass from "./NCompass.js";
import LlamaStack from "./LlamaStack.js";
import Nebius from "./Nebius.js";
import OVHcloud from "./OVHcloud.js";

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

  test("should handle embeddings", async () => {
    const openai = new OpenAI({
      apiKey: "test-api-key",
      model: "text-embedding-ada-002",
      apiBase: "https://api.openai.com/v1/",
    });

    await runLlmTest({
      llm: openai,
      methodToTest: "embed",
      params: [["Hello", "World"]],
      expectedRequest: {
        url: "https://api.openai.com/v1/embeddings",
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
          "api-key": "test-api-key",
        },
        body: {
          input: ["Hello", "World"],
          model: "text-embedding-ada-002",
        },
      },
      mockResponse: {
        data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
      },
    });
  });
});

// OpenAI-compatible providers
createOpenAISubclassTests(Groq, {
  providerName: "groq",
  defaultApiBase: "https://api.groq.com/openai/v1/",
  modelConversions: {
    "mistral-8x7b": "mixtral-8x7b-32768",
    "llama3-8b": "llama3-8b-8192",
    "llama3-70b": "llama3-70b-8192",
  },
  modelConversionContent: "[INST] hello [/INST]",
  modelConversionMaxTokens: 4096,
});

createOpenAISubclassTests(Fireworks, {
  providerName: "fireworks",
  defaultApiBase: "https://api.fireworks.ai/inference/v1/",
  modelConversions: {
    "starcoder-7b": "accounts/fireworks/models/starcoder-7b",
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
    "mistral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1",
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

createOpenAISubclassTests(Mimo, {
  providerName: "mimo",
  defaultApiBase: "https://api.xiaomimimo.com/v1/",
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

createOpenAISubclassTests(SambaNova, {
  providerName: "sambanova",
  defaultApiBase: "https://api.sambanova.ai/v1/",
});

createOpenAISubclassTests(Scaleway, {
  providerName: "scaleway",
  defaultApiBase: "https://api.scaleway.ai/v1/",
});

createOpenAISubclassTests(Venice, {
  providerName: "venice",
  defaultApiBase: "https://api.venice.ai/api/v1/",
});

createOpenAISubclassTests(Moonshot, {
  providerName: "moonshot",
  defaultApiBase: "https://api.moonshot.cn/v1/",
});

createOpenAISubclassTests(Novita, {
  providerName: "novita",
  defaultApiBase: "https://api.novita.ai/v3/openai/",
  customStreamCompleteEndpoint: "completions",
});

createOpenAISubclassTests(SiliconFlow, {
  providerName: "siliconflow",
  defaultApiBase: "https://api.siliconflow.cn/v1/",
});

createOpenAISubclassTests(Kindo, {
  providerName: "kindo",
  defaultApiBase: "https://llm.kindo.ai/v1/",
});

createOpenAISubclassTests(Azure, {
  providerName: "azure",
});

createOpenAISubclassTests(Inception, {
  providerName: "inception",
  defaultApiBase: "https://api.inceptionlabs.ai/v1/",
  customBodyOptions: {
    temperature: 0.0,
    presence_penalty: 1.5,
    stop: ["<|endoftext|>"],
  },
});

createOpenAISubclassTests(Docker, {
  providerName: "docker",
  defaultApiBase: "http://localhost:12434/engines/v1/",
});

createOpenAISubclassTests(Voyage, {
  providerName: "voyage",
  defaultApiBase: "https://api.voyageai.com/v1/",
});

createOpenAISubclassTests(Vllm, {
  providerName: "vllm",
  defaultApiBase: "https://api.openai.com/v1/",
});

createOpenAISubclassTests(TextGenWebUI, {
  providerName: "text-gen-webui",
  defaultApiBase: "http://localhost:5000/v1/",
});

createOpenAISubclassTests(FunctionNetwork, {
  providerName: "function-network",
  defaultApiBase: "https://api.function.network/v1/",
  customEmbeddingsHeaders: {
    Authorization: "Bearer test-api-key",
    "Content-Type": "application/json",
  },
});

createOpenAISubclassTests(NCompass, {
  providerName: "ncompass",
  defaultApiBase: "https://api.ncompass.tech/v1/",
  customEmbeddingsUrl: "https://api.gcp.ncompass.tech/v1/embeddings",
  customEmbeddingsHeaders: {
    Authorization: "Bearer test-api-key",
    "Content-Type": "application/json",
  },
  customEmbeddingsBody: {
    input: ["Hello", "World"],
    model: "text-embedding-ada-002",
  },
});

createOpenAISubclassTests(LlamaStack, {
  providerName: "llamastack",
  defaultApiBase: "http://localhost:8321/v1/openai/v1/",
});

createOpenAISubclassTests(Nebius, {
  providerName: "nebius",
  defaultApiBase: "https://api.studio.nebius.ai/v1/",
});

createOpenAISubclassTests(OVHcloud, {
  providerName: "ovhcloud",
  defaultApiBase: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/",
});
