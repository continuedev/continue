import { ChatMessage } from "../../../index.js";
import Anthropic from "../Anthropic";

// Create a test class that exposes the methods we need to test
class TestAnthropic extends Anthropic {
  // Make convertMessage public for testing
  public convertMessage(message: ChatMessage, addCaching: boolean): any {
    return super.convertMessage(message, addCaching);
  }

  // Make shouldCacheMessage public for testing
  public shouldCacheMessage(
    message: ChatMessage,
    index: number,
    filteredMessages: ChatMessage[],
  ): boolean {
    return super.shouldCacheMessage(message, index, filteredMessages);
  }

  // Make convertMessages public for testing
  public convertMessages(msgs: ChatMessage[]): any[] {
    return super.convertMessages(msgs);
  }
}

describe("Anthropic Simplified Caching", () => {
  let anthropic: TestAnthropic;

  beforeEach(() => {
    anthropic = new TestAnthropic({
      model: "claude-3-5-sonnet-latest",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        cacheToolMessages: true,
        useExtendedCacheTtlBeta: true,
        cacheTtl: "1h",
      },
    });
  });

  test("should cache tool result messages", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: "Read the file main.py",
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool_1",
            type: "function",
            function: { name: "readFile", arguments: '{"path": "main.py"}' },
          },
        ],
      },
      {
        role: "tool",
        content: "def main():\n    print('Hello')",
        toolCallId: "tool_1",
      },
      {
        role: "user",
        content: "What does this file do?",
      },
    ];

    const convertedMessages = anthropic.convertMessages(messages);

    // Find the tool result message
    const toolResultMsg = convertedMessages.find(
      (msg: any) =>
        msg.role === "user" && msg.content[0]?.type === "tool_result",
    );

    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg.content[0]).toHaveProperty("cache_control");
    expect(toolResultMsg.content[0].cache_control).toEqual({
      type: "ephemeral",
      ttl: "1h",
    });
  });

  test("should cache assistant tool call messages", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: "Create a new file",
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool_1",
            type: "function",
            function: { name: "createFile", arguments: '{"path": "test.py"}' },
          },
        ],
      },
    ];

    const convertedMessages = anthropic.convertMessages(messages);

    // Find the assistant message with tool calls
    const assistantToolMsg = convertedMessages.find(
      (msg: any) =>
        msg.role === "assistant" &&
        Array.isArray(msg.content) &&
        msg.content.some((c: any) => c.type === "tool_use"),
    );

    expect(assistantToolMsg).toBeDefined();
    expect(assistantToolMsg.content[0]).toHaveProperty("cache_control");
    expect(assistantToolMsg.content[0].cache_control).toEqual({
      type: "ephemeral",
      ttl: "1h",
    });
  });

  test("should cache last 2 messages of each type", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "First user" },
      { role: "user", content: "Second user" },
      { role: "user", content: "Third user" },
      { role: "tool", content: "First tool", toolCallId: "tool_1" },
      { role: "tool", content: "Second tool", toolCallId: "tool_2" },
      { role: "tool", content: "Third tool", toolCallId: "tool_3" },
    ];

    const convertedMessages = anthropic.convertMessages(messages);

    // Only last 2 user messages should be cached
    const userMessages = convertedMessages.filter(
      (msg: any) => msg.role === "user" && msg.content[0]?.type === "text",
    );
    const cachedUserMessages = userMessages.filter(
      (msg: any) => msg.content[0]?.cache_control,
    );
    expect(cachedUserMessages).toHaveLength(2);

    // Only last 2 tool results should be cached
    const toolMessages = convertedMessages.filter(
      (msg: any) =>
        msg.role === "user" && msg.content[0]?.type === "tool_result",
    );
    const cachedToolMessages = toolMessages.filter(
      (msg: any) => msg.content[0]?.cache_control,
    );
    expect(cachedToolMessages).toHaveLength(2);
  });

  test("should not cache when caching is disabled", () => {
    const anthropicNoCache = new TestAnthropic({
      model: "claude-3-5-sonnet-latest",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: false,
        cacheToolMessages: false,
      },
    });

    const messages: ChatMessage[] = [
      {
        role: "user",
        content: "Test message",
      },
      {
        role: "tool",
        content: "Tool result",
        toolCallId: "tool_1",
      },
    ];

    const convertedMessages = anthropicNoCache.convertMessages(messages);

    // No messages should have cache_control
    convertedMessages.forEach((msg: any) => {
      if (msg.content && Array.isArray(msg.content)) {
        msg.content.forEach((content: any) => {
          expect(content).not.toHaveProperty("cache_control");
        });
      }
    });
  });

  test("should use fallback TTL when not specified", () => {
    const anthropicDefaultTtl = new TestAnthropic({
      model: "claude-3-5-sonnet-latest",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        cacheToolMessages: true,
        useExtendedCacheTtlBeta: true,
        // cacheTtl not specified - should use fallback "5m"
      },
    });

    const messages: ChatMessage[] = [
      {
        role: "tool",
        content: "Tool result",
        toolCallId: "tool_1",
      },
    ];

    const convertedMessages = anthropicDefaultTtl.convertMessages(messages);
    const toolMsg = convertedMessages[0];

    // Verify that cache_control exists and uses fallback TTL
    expect(toolMsg.content[0]).toHaveProperty("cache_control");
    expect(toolMsg.content[0].cache_control).toEqual({
      type: "ephemeral",
      ttl: "5m", // Default fallback TTL
    });
  });

  test("shouldCacheMessage logic works correctly", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "First user message" },
      { role: "assistant", content: "First response" },
      { role: "user", content: "Second user message" },
      { role: "user", content: "Third user message" },
      { role: "tool", content: "Tool result", toolCallId: "tool_1" },
    ];

    const filteredMessages = messages.filter(
      (m) =>
        m.role !== "system" &&
        (!!m.content || (m.role === "assistant" && m.toolCalls)),
    );

    // Last user message should be cached (last 2 rule)
    expect(anthropic.shouldCacheMessage(messages[3], 3, filteredMessages)).toBe(
      true,
    );

    // Second to last user message should be cached (last 2 rule)
    expect(anthropic.shouldCacheMessage(messages[2], 2, filteredMessages)).toBe(
      true,
    );

    // Tool message should be cached (last 2 rule)
    expect(anthropic.shouldCacheMessage(messages[4], 4, filteredMessages)).toBe(
      true,
    );

    // First user message should not be cached (not in last 2)
    expect(anthropic.shouldCacheMessage(messages[0], 0, filteredMessages)).toBe(
      false,
    );
  });

  test("backward compatibility - original cacheConversation behavior preserved", () => {
    const anthropicOriginal = new TestAnthropic({
      model: "claude-3-5-sonnet-latest",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        // cacheToolMessages not specified - should not cache tool messages
      },
    });

    const messages: ChatMessage[] = [
      { role: "user", content: "Message 1" },
      { role: "assistant", content: "Response 1" },
      { role: "user", content: "Message 2" },
      { role: "tool", content: "Tool result", toolCallId: "tool_1" },
    ];

    const convertedMessages = anthropicOriginal.convertMessages(messages);

    // User messages should be cached (cacheConversation: true)
    const userMessages = convertedMessages.filter(
      (msg: any) => msg.role === "user" && msg.content[0]?.type === "text",
    );
    const cachedUserMessages = userMessages.filter(
      (msg: any) => msg.content[0]?.cache_control,
    );
    expect(cachedUserMessages).toHaveLength(2);

    // Tool messages should NOT be cached (cacheToolMessages not enabled)
    const toolMessages = convertedMessages.filter(
      (msg: any) =>
        msg.role === "user" && msg.content[0]?.type === "tool_result",
    );
    const cachedToolMessages = toolMessages.filter(
      (msg: any) => msg.content[0]?.cache_control,
    );
    expect(cachedToolMessages).toHaveLength(0);
  });
});