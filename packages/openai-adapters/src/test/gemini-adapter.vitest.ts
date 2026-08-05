import { afterEach, describe, expect, it, vi } from "vitest";

import type { GeminiApi as GeminiApiType } from "../apis/Gemini.js";

const generateContentStream = vi.fn();
const embedContent = vi.fn();
const GoogleGenAIMock = vi.fn().mockImplementation(() => ({
  models: {
    generateContentStream,
    embedContent,
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: GoogleGenAIMock,
}));

describe("GeminiApi GoogleGenAI construction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes custom headers, timeout, and apiBase through httpOptions", async () => {
    const { GeminiApi } = await import("../apis/Gemini.js");

    new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
      apiBase:
        "https://gateway.example.com/v1/streaming-models/locations/europe-west4/publishers/google",
      requestOptions: {
        timeout: 10000,
        headers: {
          "x-api-key": "gateway-api-key",
          "Content-Type": "application/json",
        },
      },
    });

    expect(GoogleGenAIMock).toHaveBeenCalledWith({
      apiKey: "primary-api-key",
      httpOptions: {
        baseUrl:
          "https://gateway.example.com/v1/streaming-models/locations/europe-west4/publishers/google",
        apiVersion: "",
        timeout: 10000,
        headers: {
          "x-api-key": "gateway-api-key",
          "Content-Type": "application/json",
        },
      },
    });
  });

  it("sets baseUrl with blank apiVersion for a custom apiBase alone", async () => {
    const { GeminiApi } = await import("../apis/Gemini.js");

    new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
      apiBase: "https://gateway.example.com/v1beta/",
    });

    expect(GoogleGenAIMock).toHaveBeenCalledWith({
      apiKey: "primary-api-key",
      httpOptions: {
        baseUrl: "https://gateway.example.com/v1beta/",
        apiVersion: "",
      },
    });
  });

  it("passes headers without apiBase when only requestOptions.headers is set", async () => {
    const { GeminiApi } = await import("../apis/Gemini.js");

    new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
      requestOptions: {
        headers: { "x-custom": "value" },
      },
    });

    expect(GoogleGenAIMock).toHaveBeenCalledWith({
      apiKey: "primary-api-key",
      httpOptions: {
        headers: { "x-custom": "value" },
      },
    });
  });

  it("omits httpOptions entirely for a default config — construction unchanged", async () => {
    const { GeminiApi } = await import("../apis/Gemini.js");

    new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
    });

    expect(GoogleGenAIMock).toHaveBeenCalledWith({
      apiKey: "primary-api-key",
      httpOptions: undefined,
    });
  });
});

