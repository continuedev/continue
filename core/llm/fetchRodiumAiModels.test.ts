import {
  fetchRodiumAiModels,
  getRodiumAiModelIcon,
} from "./fetchRodiumAiModels.js";

describe("fetchRodiumAiModels", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("getRodiumAiModelIcon maps provider slugs and model ids", () => {
    expect(getRodiumAiModelIcon("anthropic/claude-fable-5", "anthropic")).toBe(
      "anthropic.png",
    );
    expect(getRodiumAiModelIcon("openai/gpt-5.4", "openai")).toBe("openai.png");
    expect(getRodiumAiModelIcon("custom/unknown-model")).toBe("rodium.svg");
  });

  test("maps RodiumAi model extensions into FetchedModel", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        object: "list",
        data: [
          {
            id: "anthropic/claude-fable-5",
            rodiumai_display_name: "Claude Fable 5",
            rodiumai_description: "Anthropic creative model",
            rodiumai_provider: { slug: "anthropic", name: "Anthropic" },
            rodiumai_capabilities: {
              context_window: 200000,
              max_output_tokens: 8192,
              supports_tools: true,
            },
          },
          {
            id: "openai/gpt-5.4",
            rodiumai_display_name: "GPT-5.4",
            rodiumai_provider: { slug: "openai", name: "OpenAI" },
            rodiumai_capabilities: {
              context_window: 1050000,
              max_output_tokens: 128000,
              supports_tools: true,
            },
          },
        ],
      }),
    }) as typeof fetch;

    const models = await fetchRodiumAiModels("rd_sk_prod_test");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://api.rodiumai.io/v1/models",
      }),
      expect.objectContaining({
        headers: { Authorization: "Bearer rd_sk_prod_test" },
      }),
    );

    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({
      name: "Claude Fable 5",
      modelId: "anthropic/claude-fable-5",
      description: "Anthropic creative model",
      icon: "anthropic.png",
      contextLength: 200000,
      maxTokens: 8192,
      supportsTools: true,
    });
    expect(models[1]).toMatchObject({
      name: "GPT-5.4",
      modelId: "openai/gpt-5.4",
      icon: "openai.png",
      contextLength: 1050000,
      maxTokens: 128000,
      supportsTools: true,
    });
  });

  test("returns an empty list when the RodiumAi API fails", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as typeof fetch;

    const models = await fetchRodiumAiModels("rd_sk_prod_test");

    expect(models).toEqual([]);
    expect(consoleError).toHaveBeenCalled();
  });
});
