import { afterEach, describe, expect, test, vi } from "vitest";
import { AiSdkApi } from "../apis/AiSdk.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI SDK provider options", () => {
  const thinkingConfig = { thinkingBudget: 128, includeThoughts: true };

  test.each([
    { stream: false, configured: true },
    { stream: true, configured: true },
    { stream: false, configured: false },
    { stream: true, configured: false },
  ])(
    "forwards configured=$configured options for stream=$stream",
    async ({ stream, configured }) => {
      const requests: Record<string, any>[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
          requests.push(JSON.parse(String(init?.body)));
          const response = {
            candidates: [
              {
                content: { role: "model", parts: [{ text: "ok" }] },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 1,
              candidatesTokenCount: 1,
              totalTokenCount: 2,
            },
          };
          return new Response(
            stream
              ? `data: ${JSON.stringify(response)}\n\n`
              : JSON.stringify(response),
            {
              status: 200,
              headers: {
                "Content-Type": stream
                  ? "text/event-stream"
                  : "application/json",
              },
            },
          );
        }),
      );
      const api = new AiSdkApi({
        provider: "ai-sdk",
        model: "google/gemini-2.5-flash",
        apiKey: "test-key",
        providerOptions: configured
          ? { google: { thinkingConfig } }
          : undefined,
      });
      const body = {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user" as const, content: "Hi" }],
      };
      const signal = new AbortController().signal;
      let output = "";
      if (stream) {
        for await (const chunk of api.chatCompletionStream(
          { ...body, stream: true },
          signal,
        )) {
          output += chunk.choices[0]?.delta.content ?? "";
        }
      } else {
        const response = await api.chatCompletionNonStream(body, signal);
        output = response.choices[0].message.content ?? "";
      }

      expect(output).toBe("ok");
      expect(requests).toHaveLength(1);
      expect(requests[0].generationConfig).toEqual(
        configured ? { thinkingConfig } : {},
      );
    },
  );
});
