import { ChatCompletionCreateParams } from "openai/resources/index";
import { describe, expect, it } from "vitest";

import OpenRouter from "./OpenRouter";

describe("OpenRouter Anthropic Caching", () => {
  it("should detect Anthropic models correctly", () => {
    const openRouter = new OpenRouter({
      model: "claude-sonnet-4-5",
      apiKey: "test-key",
    });

    // Test private method through modifyChatBody
    const body: ChatCompletionCreateParams = {
      model: "claude-sonnet-4-5",
      messages: [],
    };

    // Should not throw
    openRouter["modifyChatBody"](body);
  });

  it("should add cache_control to user messages when caching is enabled", () => {
    const openRouter = new OpenRouter({
      model: "anthropic/claude-sonnet-4.5",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        cacheSystemMessage: false,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "anthropic/claude-sonnet-4.5",
      messages: [
        { role: "user", content: "First message" },
        { role: "assistant", content: "Response" },
        { role: "user", content: "Second message" },
        { role: "assistant", content: "Another response" },
        { role: "user", content: "Third message" },
      ],
    };

    const modifiedBody = openRouter["modifyChatBody"](body);

    // Check that the last two user messages have cache_control
    const userMessages = modifiedBody.messages.filter(
      (msg: any) => msg.role === "user",
    );

    // First user message should not have cache_control
    expect(userMessages[0].content).toBe("First message");

    // Last two user messages should have cache_control
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
    const openRouter = new OpenRouter({
      model: "claude-sonnet-4-5",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        cacheSystemMessage: true,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "claude-sonnet-4-5",
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "First user message" },
        { role: "assistant", content: "First assistant response" },
        { role: "user", content: "Second user message" },
        { role: "assistant", content: "Second assistant response" },
        { role: "user", content: "Third user message" },
      ],
    };

    const modifiedBody = openRouter["modifyChatBody"](body);

    // System message should have cache_control
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

    // Check user messages - should follow Anthropic filtering logic
    const userMessages = modifiedBody.messages.filter(
      (msg: any) => msg.role === "user",
    );

    // First user message should NOT have cache_control (only last 2)
    expect(userMessages[0].content).toBe("First user message");

    // Last two user messages should have cache_control
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

    // Assistant messages should remain unchanged
    expect(modifiedBody.messages[2].content).toBe("First assistant response");
    expect(modifiedBody.messages[4].content).toBe("Second assistant response");
  });

  it("should add cache_control to system message when caching is enabled", () => {
    const openRouter = new OpenRouter({
      model: "claude-sonnet-4-5",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: false,
        cacheSystemMessage: true,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "claude-sonnet-4-5",
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello" },
      ],
    };

    const modifiedBody = openRouter["modifyChatBody"](body);

    // System message should have cache_control
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

    // User message should remain unchanged
    expect(modifiedBody.messages[1]).toEqual({
      role: "user",
      content: "Hello",
    });
  });

  it("should handle array content correctly", () => {
    const openRouter = new OpenRouter({
      model: "claude-sonnet-4-5",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        cacheSystemMessage: false,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "claude-sonnet-4-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: "Second part" },
          ],
        },
      ],
    };

    const modifiedBody = openRouter["modifyChatBody"](body);

    // Only the last text part should have cache_control
    expect(modifiedBody.messages[0].content).toEqual([
      { type: "text", text: "First part" },
      {
        type: "text",
        text: "Second part",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("should not modify messages for non-Anthropic models", () => {
    const openRouter = new OpenRouter({
      model: "gpt-4o",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        cacheSystemMessage: true,
      },
    });

    const body: ChatCompletionCreateParams = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: "System message" },
        { role: "user", content: "User message" },
      ],
    };

    const modifiedBody = openRouter["modifyChatBody"](body);

    // Messages should remain unchanged
    expect(modifiedBody.messages).toEqual(body.messages);
  });
});
