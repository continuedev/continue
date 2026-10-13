import { afterEach, describe, expect, test, vi } from "vitest";
import { AiSdkApi } from "../apis/AiSdk.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI SDK embeddings", () => {
  test.each([{ input: "hello" }, { input: ["hello", "world"] }])(
    "uses an embedding model for input $input",
    async ({ input }) => {
      const requests: { url: string; body: Record<string, unknown> }[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
          const body = JSON.parse(String(init?.body));
          requests.push({ url: String(url), body });
          return new Response(
            JSON.stringify({
              model: "text-embedding-3-small",
              data: body.input.map((_: string, index: number) => ({
                embedding: [index, 0.5],
                index,
              })),
              usage: { prompt_tokens: 2, total_tokens: 2 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }),
      );
      const api = new AiSdkApi({
        provider: "ai-sdk",
        model: "openai/text-embedding-3-small",
        apiKey: "test-key",
      });

      const result = await api.embed({
        model: "openai/text-embedding-3-small",
        input,
      });

      expect(requests).toEqual([
        {
          url: "https://api.openai.com/v1/embeddings",
          body: {
            model: "text-embedding-3-small",
            input: Array.isArray(input) ? input : [input],
            encoding_format: "float",
          },
        },
      ]);
      expect(result.model).toBe("text-embedding-3-small");
      expect(result.data).toEqual(
        (Array.isArray(input) ? input : [input]).map((_, index) => ({
          object: "embedding",
          embedding: [index, 0.5],
          index,
        })),
      );
      expect(result.usage).toEqual({ prompt_tokens: 2, total_tokens: 2 });
    },
  );
});
