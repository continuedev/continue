import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchModels } from "./fetchModels";

describe("fetchModels gemini", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubGeminiListResponse() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: "models/gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            inputTokenLimit: 1048576,
            outputTokenLimit: 65536,
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("sends the API key as an x-goog-api-key header, never in the URL", async () => {
    const fetchMock = stubGeminiListResponse();

    const models = await fetchModels("gemini", "test-api-key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url.toString());
    expect(parsed.searchParams.get("key")).toBeNull();
    expect(parsed.search).toBe("");
    expect(init.headers["x-goog-api-key"]).toBe("test-api-key");
    expect(parsed.toString()).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models",
    );

    expect(models).toEqual([
      {
        name: "Gemini 2.5 Pro",
        modelId: "gemini-2.5-pro",
        icon: "gemini.png",
        contextLength: 1048576,
        maxTokens: 65536,
        supportsTools: true,
      },
    ]);
  });

  it("sends an empty x-goog-api-key header when no key is configured", async () => {
    const fetchMock = stubGeminiListResponse();

    await fetchModels("gemini", undefined);

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url.toString()).search).toBe("");
    expect(init.headers["x-goog-api-key"]).toBe("");
  });

  it("honors a custom apiBase without leaking the key", async () => {
    const fetchMock = stubGeminiListResponse();

    await fetchModels(
      "gemini",
      "test-api-key",
      "https://gateway.example.com/v1beta/",
    );

    const [url] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://gateway.example.com/v1beta/models");
  });
});
