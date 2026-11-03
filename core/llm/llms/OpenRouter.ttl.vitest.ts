import { ChatCompletionCreateParams } from "openai/resources/index";
import { describe, expect, it } from "vitest";

import OpenRouter from "./OpenRouter";

// OpenRouter passes Anthropic cache_control, including ttl, through to Claude
// models: https://openrouter.ai/docs/guides/best-practices/prompt-caching
describe("OpenRouter cache lifetime", () => {
  const messages = (): ChatCompletionCreateParams["messages"] => [
    { role: "system", content: "You are an agent." },
    { role: "user", content: "fix it" },
    { role: "assistant", content: "ok" },
    { role: "user", content: "and this" },
  ];

  function marks(model: string, llmOptions: any, requestOptions?: any) {
    const openRouter = new OpenRouter({ model, apiKey: "k", ...llmOptions });
    const out = openRouter["modifyChatBody"](
      { model, messages: messages() },
      requestOptions,
    );
    return out.messages.flatMap((m: any) =>
      Array.isArray(m.content)
        ? m.content.map((p: any) => p.cache_control).filter(Boolean)
        : [],
    );
  }

  const sonnet = "anthropic/claude-sonnet-4.5";

  it("sends no ttl by default", () => {
    const found = marks(sonnet, {}, { promptCaching: true });
    expect(found).toHaveLength(3);
    for (const c of found) expect(c).toEqual({ type: "ephemeral" });
  });

  it("sends the request's 1-hour lifetime on every breakpoint", () => {
    const found = marks(
      sonnet,
      {},
      { promptCaching: true, promptCacheTtl: "1h" },
    );
    expect(found).toHaveLength(3);
    for (const c of found) expect(c).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  it("uses cacheBehavior.ttl when the request does not choose", () => {
    const found = marks(
      sonnet,
      { cacheBehavior: { cacheSystemMessage: true, ttl: "1h" } },
      {},
    );
    expect(found).toEqual([{ type: "ephemeral", ttl: "1h" }]);
  });

  it("the request's 5 minutes wins over cacheBehavior.ttl", () => {
    const found = marks(
      sonnet,
      { cacheBehavior: { cacheSystemMessage: true, ttl: "1h" } },
      { promptCacheTtl: "5m" },
    );
    expect(found).toEqual([{ type: "ephemeral" }]);
  });

  it('cacheBehavior.ttl "auto" sends no ttl on its own', () => {
    const found = marks(
      sonnet,
      { cacheBehavior: { cacheSystemMessage: true, ttl: "auto" } },
      {},
    );
    expect(found).toEqual([{ type: "ephemeral" }]);
  });

  it("never sends ttl to a Claude 3.x model", () => {
    const found = marks(
      "anthropic/claude-3.5-sonnet",
      {},
      { promptCaching: true, promptCacheTtl: "1h" },
    );
    expect(found).toHaveLength(3);
    for (const c of found) expect(c).toEqual({ type: "ephemeral" });
  });

  it("an explicit false from the request turns caching off", () => {
    const found = marks(
      sonnet,
      { cacheBehavior: { cacheConversation: true, cacheSystemMessage: true } },
      { promptCaching: false },
    );
    expect(found).toEqual([]);
  });

  it("ttl alone does not turn caching on", () => {
    expect(marks(sonnet, { cacheBehavior: { ttl: "1h" } }, {})).toEqual([]);
  });

  it("streamChat hands the request's options to modifyChatBody and sends the result", async () => {
    const openRouter = new OpenRouter({ model: sonnet, apiKey: "k" });
    let sent: any;
    (openRouter as any).openaiAdapter = {
      chatCompletionStream: async function* (body: any) {
        sent = body;
      },
    };
    for await (const _ of openRouter.streamChat(
      [
        { role: "system", content: "You are an agent." },
        { role: "user", content: "hello" },
      ],
      new AbortController().signal,
      { promptCaching: true, promptCacheTtl: "1h" },
    )) {
    }
    const cached = sent.messages.flatMap((m: any) =>
      Array.isArray(m.content)
        ? m.content.map((p: any) => p.cache_control).filter(Boolean)
        : [],
    );
    expect(cached).toEqual([
      { type: "ephemeral", ttl: "1h" },
      { type: "ephemeral", ttl: "1h" },
    ]);
  });

  it("sends no ttl to non-Claude models", () => {
    expect(
      marks("openai/gpt-4o", {}, { promptCaching: true, promptCacheTtl: "1h" }),
    ).toEqual([]);
  });
});
