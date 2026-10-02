import { fetchwithRequestOptions } from "@continuedev/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchModels } from "./fetchModels.js";
import { llmFromProviderAndOptions } from "./llms/index.js";

vi.mock("@continuedev/fetch", () => ({ fetchwithRequestOptions: vi.fn() }));
vi.mock("./llms/index.js", () => ({
  LLMClasses: [],
  llmFromProviderAndOptions: vi.fn(),
}));

const requestOptions = {
  proxy: "http://proxy.example.com:8080",
  verifySsl: false,
  headers: { "x-custom-header": "test-value" },
};

describe("fetchModels request options", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    [
      "ollama",
      '<a x-test-model class="model" href="/library/llama3">Llama</a>',
      "llama3",
    ],
    [
      "openrouter",
      JSON.stringify({ data: [{ id: "test/model", name: "Test model" }] }),
      "Test model",
    ],
    [
      "anthropic",
      JSON.stringify({
        data: [{ id: "claude-test", display_name: "Claude test" }],
      }),
      "Claude test",
    ],
    [
      "gemini",
      JSON.stringify({
        models: [
          {
            name: "models/gemini-test",
            displayName: "Gemini test",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }),
      "Gemini test",
    ],
  ])(
    "loads %s models with configured request options",
    async (provider, body, name) => {
      vi.mocked(fetchwithRequestOptions).mockResolvedValue(
        new Response(body) as any,
      );

      const models = await fetchModels(
        provider,
        "test-key",
        undefined,
        requestOptions,
      );

      expect(models).toHaveLength(1);
      expect(models[0].name).toBe(name);
      expect(fetchwithRequestOptions).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fetchwithRequestOptions).mock.calls[0][2]).toEqual(
        requestOptions,
      );
    },
  );

  it("passes request options to providers using listModels", async () => {
    vi.mocked(llmFromProviderAndOptions).mockReturnValue({
      listModels: async () => ["gpt-test"],
    } as any);

    await expect(
      fetchModels("openai", "test-key", undefined, requestOptions),
    ).resolves.toEqual([{ name: "gpt-test" }]);
    expect(llmFromProviderAndOptions).toHaveBeenCalledWith(
      "openai",
      expect.objectContaining({ requestOptions }),
    );
  });
});
