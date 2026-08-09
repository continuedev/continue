import { ModelConfig } from "@continuedev/config-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContinueConfig, ILLMLogger } from "../..";
import { llmsFromModelConfig } from "./models";

// Mock the LLM classes
vi.mock("../../llm/llms", () => ({
  LLMClasses: [
    class MockOpenAI {
      static providerName = "openai";
      static defaultOptions = {
        completionOptions: {
          maxTokens: 2048,
        },
      };

      constructor(options: any) {
        Object.assign(this, options);
      }

      async listModels() {
        return ["gpt-4", "gpt-3.5-turbo"];
      }
    },
    class MockAnthropic {
      static providerName = "anthropic";
      static defaultOptions = {
        completionOptions: {
          maxTokens: 4096,
        },
      };

      constructor(options: any) {
        Object.assign(this, options);
      }

      async listModels() {
        return ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"];
      }
    },
  ],
}));

describe("llmsFromModelConfig requestOptions merging", () => {
  let mockLLMLogger: ILLMLogger;
  let mockConfig: ContinueConfig;

  beforeEach(() => {
    mockLLMLogger = { log: vi.fn() } as any;
    mockConfig = {
      requestOptions: {
        timeout: 30000,
        headers: {
          "user-agent": "Continue/1.0.0",
        },
        proxy: "global-proxy",
      },
      contextProviders: [],
      mcpServerStatuses: [],
      rules: [],
      selectedModelByRole: {
        apply: null,
        autocomplete: null,
        chat: null,
        edit: null,
        embed: null,
        rerank: null,
        summarize: null,
        subagent: null,
      },
      modelsByRole: {
        apply: [],
        autocomplete: [],
        chat: [],
        edit: [],
        embed: [],
        rerank: [],
        summarize: [],
        subagent: [],
      },
      slashCommands: [],
      tools: [],
      allowAnonymousTelemetry: false,
    } as ContinueConfig;
    vi.clearAllMocks();
  });

  it("should merge model requestOptions with config requestOptions", async () => {
    const model: ModelConfig = {
      name: "test-openai",
      provider: "openai",
      model: "gpt-4",
      requestOptions: {
        timeout: 60000,
        headers: {
          Authorization: "Bearer token123",
        },
        proxy: "model-proxy",
      },
    };

    const result = await llmsFromModelConfig({
      model,
      uniqueId: "test-id",
      llmLogger: mockLLMLogger,
      config: mockConfig,
    });

    expect(result).toHaveLength(1);
    const llm = result[0];

    // The LLM should have merged requestOptions
    expect(llm.requestOptions).toEqual({
      timeout: 60000, // model-specific takes precedence
      headers: {
        "user-agent": "Continue/1.0.0", // from global request options
        Authorization: "Bearer token123", // from model
      },
      proxy: "model-proxy", // model-specific takes precedence
    });
  });

  it("should use config requestOptions when model has no requestOptions", async () => {
    const model: ModelConfig = {
      name: "test-openai",
      provider: "openai",
      model: "gpt-4",
      // no requestOptions
    };

    const result = await llmsFromModelConfig({
      model,
      uniqueId: "test-id",
      llmLogger: mockLLMLogger,
      config: mockConfig,
    });

    expect(result).toHaveLength(1);
    const llm = result[0];

    // The LLM should have config requestOptions
    expect(llm.requestOptions).toEqual(mockConfig.requestOptions);
  });

  it("should use model requestOptions when config has no requestOptions", async () => {
    const model: ModelConfig = {
      name: "test-openai",
      provider: "openai",
      model: "gpt-4",
      requestOptions: {
        timeout: 45000,
        headers: {
          "API-Key": "secret",
        },
      },
    };

    const configWithoutOptions = { ...mockConfig };
    delete configWithoutOptions.requestOptions;

    const result = await llmsFromModelConfig({
      model,
      uniqueId: "test-id",
      llmLogger: mockLLMLogger,
      config: configWithoutOptions,
    });

    expect(result).toHaveLength(1);
    const llm = result[0];

    // The LLM should have model requestOptions
    expect(llm.requestOptions).toEqual(model.requestOptions);
  });

  it("should handle empty headers correctly in merge", async () => {
    const model: ModelConfig = {
      name: "test-openai",
      provider: "openai",
      model: "gpt-4",
      requestOptions: {
        timeout: 60000,
        headers: {},
      },
    };

    const configWithEmptyHeaders = {
      ...mockConfig,
      requestOptions: {
        ...mockConfig.requestOptions!,
        headers: {},
      },
    };

    const result = await llmsFromModelConfig({
      model,
      uniqueId: "test-id",
      llmLogger: mockLLMLogger,
      config: configWithEmptyHeaders,
    });

    expect(result).toHaveLength(1);
    const llm = result[0];

    // When headers merge to empty object, they should be undefined
    expect(llm.requestOptions).toEqual({
      timeout: 60000,
      proxy: "global-proxy",
      headers: undefined,
    });
  });

  it("should handle autodetect models with merged requestOptions", async () => {
    const model: ModelConfig = {
      name: "autodetect-openai",
      provider: "openai",
      model: "AUTODETECT",
      requestOptions: {
        timeout: 120000,
        headers: {
          "X-Custom": "autodetect",
        },
      },
    };

    const result = await llmsFromModelConfig({
      model,
      uniqueId: "test-id",
      llmLogger: mockLLMLogger,
      config: mockConfig,
    });

    // Should return multiple models from listModels()
    expect(result.length).toBeGreaterThan(0);

    // Each detected model should have the merged requestOptions
    result.forEach((llm) => {
      expect(llm.requestOptions).toEqual({
        timeout: 120000, // model-specific takes precedence
        headers: {
          "user-agent": "Continue/1.0.0", // from global request options
          "X-Custom": "autodetect", // from model
        },
        proxy: "global-proxy", // from global request options
      });
    });
  });

  it("should handle unknown provider gracefully", async () => {
    const model: ModelConfig = {
      name: "unknown-provider",
      provider: "unknown",
      model: "unknown-model",
      requestOptions: {
        timeout: 60000,
      },
    };

    const result = await llmsFromModelConfig({
      model,
      uniqueId: "test-id",
      llmLogger: mockLLMLogger,
      config: mockConfig,
    });

    // Should return empty array for unknown provider
    expect(result).toHaveLength(0);
  });

  it("should preserve other model properties while merging requestOptions", async () => {
    const model: ModelConfig = {
      name: "test-anthropic",
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      roles: ["chat", "summarize"],
      capabilities: ["tool_use", "image_input"],
      defaultCompletionOptions: {
        temperature: 0.7,
        maxTokens: 1000,
      },
      requestOptions: {
        timeout: 90000,
      },
    };

    const result = await llmsFromModelConfig({
      model,
      uniqueId: "test-id",
      llmLogger: mockLLMLogger,
      config: mockConfig,
    });

    expect(result).toHaveLength(1);
    const llm = result[0];

    // Should preserve model properties
    expect(llm.title).toBe("test-anthropic");
    expect(llm.completionOptions?.temperature).toBe(0.7);
    expect(llm.completionOptions?.maxTokens).toBe(1000);
    expect(llm.capabilities?.tools).toBe(true);
    expect(llm.capabilities?.uploadImage).toBe(true);

    // Should have merged requestOptions
    expect(llm.requestOptions).toEqual({
      timeout: 90000,
      headers: {
        "user-agent": "Continue/1.0.0",
      },
      proxy: "global-proxy",
    });
  });

  it("should handle complex header merging scenarios", async () => {
    const model: ModelConfig = {
      name: "complex-headers",
      provider: "openai",
      model: "gpt-4",
      requestOptions: {
        headers: {
          Authorization: "Bearer model-token",
          Accept: "application/json", // Should override config Accept
          "X-Model-Specific": "true",
        },
      },
    };

    const configWithMoreHeaders = {
      ...mockConfig,
      requestOptions: {
        ...mockConfig.requestOptions!,
        headers: {
          ...mockConfig.requestOptions!.headers,
          Accept: "text/plain", // Should be overridden by model
          "Cache-Control": "no-cache",
        },
      },
    };

    const result = await llmsFromModelConfig({
      model,
      uniqueId: "test-id",
      llmLogger: mockLLMLogger,
      config: configWithMoreHeaders,
    });

    expect(result).toHaveLength(1);
    const llm = result[0];

    expect(llm.requestOptions?.headers).toEqual({
      "user-agent": "Continue/1.0.0", // from global request options
      "Cache-Control": "no-cache", // from global request options
      Authorization: "Bearer model-token", // from model
      Accept: "application/json", // from model (overrides config)
      "X-Model-Specific": "true", // from model
    });
  });
});
