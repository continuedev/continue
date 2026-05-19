import { ChatCompletionCreateParams } from "openai/resources/index";
import { describe, expect, it } from "vitest";

import OrcaRouter from "./OrcaRouter";

describe("OrcaRouter", () => {
  it("uses the correct providerName and default apiBase", () => {
    expect(OrcaRouter.providerName).toBe("orcarouter");
    expect(OrcaRouter.defaultOptions?.apiBase).toBe(
      "https://api.orcarouter.ai/v1/",
    );
    expect(OrcaRouter.defaultOptions?.model).toBe("orcarouter/auto");
  });

  it("injects OrcaRouter attribution headers", () => {
    const orcaRouter = new OrcaRouter({
      model: "orcarouter/auto",
      apiKey: "sk-orca-test",
    });

    const headers = (orcaRouter as any).requestOptions?.headers ?? {};
    expect(headers["HTTP-Referer"]).toBe("https://www.continue.dev/");
    expect(headers["X-Title"]).toBe("Continue");
    expect(headers["X-Continue-Provider"]).toBe("orcarouter");
  });

  it("allows user-provided headers to override defaults", () => {
    const orcaRouter = new OrcaRouter({
      model: "orcarouter/auto",
      apiKey: "sk-orca-test",
      requestOptions: {
        headers: { "X-Title": "MyApp" },
      },
    });

    const headers = (orcaRouter as any).requestOptions?.headers ?? {};
    expect(headers["X-Title"]).toBe("MyApp");
  });
});

describe("OrcaRouter Anthropic Caching", () => {
  it("does not throw for Anthropic models without cacheBehavior", () => {
    const orcaRouter = new OrcaRouter({
      model: "anthropic/claude-opus-4.7",
      apiKey: "sk-orca-test",
    });

    const body: ChatCompletionCreateParams = {
      model: "anthropic/claude-opus-4.7",
      messages: [],
    };

    expect(() => orcaRouter["modifyChatBody"](body)).not.toThrow();
  });

  it("adds cache_control to last two user messages when caching is enabled", () => {
    const orcaRouter = new OrcaRouter({
      model: "anthropic/claude-opus-4.7",
      apiKey: "sk-orca-test",
      cacheBehavior: {
        cacheConversation: true,
        cacheSystemMessage: false,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "anthropic/claude-opus-4.7",
      messages: [
        { role: "user", content: "First message" },
        { role: "assistant", content: "Response" },
        { role: "user", content: "Second message" },
        { role: "assistant", content: "Another response" },
        { role: "user", content: "Third message" },
      ],
    };

    const modifiedBody = orcaRouter["modifyChatBody"](body);
    const userMessages = modifiedBody.messages.filter(
      (msg: any) => msg.role === "user",
    );

    expect(userMessages[0].content).toBe("First message");
    expect(userMessages[1].content).toEqual([
      {
        type: "text",
        text: "Second message",
        cache_control: { type: "ephemeral" },
      },
    ]);
    expect(userMessages[2].content).toEqual([
      {
        type: "text",
        text: "Third message",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("adds cache_control to system message when caching is enabled", () => {
    const orcaRouter = new OrcaRouter({
      model: "anthropic/claude-opus-4.7",
      apiKey: "sk-orca-test",
      cacheBehavior: {
        cacheConversation: false,
        cacheSystemMessage: true,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "anthropic/claude-opus-4.7",
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello" },
      ],
    };

    const modifiedBody = orcaRouter["modifyChatBody"](body);

    expect(modifiedBody.messages[0]).toEqual({
      role: "system",
      content: [
        {
          type: "text",
          text: "You are a helpful assistant",
          cache_control: { type: "ephemeral" },
        },
      ],
    });
    expect(modifiedBody.messages[1]).toEqual({
      role: "user",
      content: "Hello",
    });
  });

  it("does not modify messages for non-Anthropic models", () => {
    const orcaRouter = new OrcaRouter({
      model: "openai/gpt-5.5",
      apiKey: "sk-orca-test",
      cacheBehavior: {
        cacheConversation: true,
        cacheSystemMessage: true,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "openai/gpt-5.5",
      messages: [
        { role: "system", content: "System message" },
        { role: "user", content: "User message" },
      ],
    };

    const modifiedBody = orcaRouter["modifyChatBody"](body);
    expect(modifiedBody.messages).toEqual(body.messages);
  });

  it("does not modify messages when no caching is enabled", () => {
    const orcaRouter = new OrcaRouter({
      model: "anthropic/claude-opus-4.7",
      apiKey: "sk-orca-test",
    });

    const body: ChatCompletionCreateParams = {
      model: "anthropic/claude-opus-4.7",
      messages: [
        { role: "system", content: "System message" },
        { role: "user", content: "User message" },
      ],
    };

    const modifiedBody = orcaRouter["modifyChatBody"](body);
    expect(modifiedBody.messages).toEqual(body.messages);
  });
});
