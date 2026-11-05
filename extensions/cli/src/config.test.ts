import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { describe, expect, test, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./auth/workos.js");

import type { AuthConfig } from "./auth/workos.js";
import { getLlmApi } from "./config.js";

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
});

describe("createLlmApi() prompt caching settings", () => {
  const make = async (model: Partial<ModelConfig>) => {
    const constructLlmApi = vi.fn(() => ({}) as any);
    vi.resetModules();
    vi.doMock("@continuedev/openai-adapters", () => ({ constructLlmApi }));
    const { createLlmApi } = await import("./config.js");
    createLlmApi(
      { name: "m", model: "m", ...model } as ModelConfig,
      null as any,
    );
    vi.doUnmock("@continuedev/openai-adapters");
    return (constructLlmApi.mock.calls[0] as any[])[0];
  };

  test("passes promptCaching and cacheBehavior to the Bedrock adapter", async () => {
    const config = await make({
      provider: "bedrock",
      model: "us.anthropic.claude-sonnet-4-6",
      defaultCompletionOptions: { promptCaching: true },
      cacheBehavior: { cacheConversation: true },
    });
    expect(config.promptCaching).toBe(true);
    expect(config.cacheBehavior).toEqual({ cacheConversation: true });
  });

  test("leaves them undefined for a model that is not Claude", async () => {
    const config = await make({ provider: "bedrock", model: "x" });
    expect(config.promptCaching).toBeUndefined();
    expect(config.cacheBehavior).toBeUndefined();
  });

  test("turns caching on with Auto for a Claude model on Bedrock when the config says nothing", async () => {
    const config = await make({
      provider: "bedrock",
      model: "us.anthropic.claude-sonnet-4-6",
    });
    expect(config.promptCaching).toBe(true);
    expect(config.cacheBehavior).toEqual({ ttl: "auto" });
  });

  test("keeps a lifetime the config names when it applies the default", async () => {
    const config = await make({
      provider: "bedrock",
      model: "us.anthropic.claude-sonnet-4-6",
      cacheBehavior: { ttl: "1h" },
    });
    expect(config.promptCaching).toBe(true);
    expect(config.cacheBehavior).toEqual({ ttl: "1h" });
  });

  test.each([
    [
      "promptCaching: false",
      { defaultCompletionOptions: { promptCaching: false } },
    ],
    [
      "cacheConversation: false",
      { cacheBehavior: { cacheConversation: false } },
    ],
    [
      "cacheSystemMessage: false",
      { cacheBehavior: { cacheSystemMessage: false } },
    ],
  ])(
    "does not apply the default when the config says %s",
    async (_n, extra) => {
      const config = await make({
        provider: "bedrock",
        model: "us.anthropic.claude-sonnet-4-6",
        ...(extra as object),
      });
      expect(config.promptCaching).not.toBe(true);
      expect(config.cacheBehavior?.ttl).toBeUndefined();
    },
  );

  test("gives the Anthropic adapter Auto when the config says nothing about caching", async () => {
    const config = await make({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
    expect(config.cacheBehavior).toEqual({ ttl: "auto" });
    expect("promptCaching" in config).toBe(false);
  });

  test("gives the Anthropic adapter no lifetime when the config turns caching off", async () => {
    const config = await make({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      defaultCompletionOptions: { promptCaching: false },
    });
    expect("cacheBehavior" in config).toBe(false);
  });

  test("does not add them for other providers", async () => {
    const config = await make({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      defaultCompletionOptions: { promptCaching: true },
    });
    expect("promptCaching" in config).toBe(false);
    expect("cacheBehavior" in config).toBe(false);
  });

  test("gives the Anthropic adapter only the lifetime", async () => {
    const config = await make({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      defaultCompletionOptions: { promptCaching: true },
      cacheBehavior: { cacheConversation: true, ttl: "1h" },
    });
    expect(config.cacheBehavior).toEqual({ ttl: "1h" });
    expect("promptCaching" in config).toBe(false);
  });

  test("passes auto through to the adapter, which decides per request", async () => {
    const config = await make({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      cacheBehavior: { ttl: "auto" },
    });
    expect(config.cacheBehavior).toEqual({ ttl: "auto" });
  });

  test("passes the lifetime to the Bedrock adapter with the rest", async () => {
    const config = await make({
      provider: "bedrock",
      model: "us.anthropic.claude-sonnet-4-6",
      cacheBehavior: { cacheConversation: true, ttl: "1h" },
    });
    expect(config.cacheBehavior).toEqual({
      cacheConversation: true,
      ttl: "1h",
    });
  });
});
