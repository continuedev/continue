import { describe, expect, test, vi } from "vitest";
import CheaperInference from "./CheaperInference.js";
import { createOpenAISubclassTests } from "./test-utils/openai-test-utils.js";

createOpenAISubclassTests(CheaperInference, {
  providerName: "cheaper-inference",
  defaultApiBase: "https://api.cheaperinference.com/v1/",
});

describe("Cheaper Inference model discovery", () => {
  test("lists chat models from the authenticated catalog", async () => {
    const provider = new CheaperInference({
      apiKey: "test-api-key",
      model: "gpt-4o",
      apiBase: "https://gateway.example/v1/",
    });
    const fetch = vi.spyOn(provider, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "gpt-4o",
              supported_endpoints: ["/v1/chat/completions", "/v1/responses"],
            },
            {
              id: "responses-only-model",
              supported_endpoints: ["/v1/responses"],
            },
            {
              id: "text-embedding-3-small",
              supported_endpoints: ["/v1/embeddings"],
            },
          ],
        }),
      ),
    );

    expect(await provider.listModels()).toEqual(["gpt-4o"]);
    const [url, options] = fetch.mock.calls[0];
    expect(url.toString()).toBe("https://gateway.example/v1/models?type=text");
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer test-api-key",
    });
  });
});