describe("GeminiApi error normalization", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Real shape from upstream issue #12945 (and reproduced live in this
   * session): the SDK's ApiError.message is a JSON envelope whose
   * error.message is ITSELF a pretty-printed JSON string from Google.
   */
  function quotaApiErrorMessage(): string {
    const googleBody = JSON.stringify(
      {
        error: {
          code: 429,
          message:
            "You exceeded your current quota, please check your plan and billing details. Please retry in 45.191226092s.",
          status: "RESOURCE_EXHAUSTED",
        },
      },
      null,
      2,
    );
    return JSON.stringify({
      error: {
        message: `${googleBody}\n`,
        code: 429,
        status: "Too Many Requests",
      },
    });
  }

  class FakeApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  async function drainStreamError(api: GeminiApiType): Promise<unknown> {
    try {
      for await (const _chunk of api.chatCompletionStream(
        {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: "hi" }],
          stream: true,
        },
        new AbortController().signal,
      )) {
        // drain
      }
      return undefined;
    } catch (error) {
      return error;
    }
  }

  it("rethrows SDK errors with nested message and status extracted", async () => {
    generateContentStream.mockRejectedValue(
      new FakeApiError(quotaApiErrorMessage(), 429),
    );
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    const thrown = (await drainStreamError(api)) as Error & {
      status?: number;
    };

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toContain("You exceeded your current quota");
    expect(thrown.message.startsWith('{"error"')).toBe(false);
    expect(thrown.status).toBe(429);
  });

  it("normalizes errors on the non-stream path too (delegation)", async () => {
    generateContentStream.mockRejectedValue(
      new FakeApiError(quotaApiErrorMessage(), 429),
    );
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    let thrown: (Error & { status?: number }) | undefined;
    try {
      await api.chatCompletionNonStream(
        {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: "hi" }],
        },
        new AbortController().signal,
      );
    } catch (error) {
      thrown = error as Error & { status?: number };
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown!.message).toContain("You exceeded your current quota");
    // Raw JSON also contains the quota text — pin that the envelope is GONE
    expect(thrown!.message.startsWith('{"error"')).toBe(false);
    expect(thrown!.status).toBe(429);
  });

  it("passes through a plain non-JSON error unchanged", async () => {
    const original = new Error("socket hang up");
    generateContentStream.mockRejectedValue(original);
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    const thrown = await drainStreamError(api);
    expect(thrown).toBe(original);
  });

  it("passes through malformed JSON messages unchanged", async () => {
    const original = new Error("{invalid json");
    generateContentStream.mockRejectedValue(original);
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    const thrown = await drainStreamError(api);
    expect(thrown).toBe(original);
  });

  it("passes through JSON errors that carry no nested message unchanged", async () => {
    const original = new Error(
      JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }),
    );
    generateContentStream.mockRejectedValue(original);
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    const thrown = await drainStreamError(api);
    expect(thrown).toBe(original);
  });

  it("passes through JSON errors whose error field is a primitive unchanged", async () => {
    const original = new Error(JSON.stringify({ error: "Invalid API key" }));
    generateContentStream.mockRejectedValue(original);
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    const thrown = await drainStreamError(api);
    expect(thrown).toBe(original);
  });

  it("prefers the SDK error's own HTTP status over the nested code when they differ", async () => {
    generateContentStream.mockRejectedValue(
      new FakeApiError(quotaApiErrorMessage(), 500),
    );
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    const thrown = (await drainStreamError(api)) as Error & { status?: number };
    expect(thrown.status).toBe(500);
  });

  it("falls back to the nested code when the SDK error carries no status", async () => {
    generateContentStream.mockRejectedValue(new Error(quotaApiErrorMessage()));
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    const thrown = (await drainStreamError(api)) as Error & { status?: number };
    expect(thrown.message).toContain("You exceeded your current quota");
    expect(thrown.status).toBe(429);
  });

  it("normalizes errors on streamWithGenAI (the Vertex AI entry point) too", async () => {
    const failingStream = vi
      .fn()
      .mockRejectedValue(new FakeApiError(quotaApiErrorMessage(), 429));
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    let thrown: (Error & { status?: number }) | undefined;
    try {
      for await (const _chunk of api.streamWithGenAI(
        {
          models: { generateContentStream: failingStream },
        } as unknown as Parameters<typeof api.streamWithGenAI>[0],
        {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: "hi" }],
          stream: true,
        },
      )) {
        // drain
      }
    } catch (error) {
      thrown = error as Error & { status?: number };
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown!.message).toContain("You exceeded your current quota");
    expect(thrown!.message.startsWith('{"error"')).toBe(false);
    expect(thrown!.status).toBe(429);
  });
});

describe("extractNestedGeminiError (direct vectors)", () => {
  it("extracts message and code from the double-nested #12945 shape", async () => {
    const { extractNestedGeminiError } = await import("../apis/Gemini.js");
    const googleBody = JSON.stringify(
      {
        error: {
          code: 429,
          message: "You exceeded your current quota.",
          status: "RESOURCE_EXHAUSTED",
        },
      },
      null,
      2,
    );
    const raw = JSON.stringify({
      error: {
        message: `${googleBody}\n`,
        code: 429,
        status: "Too Many Requests",
      },
    });

    expect(extractNestedGeminiError(raw)).toEqual({
      message: "You exceeded your current quota.",
      code: 429,
    });
  });

  it("extracts a single-level nested message", async () => {
    const { extractNestedGeminiError } = await import("../apis/Gemini.js");
    expect(
      extractNestedGeminiError(
        JSON.stringify({ error: { message: "Quota exceeded", code: 429 } }),
      ),
    ).toEqual({ message: "Quota exceeded", code: 429 });
  });

  it("returns undefined for message-less JSON", async () => {
    const { extractNestedGeminiError } = await import("../apis/Gemini.js");
    expect(
      extractNestedGeminiError(
        JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }),
      ),
    ).toBeUndefined();
  });

  it("returns undefined for a primitive error field", async () => {
    const { extractNestedGeminiError } = await import("../apis/Gemini.js");
    expect(
      extractNestedGeminiError(JSON.stringify({ error: "Invalid API key" })),
    ).toBeUndefined();
  });

  it("returns undefined for malformed JSON", async () => {
    const { extractNestedGeminiError } = await import("../apis/Gemini.js");
    expect(extractNestedGeminiError("{invalid json")).toBeUndefined();
  });

  it("returns undefined for plain non-JSON text", async () => {
    const { extractNestedGeminiError } = await import("../apis/Gemini.js");
    expect(extractNestedGeminiError("socket hang up")).toBeUndefined();
  });
});

