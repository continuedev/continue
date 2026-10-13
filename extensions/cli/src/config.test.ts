import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { afterEach, describe, expect, test, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./auth/workos.js");

import type { AuthConfig } from "./auth/workos.js";
import { createLlmApi, getLlmApi } from "./config.js";
import {
  cleanupMockLLMServer,
  createMockLLMServer,
  type MockLLMServer,
} from "./test-helpers/mock-llm-server.js";

describe("config", () => {
  let mockAuthConfig: AuthConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthConfig = null;
  });

  describe("getLlmApi()", () => {
    test("should throw error when models array is empty", () => {
      const assistant: AssistantUnrolled = {
        name: "test-assistant",
        version: "1.0.0",
        models: [],
      };

      expect(() => getLlmApi(assistant, mockAuthConfig)).toThrow(
        "No models found in the configured assistant",
      );
    });

    test("should throw error when no chat models available", () => {
      const assistant: AssistantUnrolled = {
        name: "test-assistant",
        version: "1.0.0",
        models: [
          {
            provider: "openai",
            model: "text-embedding-ada-002",
            name: "Ada Embeddings",
            roles: ["embed"],
          } as ModelConfig,
        ],
      };

      expect(() => getLlmApi(assistant, mockAuthConfig)).toThrow(
        "No models with the chat role found in the configured assistant",
      );
    });
  });

  describe("createLlmApi()", () => {
    let mockServer: MockLLMServer;

    beforeEach(async () => {
      mockServer = await createMockLLMServer({ response: "ok" });
    });

    afterEach(async () => {
      await cleanupMockLLMServer(mockServer);
    });

    async function streamFrom(model: ModelConfig): Promise<string> {
      const llmApi = createLlmApi(model, mockAuthConfig);
      let content = "";
      for await (const chunk of llmApi!.chatCompletionStream(
        {
          model: model.model,
          messages: [{ role: "user", content: "hello" }],
          stream: true,
        },
        new AbortController().signal,
      )) {
        content += chunk.choices[0]?.delta.content ?? "";
      }
      return content;
    }

    const strictModel: ModelConfig = {
      name: "Strict endpoint",
      provider: "openai",
      model: "strict-endpoint",
      apiKey: "test-key",
      // Keep a developer's HTTP_PROXY away from the local mock server.
      requestOptions: { noProxy: ["127.0.0.1"] },
    };

    test("omits stream_options when the model sets streamOptions: false", async () => {
      const content = await streamFrom({
        ...strictModel,
        apiBase: mockServer.url,
        streamOptions: false,
      });

      expect(content).toBe("ok");
      expect(mockServer.requests).toHaveLength(1);
      expect(mockServer.requests[0].body).not.toHaveProperty("stream_options");
    });

    test("requests streaming usage when streamOptions is not set", async () => {
      const content = await streamFrom({
        ...strictModel,
        apiBase: mockServer.url,
      });

      expect(content).toBe("ok");
      expect(mockServer.requests[0].body).toHaveProperty("stream_options", {
        include_usage: true,
      });
    });
  });
});
