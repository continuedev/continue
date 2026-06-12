import { ChatCompletionCreateParams } from "openai/resources/index";
import { describe, expect, it } from "vitest";

import RodiumAi from "./RodiumAi";

describe("RodiumAi Anthropic Caching", () => {
  it("should detect Anthropic models with RodiumAi slugs", () => {
    const rodiumAi = new RodiumAi({
      model: "anthropic/claude-fable-5",
      apiKey: "test-key",
    });

    const body: ChatCompletionCreateParams = {
      model: "anthropic/claude-fable-5",
      messages: [],
    };

    expect(() => rodiumAi["modifyChatBody"](body)).not.toThrow();
  });

  it("should add cache_control to user messages when caching is enabled", () => {
    const rodiumAi = new RodiumAi({
      model: "anthropic/claude-sonnet-4-6",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        cacheSystemMessage: false,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        { role: "user", content: "First message" },
        { role: "assistant", content: "Response" },
        { role: "user", content: "Second message" },
        { role: "assistant", content: "Another response" },
        { role: "user", content: "Third message" },
      ],
    };

    const modifiedBody = rodiumAi["modifyChatBody"](body);
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

  it("should correctly handle cache_control with system messages present", () => {
    const rodiumAi = new RodiumAi({
      model: "anthropic/claude-fable-5",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        cacheSystemMessage: true,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "anthropic/claude-fable-5",
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "First user message" },
        { role: "assistant", content: "First assistant response" },
        { role: "user", content: "Second user message" },
        { role: "assistant", content: "Second assistant response" },
        { role: "user", content: "Third user message" },
      ],
    };

    const modifiedBody = rodiumAi["modifyChatBody"](body);

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

    const userMessages = modifiedBody.messages.filter(
      (msg: any) => msg.role === "user",
    );

    expect(userMessages[0].content).toBe("First user message");
    expect(userMessages[1].content).toEqual([
      {
        type: "text",
        text: "Second user message",
        cache_control: { type: "ephemeral" },
      },
    ]);
    expect(userMessages[2].content).toEqual([
      {
        type: "text",
        text: "Third user message",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("should not modify messages for non-Anthropic RodiumAi models", () => {
    const rodiumAi = new RodiumAi({
      model: "openai/gpt-5.4",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        cacheSystemMessage: true,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "openai/gpt-5.4",
      messages: [
        { role: "system", content: "System message" },
        { role: "user", content: "User message" },
      ],
    };

    const modifiedBody = rodiumAi["modifyChatBody"](body);

    expect(modifiedBody.messages).toEqual(body.messages);
  });
});

describe("RodiumAi Gemini tool calls", () => {
  it("should add thought_signature fallback for google/ models", () => {
    const rodiumAi = new RodiumAi({
      model: "google/gemini-2.5-pro",
      apiKey: "test-key",
    });

    const body: ChatCompletionCreateParams = {
      model: "google/gemini-2.5-pro",
      messages: [
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "read_file", arguments: "{}" },
            },
          ],
        },
      ],
    };

    const modifiedBody = rodiumAi["modifyChatBody"](body);
    const assistantMessage = modifiedBody.messages[0] as any;

    expect(assistantMessage.tool_calls[0].extra_content.google).toEqual({
      thought_signature: "skip_thought_signature_validator",
    });
  });
});

describe("RodiumAi headers", () => {
  it("should include Continue provider headers", () => {
    const rodiumAi = new RodiumAi({
      model: "anthropic/claude-fable-5",
      apiKey: "test-key",
    });

    const headers = rodiumAi["_getHeaders"]();

    expect(headers["X-Continue-Provider"]).toBe("rodiumai");
    expect(headers["User-Agent"]).toMatch(/^Continue\//);
  });
});