describe("GeminiApi usage accounting", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("includes thinking tokens in completion_tokens per the OpenAI convention", async () => {
    // Thinking models report thoughtsTokenCount separately; OpenAI-compatible
    // usage counts reasoning inside completion_tokens, keeping the identity
    // total_tokens === prompt_tokens + completion_tokens intact.
    generateContentStream.mockResolvedValue(
      (async function* () {
        yield {
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            thoughtsTokenCount: 20,
            totalTokenCount: 35,
          },
          candidates: [
            {
              content: { role: "model", parts: [{ text: "hi" }] },
              finishReason: "STOP",
            },
          ],
        };
      })(),
    );

    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({ provider: "gemini", apiKey: "k" });

    let usage:
      | {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        }
      | undefined;
    for await (const chunk of api.chatCompletionStream(
      {
        model: "gemini-flash-latest",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      new AbortController().signal,
    )) {
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    expect(usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 25,
      total_tokens: 35,
    });
    expect(usage!.total_tokens).toBe(
      usage!.prompt_tokens + usage!.completion_tokens,
    );
  });
});

describe("GeminiApi embed (SDK-native)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls SDK embedContent and maps embeddings to OpenAI format", async () => {
    // Google's REAL response shape, live-verified 2026-07-28:
    // { embeddings: [{ values: [...] }] } — no batchEmbedContents, no usage.
    embedContent.mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }],
    });

    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
    });

    const result = await api.embed({
      model: "gemini-embedding-001",
      input: ["hello", "world"],
    });

    expect(embedContent).toHaveBeenCalledWith({
      model: "gemini-embedding-001",
      contents: ["hello", "world"],
    });
    expect(result.data).toEqual([
      { index: 0, embedding: [0.1, 0.2], object: "embedding" },
      { index: 1, embedding: [0.3, 0.4], object: "embedding" },
    ]);
    // Google reports no token counts for embeddings — shared helper default
    expect(result.usage).toEqual({ prompt_tokens: 0, total_tokens: 0 });
  });

  it("wraps a single string input into a one-element contents array", async () => {
    embedContent.mockResolvedValue({ embeddings: [{ values: [0.5] }] });
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
    });

    await api.embed({ model: "gemini-embedding-001", input: "hi" });

    expect(embedContent).toHaveBeenCalledWith({
      model: "gemini-embedding-001",
      contents: ["hi"],
    });
  });

  it("normalizes SDK errors through the shared nested-message extraction", async () => {
    const googleBody = JSON.stringify(
      {
        error: {
          code: 429,
          message: "You exceeded your current quota.",
          status: "RESOURCE_EXHAUSTED",
        },
      },
      null,
      2,
    );
    class FakeApiError extends Error {
      status = 429;
    }
    embedContent.mockRejectedValue(
      new FakeApiError(
        JSON.stringify({
          error: {
            message: `${googleBody}\n`,
            code: 429,
            status: "Too Many Requests",
          },
        }),
      ),
    );

    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
    });

    let thrown: (Error & { status?: number }) | undefined;
    try {
      await api.embed({ model: "gemini-embedding-001", input: "hi" });
    } catch (error) {
      thrown = error as Error & { status?: number };
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown!.message).toContain("You exceeded your current quota");
    expect(thrown!.message.startsWith('{"error"')).toBe(false);
    expect(thrown!.status).toBe(429);
  });

  it("throws when the SDK returns no embeddings", async () => {
    embedContent.mockResolvedValue({ embeddings: undefined });
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
    });

    await expect(
      api.embed({ model: "gemini-embedding-001", input: "hi" }),
    ).rejects.toThrow(/no embeddings/i);
  });

  it("throws naming the index when an embedding entry has no values", async () => {
    embedContent.mockResolvedValue({
      embeddings: [{ values: [0.1] }, {}],
    });
    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
    });

    await expect(
      api.embed({ model: "gemini-embedding-001", input: ["a", "b"] }),
    ).rejects.toThrow(/no values for embedding at index 1/i);
  });
});
