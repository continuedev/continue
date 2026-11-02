import { describe, expect, test, vi } from "vitest";
import { OpenAIApi } from "../apis/OpenAI.js";
import { constructLlmApi } from "../index.js";
import type { LLMConfig } from "../types.js";

describe("Cheaper Inference adapter", () => {
  test.each([
    [undefined, "https://api.cheaperinference.com/v1/chat/completions"],
    [
      "https://gateway.example/v1/",
      "https://gateway.example/v1/chat/completions",
    ],
  ])("routes chat requests through %s", async (apiBase, expectedUrl) => {
    const config: LLMConfig = {
      provider: "cheaper-inference",
      apiKey: "test-api-key",
      apiBase,
    };
    const api = constructLlmApi(config);
    expect(api).toBeInstanceOf(OpenAIApi);
    if (!(api instanceof OpenAIApi)) {
      throw new Error("Expected an OpenAI-compatible adapter");
    }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "test-completion",
          object: "chat.completion",
          created: 0,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: "Hello" },
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );

    api.openai = api.openai.withOptions({ fetch });

    const result = await api.chatCompletionNonStream(
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      },
      new AbortController().signal,
    );

    expect(result.choices[0].message.content).toBe("Hello");
    const [url, options] = fetch.mock.calls[0];
    expect(url.toString()).toBe(expectedUrl);
    expect(new Headers(options?.headers).get("authorization")).toBe(
      "Bearer test-api-key",
    );
    expect(JSON.parse(options?.body as string)).toMatchObject({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
      stream: false,
    });
  });
});
