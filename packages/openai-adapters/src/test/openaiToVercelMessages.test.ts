import { generateText, type ModelMessage } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";
import { describe, expect, test } from "vitest";
import { convertOpenAIMessagesToVercel } from "../openaiToVercelMessages.js";

const imageDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6v8AAAAASUVORK5CYII=";

describe("convertOpenAIMessagesToVercel", () => {
  test.each([
    { url: imageDataUrl, detail: undefined },
    { url: "https://example.com/image.png", detail: "high" as const },
  ])("passes image content to the AI SDK: $url", async ({ url, detail }) => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this image." },
          { type: "image_url", image_url: { url, detail } },
          { type: "text", text: "Include the colors." },
        ],
      },
    ];
    const original = structuredClone(messages);
    const model = new MockLanguageModelV3({
      supportedUrls: { "image/*": [/.*/] },
      doGenerate: {
        content: [{ type: "text", text: "A small image." }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      },
    });

    const result = await generateText({
      model,
      messages: convertOpenAIMessagesToVercel(messages) as ModelMessage[],
    });

    expect(result.text).toBe("A small image.");
    expect(model.doGenerateCalls[0].prompt[0]).toMatchObject({
      role: "user",
      content: [
        { type: "text", text: "Describe this image." },
        {
          type: "file",
          mediaType: expect.stringMatching(/^image\//),
          ...(detail
            ? { providerOptions: { openai: { imageDetail: detail } } }
            : {}),
        },
        { type: "text", text: "Include the colors." },
      ],
    });
    expect(messages).toEqual(original);
  });

  test("preserves string and text-only user messages", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: [{ type: "text", text: "How are you?" }] },
    ];

    expect(convertOpenAIMessagesToVercel(messages)).toEqual(messages);
  });
});
