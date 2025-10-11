import { describe, expect, test, vi } from "vitest";
import { AnthropicApi } from "../apis/Anthropic.js";
import { GeminiApi } from "../apis/Gemini.js";
import { OpenAIApi } from "../apis/OpenAI.js";
import { CompletionUsage } from "openai/resources/index.js";

describe("Token usage tracking", () => {
  test("OpenAI should track usage in streaming responses", async () => {
    // Mock the OpenAI client
    const mockStream = async function* () {
      yield {
        id: "1",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "gpt-4",
        choices: [
          {
            index: 0,
            delta: { content: "Hello", role: "assistant" },
            finish_reason: null,
            logprobs: null,
          },
        ],
      };
      yield {
        id: "1",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "gpt-4",
        choices: [
          {
            index: 0,
            delta: { content: " world", role: "assistant" },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
      };
      // Usage chunk
      yield {
        id: "1",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "gpt-4",
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };
    };

    const api = new OpenAIApi({ apiKey: "test", provider: "openai" });
    api.openai.chat.completions.create = vi.fn().mockResolvedValue(mockStream());

    const stream = api.chatCompletionStream(
      {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      },
      new AbortController().signal
    );

    let content = "";
    let usage: CompletionUsage | undefined;
    for await (const chunk of stream) {
      if (chunk.choices.length > 0) {
        content += chunk.choices[0].delta.content ?? "";
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    expect(content).toBe("Hello world");
    expect(usage).toBeDefined();
    expect(usage?.prompt_tokens).toBe(10);
    expect(usage?.completion_tokens).toBe(5);
    expect(usage?.total_tokens).toBe(15);
  });

  test("Anthropic should track usage in streaming responses", async () => {
    // Create a mock response that simulates Anthropic's SSE stream
    const mockResponseText = `event: message_start
data: {"type":"message_start","message":{"usage":{"input_tokens":10,"cache_read_input_tokens":2}}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}

event: message_delta
data: {"type":"message_delta","usage":{"output_tokens":5}}

event: message_stop
data: {"type":"message_stop"}
`;

    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/event-stream" }),
      text: vi.fn().mockResolvedValue(mockResponseText),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mockResponseText));
          controller.close();
        },
      }),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const api = new AnthropicApi({ apiKey: "test", provider: "anthropic" });

    const stream = api.chatCompletionStream(
      {
        model: "claude-3",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      },
      new AbortController().signal
    );

    let content = "";
    let usage: CompletionUsage | undefined;
    for await (const chunk of stream) {
      if (chunk.choices.length > 0) {
        content += chunk.choices[0].delta.content ?? "";
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    expect(content).toBe("Hello world");
    expect(usage).toBeDefined();
    expect(usage?.prompt_tokens).toBe(10);
    expect(usage?.completion_tokens).toBe(5);
    expect(usage?.total_tokens).toBe(15);
    expect(usage?.prompt_tokens_details?.cached_tokens).toBe(2);
  });

  test("Gemini should track usage in streaming responses", async () => {
    // Create a mock response for Gemini streaming
    const mockResponseData = [
      {
        candidates: [
          {
            content: {
              parts: [{ text: "Hello" }],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [{ text: " world" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      },
    ];

    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify(mockResponseData))
          );
          controller.close();
        },
      }),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const api = new GeminiApi({ apiKey: "test", provider: "gemini" });

    const stream = api.chatCompletionStream(
      {
        model: "gemini-1.5-flash",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      },
      new AbortController().signal
    );

    let content = "";
    let usage: CompletionUsage | undefined;
    for await (const chunk of stream) {
      if (chunk.choices.length > 0) {
        content += chunk.choices[0].delta.content ?? "";
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    expect(content).toBe("Hello world");
    expect(usage).toBeDefined();
    expect(usage?.prompt_tokens).toBe(10);
    expect(usage?.completion_tokens).toBe(5);
    expect(usage?.total_tokens).toBe(15);
  });

  test("OpenAI should pass through usage in non-streaming responses", async () => {
    const api = new OpenAIApi({ apiKey: "test", provider: "openai" });
    
    const mockResponse = {
      id: "1",
      object: "chat.completion",
      created: Date.now(),
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Hello world",
            refusal: null,
          },
          finish_reason: "stop",
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };

    api.openai.chat.completions.create = vi.fn().mockResolvedValue(mockResponse);

    const response = await api.chatCompletionNonStream(
      {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      },
      new AbortController().signal
    );

    expect(response.choices[0].message.content).toBe("Hello world");
    expect(response.usage).toBeDefined();
    expect(response.usage?.prompt_tokens).toBe(10);
    expect(response.usage?.completion_tokens).toBe(5);
    expect(response.usage?.total_tokens).toBe(15);
  });

  test("Anthropic should track usage in non-streaming responses", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        id: "msg_123",
        content: [{ text: "Hello world" }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 2,
        },
      }),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const api = new AnthropicApi({ apiKey: "test", provider: "anthropic" });

    const response = await api.chatCompletionNonStream(
      {
        model: "claude-3",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      },
      new AbortController().signal
    );

    expect(response.choices[0].message.content).toBe("Hello world");
    expect(response.usage).toBeDefined();
    expect(response.usage?.prompt_tokens).toBe(10);
    expect(response.usage?.completion_tokens).toBe(5);
    expect(response.usage?.total_tokens).toBe(15);
    expect(response.usage?.prompt_tokens_details?.cached_tokens).toBe(2);
  });

  test("Gemini should track usage in non-streaming responses", async () => {
    // Gemini non-streaming uses the streaming method internally
    const mockResponseData = [
      {
        candidates: [
          {
            content: {
              parts: [{ text: "Hello world" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      },
    ];

    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify(mockResponseData))
          );
          controller.close();
        },
      }),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const api = new GeminiApi({ apiKey: "test", provider: "gemini" });

    const response = await api.chatCompletionNonStream(
      {
        model: "gemini-1.5-flash",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      },
      new AbortController().signal
    );

    expect(response.choices[0].message.content).toBe("Hello world");
    expect(response.usage).toBeDefined();
    expect(response.usage?.prompt_tokens).toBe(10);
    expect(response.usage?.completion_tokens).toBe(5);
    expect(response.usage?.total_tokens).toBe(15);
  });
});