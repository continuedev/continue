import { describe, expect, test, vi } from "vitest";
import { createAdapterTests, runAdapterTest } from "./adapter-test-utils.js";

// Mock the fetch package (not needed for OpenAI but required by the shared test utils)
vi.mock("@continuedev/fetch", async () => {
  const actual = await vi.importActual("@continuedev/fetch");
  return {
    ...actual,
    fetchwithRequestOptions: vi.fn(),
  };
});

describe("OpenAI Adapter Tests", () => {
  createAdapterTests({
    providerName: "openai",
    config: {
      provider: "openai",
      apiKey: "test-api-key",
      apiBase: "https://api.openai.com/v1/",
    },
    expectedApiBase: "https://api.openai.com/v1/",
    customHeaders: {
      authorization: "Bearer test-api-key",
      "content-type": "application/json",
      accept: "application/json",
    },
  });

  describe("o-series and gpt-5+ models strip stop parameter", () => {
    test("should strip stop parameter for o3 models on Azure-style apiBase", async () => {
      await runAdapterTest({
        config: {
          provider: "openai",
          apiKey: "test-api-key",
          apiBase:
            "https://custom-azure.openai.azure.com/openai/deployments/o3",
        },
        methodToTest: "chatCompletionNonStream",
        params: [
          {
            model: "o3",
            messages: [{ role: "user", content: "hello" }],
            stop: ["<|im_end|>"],
          },
          new AbortController().signal,
        ],
        expectedRequest: {
          url: "https://custom-azure.openai.azure.com/openai/deployments/o3/chat/completions",
          method: "POST",
          body: {
            model: "o3",
            messages: [{ role: "user", content: "hello" }],
            stop: undefined,
          },
        },
        mockResponse: {
          id: "test-id",
          object: "chat.completion",
          created: 1234567890,
          model: "o3",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello" },
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

    test("should strip stop parameter for gpt-5 models on Azure-style apiBase", async () => {
      await runAdapterTest({
        config: {
          provider: "openai",
          apiKey: "test-api-key",
          apiBase:
            "https://custom-azure.openai.azure.com/openai/deployments/gpt-5",
        },
        methodToTest: "chatCompletionNonStream",
        params: [
          {
            model: "gpt-5",
            messages: [{ role: "user", content: "hello" }],
            stop: ["<|im_end|>"],
          },
          new AbortController().signal,
        ],
        expectedRequest: {
          url: "https://custom-azure.openai.azure.com/openai/deployments/gpt-5/chat/completions",
          method: "POST",
          body: {
            model: "gpt-5",
            messages: [{ role: "user", content: "hello" }],
            stop: undefined,
          },
        },
        mockResponse: {
          id: "test-id",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-5",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello" },
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

    test("should keep stop parameter for gpt-4o models", async () => {
      await runAdapterTest({
        config: {
          provider: "openai",
          apiKey: "test-api-key",
          apiBase:
            "https://custom-azure.openai.azure.com/openai/deployments/gpt-4o",
        },
        methodToTest: "chatCompletionNonStream",
        params: [
          {
            model: "gpt-4o",
            messages: [{ role: "user", content: "hello" }],
            stop: ["<|im_end|>"],
          },
          new AbortController().signal,
        ],
        expectedRequest: {
          url: "https://custom-azure.openai.azure.com/openai/deployments/gpt-4o/chat/completions",
          method: "POST",
          body: {
            model: "gpt-4o",
            messages: [{ role: "user", content: "hello" }],
            stop: ["<|im_end|>"],
          },
        },
        mockResponse: {
          id: "test-id",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello" },
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

    test("should strip stop parameter for gpt-6 models (non-official API)", async () => {
      // For gpt-5+ on non-official API (Azure-style), only strip stop parameter.
      // Message role conversion and max_tokens->max_completion_tokens only happen on official API.
      await runAdapterTest({
        config: {
          provider: "openai",
          apiKey: "test-api-key",
          apiBase:
            "https://custom-azure.openai.azure.com/openai/deployments/gpt-6",
        },
        methodToTest: "chatCompletionNonStream",
        params: [
          {
            model: "gpt-6",
            messages: [{ role: "user", content: "hello" }],
            stop: ["<|im_end|>"],
            max_tokens: 2048,
          },
          new AbortController().signal,
        ],
        expectedRequest: {
          url: "https://custom-azure.openai.azure.com/openai/deployments/gpt-6/chat/completions",
          method: "POST",
          body: {
            model: "gpt-6",
            messages: [{ role: "user", content: "hello" }],
            stop: undefined,
            max_tokens: 2048,
          },
        },
        mockResponse: {
          id: "test-id",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-6",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello" },
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

    test("should not strip stop for models like openchat", async () => {
      await runAdapterTest({
        config: {
          provider: "openai",
          apiKey: "test-api-key",
          apiBase: "https://api.openai.com/v1/",
        },
        methodToTest: "chatCompletionNonStream",
        params: [
          {
            model: "openchat-3.5",
            messages: [{ role: "user", content: "hello" }],
            stop: ["<|im_end|>"],
          },
          new AbortController().signal,
        ],
        expectedRequest: {
          url: "https://api.openai.com/v1/chat/completions",
          method: "POST",
          body: {
            model: "openchat-3.5",
            messages: [{ role: "user", content: "hello" }],
            stop: ["<|im_end|>"],
          },
        },
        mockResponse: {
          id: "test-id",
          object: "chat.completion",
          created: 1234567890,
          model: "openchat-3.5",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello" },
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
  });
});
