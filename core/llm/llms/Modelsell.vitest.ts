import { describe, expect, test, vi } from "vitest";

import Modelsell from "./Modelsell.js";
import { LLMClasses } from "./index.js";

describe("Modelsell", () => {
  test("registers the provider with the Modelsell API base", () => {
    expect(Modelsell.providerName).toBe("modelsell");
    expect(Modelsell.defaultOptions).toMatchObject({
      apiBase: "https://modelsell.com/v1/",
      useLegacyCompletionsEndpoint: false,
    });
    expect(LLMClasses).toContain(Modelsell);
  });

  test("discovers model IDs from the Modelsell models endpoint", async () => {
    const modelsell = new Modelsell({
      apiKey: "test-api-key",
      model: "",
    });
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "provider/model-a" }, { id: "model-b" }],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    (modelsell as any).fetch = mockFetch;

    await expect(modelsell.listModels()).resolves.toEqual([
      "provider/model-a",
      "model-b",
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url.toString()).toBe("https://modelsell.com/v1/models");
    expect(options).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer test-api-key",
      },
    });
  });
});
