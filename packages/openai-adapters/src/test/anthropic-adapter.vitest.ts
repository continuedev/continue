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

describe("Anthropic Adapter Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test("should construct API correctly", async () => {
    const { constructLlmApi } = await import("../index.js");
    const api = constructLlmApi({
      provider: "anthropic",
      apiKey: "test-api-key",
    });
    expect(api).toBeDefined();
  });

  test("chatCompletionNonStream should send a valid request", async () => {
    await runAdapterTest({
      config: {
        provider: "anthropic",
        apiKey: "test-api-key",
        apiBase: "https://api.anthropic.com/v1/",
      },
      methodToTest: "chatCompletionNonStream",
      params: [
        {
          model: "claude-sonnet-4-5",
          messages: [{ role: "user", content: "hello" }],
        },
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
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "hello",
                },
              ],
            },
          ],
          system: undefined,
          model: "claude-sonnet-4-5",
          max_tokens: 32000,
          stream: undefined,
        },
      },
      mockResponse: {
        id: "msg_test",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Hello! How can I help you today?",
          },
        ],
        model: "claude-sonnet-4-5",
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 15,
        },
      },
    });
  });

  test("chatCompletionStream should send a valid request", async () => {
    await runAdapterTest({
      config: {
        provider: "anthropic",
        apiKey: "test-api-key",
        apiBase: "https://api.anthropic.com/v1/",
      },
      methodToTest: "chatCompletionStream",
      params: [
        {
          model: "claude-sonnet-4-5",
          messages: [{ role: "user", content: "hello" }],
          stream: true,
        },
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
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "hello",
                },
              ],
            },
          ],
          system: undefined,
          model: "claude-sonnet-4-5",
          max_tokens: 32000,
          stream: true,
        },
      },
      mockStream: [
        {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text: "Hello",
          },
        },
        {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text: " world",
          },
        },
      ],
    });
  });

  test("chatCompletionStream with system message should convert correctly", async () => {
    await runAdapterTest({
      config: {
        provider: "anthropic",
        apiKey: "test-api-key",
        apiBase: "https://api.anthropic.com/v1/",
      },
      methodToTest: "chatCompletionStream",
      params: [
        {
          model: "claude-sonnet-4-5",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "hello" },
          ],
          stream: true,
        },
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
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "hello",
                },
              ],
            },
          ],
          system: [
            {
              type: "text",
              text: "You are a helpful assistant.",
              cache_control: { type: "ephemeral" },
            },
          ],
          model: "claude-sonnet-4-5",
          max_tokens: 32000,
          stream: true,
        },
      },
      mockStream: [
        {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text: "Hello",
          },
        },
      ],
    });
  });

  test("embed should throw not implemented error", async () => {
    const { constructLlmApi } = await import("../index.js");
    const api = constructLlmApi({
      provider: "anthropic",
      apiKey: "test-api-key",
    });

    await expect(
      api!.embed({
        model: "text-embedding-ada-002",
        input: ["Hello", "World"],
      }),
    ).rejects.toThrow("Method not implemented.");
  });
});
