import { afterEach, describe, expect, test, vi } from "vitest";
import { runAdapterTest } from "./adapter-test-utils.js";

// Mock the fetch package
vi.mock("@continuedev/fetch", async () => {
  const actual = await vi.importActual("@continuedev/fetch");
  return {
    ...actual,
    fetchwithRequestOptions: vi.fn(),
  };
});

describe("AskSage Adapter Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test("should construct API correctly", async () => {
    const { constructLlmApi } = await import("../index.js");
    const api = constructLlmApi({
      provider: "askSage",
      apiKey: "test-api-key",
    });
    expect(api).toBeDefined();
  });

  test("should construct API with email config", async () => {
    const { constructLlmApi } = await import("../index.js");
    const api = constructLlmApi({
      provider: "askSage",
      apiKey: "test-api-key",
      apiBase: "https://api.asksage.ai/server",
      env: {
        email: "test@example.com",
        userApiUrl: "https://api.asksage.ai/user",
      },
    });
    expect(api).toBeDefined();
  });

  test("chatCompletionNonStream should send a valid request", async () => {
    await runAdapterTest({
      config: {
        provider: "askSage",
        apiKey: "test-api-key",
        apiBase: "https://api.asksage.ai/server",
      },
      methodToTest: "chatCompletionNonStream",
      params: [
        {
          model: "gpt-4o",
          messages: [{ role: "user", content: "hello" }],
        },
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.asksage.ai/server/query",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          "x-access-tokens": "test-api-key",
        },
        body: {
          message: "hello",
          model: "gpt-4o",
          temperature: 0,
          mode: "chat",
          limit_references: 0,
        },
      },
      mockResponse: {
        text: "Hello! How can I help you today?",
        status: 200,
      },
    });
  });

  test("chatCompletionNonStream with system message should convert correctly", async () => {
    await runAdapterTest({
      config: {
        provider: "askSage",
        apiKey: "test-api-key",
        apiBase: "https://api.asksage.ai/server",
      },
      methodToTest: "chatCompletionNonStream",
      params: [
        {
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "hello" },
          ],
        },
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.asksage.ai/server/query",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          "x-access-tokens": "test-api-key",
        },
        body: {
          message: [{ user: "me", message: "hello" }],
          model: "gpt-4o",
          temperature: 0,
          mode: "chat",
          limit_references: 0,
          system_prompt: "You are a helpful assistant.",
        },
      },
      mockResponse: {
        text: "Hello! I'm here to help.",
        status: 200,
      },
    });
  });

  test("chatCompletionNonStream with multi-turn conversation", async () => {
    await runAdapterTest({
      config: {
        provider: "askSage",
        apiKey: "test-api-key",
        apiBase: "https://api.asksage.ai/server",
      },
      methodToTest: "chatCompletionNonStream",
      params: [
        {
          model: "gpt-4o",
          messages: [
            { role: "user", content: "What is 2+2?" },
            { role: "assistant", content: "4" },
            { role: "user", content: "And 3+3?" },
          ],
        },
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.asksage.ai/server/query",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          "x-access-tokens": "test-api-key",
        },
        body: {
          message: [
            { user: "me", message: "What is 2+2?" },
            { user: "gpt", message: "4" },
            { user: "me", message: "And 3+3?" },
          ],
          model: "gpt-4o",
          temperature: 0,
          mode: "chat",
          limit_references: 0,
        },
      },
      mockResponse: {
        text: "6",
        status: 200,
      },
    });
  });

  test("chatCompletionNonStream with tools should convert correctly", async () => {
    await runAdapterTest({
      config: {
        provider: "askSage",
        apiKey: "test-api-key",
        apiBase: "https://api.asksage.ai/server",
      },
      methodToTest: "chatCompletionNonStream",
      params: [
        {
          model: "gpt-4o",
          messages: [{ role: "user", content: "What's the weather in NYC?" }],
          tools: [
            {
              type: "function",
              function: {
                name: "get_weather",
                description: "Get current weather for a location",
                parameters: {
                  type: "object",
                  properties: {
                    location: { type: "string", description: "City name" },
                  },
                  required: ["location"],
                },
              },
            },
          ],
          tool_choice: "auto",
        },
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.asksage.ai/server/query",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          "x-access-tokens": "test-api-key",
        },
        body: {
          message: "What's the weather in NYC?",
          model: "gpt-4o",
          temperature: 0,
          mode: "chat",
          limit_references: 0,
          tools: [
            {
              type: "function",
              function: {
                name: "get_weather",
                description: "Get current weather for a location",
                parameters: {
                  type: "object",
                  properties: {
                    location: { type: "string", description: "City name" },
                  },
                  required: ["location"],
                },
              },
            },
          ],
          tool_choice: "auto",
        },
      },
      mockResponse: {
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location":"NYC"}',
            },
          },
        ],
        status: 200,
      },
    });
  });

  test("chatCompletionStream should send a valid request", async () => {
    await runAdapterTest({
      config: {
        provider: "askSage",
        apiKey: "test-api-key",
        apiBase: "https://api.asksage.ai/server",
      },
      methodToTest: "chatCompletionStream",
      params: [
        {
          model: "gpt-4o",
          messages: [{ role: "user", content: "hello" }],
          stream: true,
        },
        new AbortController().signal,
      ],
      expectedRequest: {
        url: "https://api.asksage.ai/server/query",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          "x-access-tokens": "test-api-key",
        },
        body: {
          message: "hello",
          model: "gpt-4o",
          temperature: 0,
          mode: "chat",
          limit_references: 0,
        },
      },
      // AskSage returns JSON, not SSE stream - the adapter converts it to chunks
      mockResponse: {
        text: "Hello! How can I help you today?",
        status: 200,
      },
    });
  });

  test("embed should throw not supported error", async () => {
    const { constructLlmApi } = await import("../index.js");
    const api = constructLlmApi({
      provider: "askSage",
      apiKey: "test-api-key",
    });

    await expect(
      api!.embed({
        model: "text-embedding-ada-002",
        input: ["Hello", "World"],
      }),
    ).rejects.toThrow("AskSage does not support embeddings");
  });

  test("rerank should throw not supported error", async () => {
    const { constructLlmApi } = await import("../index.js");
    const api = constructLlmApi({
      provider: "askSage",
      apiKey: "test-api-key",
    });

    await expect(
      api!.rerank({
        model: "rerank-model",
        query: "test query",
        documents: ["doc1", "doc2"],
      }),
    ).rejects.toThrow("AskSage does not support reranking");
  });

  test("completionNonStream should throw not supported error", async () => {
    const { constructLlmApi } = await import("../index.js");
    const api = constructLlmApi({
      provider: "askSage",
      apiKey: "test-api-key",
    });

    expect(() =>
      api!.completionNonStream(
        {
          model: "gpt-4o",
          prompt: "Hello",
        },
        new AbortController().signal,
      ),
    ).toThrow("AskSage does not support legacy completions API");
  });

  test("list should return empty array", async () => {
    const { constructLlmApi } = await import("../index.js");
    const api = constructLlmApi({
      provider: "askSage",
      apiKey: "test-api-key",
    });

    const models = await api!.list();
    expect(models).toEqual([]);
  });
});
