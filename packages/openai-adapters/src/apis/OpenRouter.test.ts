import { ChatCompletionCreateParams } from "openai/resources/index";
import { describe, expect, it } from "vitest";

import { OpenRouterApi } from "./OpenRouter.js";
import { applyAnthropicCachingToOpenRouterBody } from "./OpenRouterCaching.js";

describe("OpenRouterApi Anthropic caching", () => {
  const baseConfig = {
    provider: "openrouter" as const,
    apiKey: "test-key",
  };

  it("adds cache_control to last two user messages by default", () => {
    const api = new OpenRouterApi(baseConfig);

    const body: ChatCompletionCreateParams = {
      model: "anthropic/claude-sonnet-4-5",
      messages: [
        { role: "user", content: "First" },
        { role: "assistant", content: "Resp" },
        { role: "user", content: "Second" },
        { role: "assistant", content: "Resp 2" },
        { role: "user", content: "Third" },
      ],
    };

    const modifiedBody = api["modifyChatBody"]({ ...body });

    const userMessages = modifiedBody.messages.filter(
      (message) => message.role === "user",
    );

    expect(userMessages[0].content).toBe("First");
    expect(userMessages[1].content).toEqual([
      {
        type: "text",
        text: "Second",
        cache_control: { type: "ephemeral" },
      },
    ]);
    expect(userMessages[2].content).toEqual([
      {
        type: "text",
        text: "Third",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("adds cache_control to system message via strategy", () => {
    const api = new OpenRouterApi(baseConfig);

    const body: ChatCompletionCreateParams = {
      model: "claude-3-5-sonnet-latest",
      messages: [
        { role: "system", content: "System message" },
        { role: "user", content: "Hi" },
      ],
    };

    const modifiedBody = api["modifyChatBody"]({ ...body });

    expect(modifiedBody.messages[0]).toEqual({
      role: "system",
      content: [
        {
          type: "text",
          text: "System message",
          cache_control: { type: "ephemeral" },
        },
      ],
    });
    expect(modifiedBody.messages[1]).toEqual(body.messages[1]);
  });

  it("respects cachingStrategy when set to none", () => {
    const api = new OpenRouterApi({
      ...baseConfig,
      cachingStrategy: "none",
    });

    const body: ChatCompletionCreateParams = {
      model: "claude-3-5-sonnet-latest",
      messages: [
        { role: "system", content: "System" },
        { role: "user", content: "First" },
        { role: "assistant", content: "Resp" },
        { role: "user", content: "Second" },
      ],
    };

    const modifiedBody = api["modifyChatBody"]({ ...body });

    // System message should remain unchanged when strategy is none
    expect(modifiedBody.messages[0]).toEqual(body.messages[0]);

    const userMessages = modifiedBody.messages.filter(
      (message) => message.role === "user",
    );

    expect(userMessages[0].content).toEqual([
      {
        type: "text",
        text: "First",
        cache_control: { type: "ephemeral" },
      },
    ]);
    expect(userMessages[1].content).toEqual([
      {
        type: "text",
        text: "Second",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("leaves messages unchanged for non-Anthropic models", () => {
    const api = new OpenRouterApi(baseConfig);

    const body: ChatCompletionCreateParams = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: "System" },
        { role: "user", content: "Hello" },
      ],
    };

    const modifiedBody = api["modifyChatBody"]({ ...body });

    expect(modifiedBody.messages).toEqual(body.messages);
  });

  it("adds cache_control only to last text block for array content", () => {
    const api = new OpenRouterApi(baseConfig);

    const body: ChatCompletionCreateParams = {
      model: "claude-3-5-sonnet-latest",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Part 1" },
            { type: "text", text: "Part 2" },
          ],
        },
      ],
    };

    const modifiedBody = api["modifyChatBody"]({ ...body });

    expect(modifiedBody.messages[0].content).toEqual([
      { type: "text", text: "Part 1" },
      {
        type: "text",
        text: "Part 2",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  describe("applyAnthropicCachingToOpenRouterBody", () => {
    it("mutates OpenAI chat body with system and tool caching", () => {
      const body: ChatCompletionCreateParams = {
        model: "anthropic/claude-sonnet-4-5",
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Alpha" },
          { role: "assistant", content: "Response" },
          { role: "user", content: "Beta" },
          { role: "assistant", content: "Another" },
          { role: "user", content: "Gamma" },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "toolA",
              description: "desc",
              parameters: { type: "object", properties: {} },
            },
          },
          {
            type: "function",
            function: {
              name: "toolB",
              description: "desc",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      };

      applyAnthropicCachingToOpenRouterBody(body, "systemAndTools");

      expect(body.messages[0]).toEqual({
        role: "system",
        content: [
          {
            type: "text",
            text: "You are helpful",
            cache_control: { type: "ephemeral" },
          },
        ],
      });

      const userMessages = body.messages.filter((m) => m.role === "user");
      expect(userMessages[0].content).toBe("Alpha");
      expect(userMessages[1].content).toEqual([
        {
          type: "text",
          text: "Beta",
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(userMessages[2].content).toEqual([
        {
          type: "text",
          text: "Gamma",
          cache_control: { type: "ephemeral" },
        },
      ]);

      expect(body.tools?.[0]).toEqual({
        type: "function",
        function: {
          name: "toolA",
          description: "desc",
          parameters: { type: "object", properties: {} },
        },
      });
      expect(body.tools?.[1]).toEqual({
        type: "function",
        function: {
          name: "toolB",
          description: "desc",
          parameters: { type: "object", properties: {} },
        },
        cache_control: { type: "ephemeral" },
      });
    });

    it("leaves system untouched when strategy is none while caching users", () => {
      const body: ChatCompletionCreateParams = {
        model: "anthropic/claude-sonnet-4-5",
        messages: [
          { role: "system", content: "Stay focused" },
          { role: "user", content: "Question" },
          { role: "assistant", content: "Answer" },
          { role: "user", content: "Follow up" },
        ],
      };

      applyAnthropicCachingToOpenRouterBody(body, "none");

      expect(body.messages[0]).toEqual({
        role: "system",
        content: "Stay focused",
      });

      const userMessages = body.messages.filter((m) => m.role === "user");
      expect(userMessages[0].content).toEqual([
        {
          type: "text",
          text: "Question",
          cache_control: { type: "ephemeral" },
        },
      ]);
      expect(userMessages[1].content).toEqual([
        {
          type: "text",
          text: "Follow up",
          cache_control: { type: "ephemeral" },
        },
      ]);
    });

    it("adds cache_control only to final text segment of user arrays", () => {
      const body: ChatCompletionCreateParams = {
        model: "anthropic/claude-sonnet-4-5",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Part 1" },
              { type: "text", text: "Part 2" },
            ],
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Segment A" },
              { type: "text", text: "Segment B" },
            ],
          },
        ],
      };

      applyAnthropicCachingToOpenRouterBody(body, "systemAndTools");

      expect(body.messages[0].content).toEqual([
        { type: "text", text: "Part 1" },
        {
          type: "text",
          text: "Part 2",
          cache_control: { type: "ephemeral" },
        },
      ]);

      expect(body.messages[1].content).toEqual([
        { type: "text", text: "Segment A" },
        {
          type: "text",
          text: "Segment B",
          cache_control: { type: "ephemeral" },
        },
      ]);
    });
  });
});
