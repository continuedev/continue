import { afterEach, describe, expect, it, vi } from "vitest";
import VercelAIGateway from "./VercelAIGateway";
import { llmFromProviderAndOptions } from "./index";
import { llmsFromModelConfig } from "../../config/yaml/models";
import { setupLocalConfig, setupProviderConfig } from "../../config/onboarding";
import { fetchModels } from "../fetchModels";
import { modelSupportsNativeTools } from "../toolSupport";

const options = { apiKey: "test-key", model: "anthropic/claude-sonnet-4.6" };
afterEach(() => vi.unstubAllEnvs());

describe("Gateway-only model configuration", () => {
  it("rejects direct providers, local inference, and custom endpoints", async () => {
    for (const provider of [
      "openai",
      "anthropic",
      "ollama",
      "transformers.js",
      "ai-sdk",
    ]) {
      expect(() => llmFromProviderAndOptions(provider, options)).toThrow(
        "exclusively",
      );
      await expect(fetchModels(provider, "test-key")).rejects.toThrow(
        "exclusively",
      );
      await expect(
        llmsFromModelConfig({
          model: { provider, name: "test", ...options },
          config: {} as any,
          uniqueId: "test",
          llmLogger: {} as any,
        }),
      ).rejects.toThrow("exclusively");
    }
    expect(
      () =>
        new VercelAIGateway({
          ...options,
          apiBase: "https://api.openai.com/v1/",
        }),
    ).toThrow("exclusively");
  });

  it("requires a Gateway key and namespaced model; supports an environment key", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    expect(() => new VercelAIGateway({ model: options.model })).toThrow(
      "API key",
    );
    expect(
      () => new VercelAIGateway({ ...options, model: "claude-sonnet-4-6" }),
    ).toThrow("publisher/model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "env-key");
    const llm = new VercelAIGateway({ model: options.model });
    expect(llm.apiKey).toBe("env-key");
    expect(llm.apiBase).toBe("https://ai-gateway.vercel.sh/v1/");
    expect(llm.supportsFim()).toBe(true);
    expect(llm.templateMessages).toBeUndefined();
  });

  it("loads Gateway YAML models for every model role", async () => {
    for (const role of [
      "chat",
      "edit",
      "apply",
      "summarize",
      "subagent",
      "autocomplete",
      "embed",
      "rerank",
    ] as const) {
      const llms = await llmsFromModelConfig({
        model: {
          name: "Gateway",
          provider: "vercel-ai-gateway",
          ...options,
          roles: [role],
        },
        uniqueId: "test",
        config: {} as any,
        llmLogger: undefined as any,
      });
      expect(llms).toHaveLength(1);
      expect(llms[0].providerName).toBe("vercel-ai-gateway");
    }
  });

  it("onboarding replaces old providers and provisions only Gateway roles", () => {
    const config = {
      name: "test",
      version: "1",
      models: [{ name: "old", provider: "openai", model: "gpt-4" }],
    };
    const next = setupProviderConfig(config, "vercel-ai-gateway", "test-key");
    expect(next.models).toHaveLength(3);
    expect(
      next.models?.every(
        (m) => m && "provider" in m && m.provider === "vercel-ai-gateway",
      ),
    ).toBe(true);
    expect(
      setupProviderConfig(next, "vercel-ai-gateway", "new-key").models,
    ).toHaveLength(3);
    expect(() => setupLocalConfig(config)).toThrow("disabled");
    expect(() => setupProviderConfig(config, "anthropic", "key")).toThrow(
      "Only",
    );
  });

  it("filters autodetected models by their configured role", async () => {
    const llm = new VercelAIGateway({ ...options, roles: ["embed"] });
    vi.spyOn(llm, "listGatewayModels").mockResolvedValue([
      { id: options.model, type: "language" },
      { id: "openai/text-embedding-3-small", type: "embedding" },
      { id: "cohere/rerank-v3.5", type: "reranking" },
    ]);
    expect(await llm.listModels()).toEqual(["openai/text-embedding-3-small"]);
  });

  it("recognizes tool support for namespaced model IDs", () => {
    expect(
      modelSupportsNativeTools({
        provider: "vercel-ai-gateway",
        model: options.model,
      } as any),
    ).toBe(true);
  });
});
