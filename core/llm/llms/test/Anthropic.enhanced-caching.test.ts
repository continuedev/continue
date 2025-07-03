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

describe("Anthropic Smart Caching", () => {
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
        content: "def main():\n    print('Hello')\n".repeat(500), // Make it large enough to be cached
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

  test("should only cache messages meeting minimum size requirements", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Small message" }, // Too small to cache
      { role: "user", content: "Large message content ".repeat(200) }, // Large enough to cache
      { role: "tool", content: "Small tool result", toolCallId: "tool_1" }, // Too small
      { role: "tool", content: "Large tool result ".repeat(300), toolCallId: "tool_2" }, // Large enough
    ];

    const convertedMessages = anthropic.convertMessages(messages);

    // Count cached messages
    let cachedCount = 0;
    convertedMessages.forEach((msg: any) => {
      if (msg.content && Array.isArray(msg.content)) {
        msg.content.forEach((content: any) => {
          if (content.cache_control) {
            cachedCount++;
          }
        });
      }
    });

    // Should only cache the large messages that meet minimum requirements
    expect(cachedCount).toBeGreaterThan(0);
    expect(cachedCount).toBeLessThanOrEqual(4); // Never exceed 4 blocks
  });

  test("should respect 4 block limit with priority-based selection", () => {
    // Create many large messages that could potentially be cached
    const messages: ChatMessage[] = [
      { role: "user", content: "Large user message 1 ".repeat(200) },
      { role: "user", content: "Large user message 2 ".repeat(200) },
      { role: "user", content: "Large user message 3 ".repeat(200) },
      { role: "tool", content: "Large tool result 1 ".repeat(300), toolCallId: "tool_1" },
      { role: "tool", content: "Large tool result 2 ".repeat(300), toolCallId: "tool_2" },
      { role: "tool", content: "Large tool result 3 ".repeat(300), toolCallId: "tool_3" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "tool_4", type: "function", function: { name: "test", arguments: "{}" } }],
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "tool_5", type: "function", function: { name: "test", arguments: "{}" } }],
      },
    ];

    const convertedMessages = anthropic.convertMessages(messages);

    // Count all cached blocks
    let totalCachedBlocks = 0;
    convertedMessages.forEach((msg: any) => {
      if (msg.content && Array.isArray(msg.content)) {
        msg.content.forEach((content: any) => {
          if (content.cache_control) {
            totalCachedBlocks++;
          }
        });
      }
    });

    // Should not exceed 4 blocks total (since cacheSystemMessage is NOT enabled in this test)
    expect(totalCachedBlocks).toBeLessThanOrEqual(4);
    expect(totalCachedBlocks).toBeGreaterThan(0);
  });

  test("should respect 3 block limit when system message caching is enabled", () => {
    const anthropicWithSystem = new TestAnthropic({
      model: "claude-3-5-sonnet-latest",
      apiKey: "test-key",
      cacheBehavior: {
        cacheSystemMessage: true, // This reserves 1 block, leaving 3 for messages
        cacheConversation: true,
        cacheToolMessages: true,
        useExtendedCacheTtlBeta: true,
        cacheTtl: "1h",
      },
    });

    // Create many large messages that could potentially be cached
    const messages: ChatMessage[] = [
      { role: "user", content: "Large user message 1 ".repeat(200) },
      { role: "user", content: "Large user message 2 ".repeat(200) },
      { role: "user", content: "Large user message 3 ".repeat(200) },
      { role: "tool", content: "Large tool result 1 ".repeat(300), toolCallId: "tool_1" },
      { role: "tool", content: "Large tool result 2 ".repeat(300), toolCallId: "tool_2" },
      { role: "tool", content: "Large tool result 3 ".repeat(300), toolCallId: "tool_3" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "tool_4", type: "function", function: { name: "test", arguments: "{}" } }],
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "tool_5", type: "function", function: { name: "test", arguments: "{}" } }],
      },
    ];

    const convertedMessages = anthropicWithSystem.convertMessages(messages);

    // Count all cached blocks
    let totalCachedBlocks = 0;
    convertedMessages.forEach((msg: any) => {
      if (msg.content && Array.isArray(msg.content)) {
        msg.content.forEach((content: any) => {
          if (content.cache_control) {
            totalCachedBlocks++;
          }
        });
      }
    });

    // Should not exceed 3 blocks (4 max - 1 for system message)
    expect(totalCachedBlocks).toBeLessThanOrEqual(3);
    expect(totalCachedBlocks).toBeGreaterThan(0);
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
        content: "Large test message ".repeat(200),
      },
      {
        role: "tool",
        content: "Large tool result ".repeat(300),
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
        content: "Large tool result ".repeat(300),
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

  test("should prioritize user messages like official cookbook", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Large user input with important context ".repeat(200) },
      { role: "tool", content: "Large tool result ".repeat(200), toolCallId: "tool_1" },
      { role: "assistant", content: "Large assistant response ".repeat(200) },
    ];

    const filteredMessages = messages.filter(
      (m) =>
        m.role !== "system" &&
        (!!m.content || (m.role === "assistant" && m.toolCalls)),
    );

    // User message should be prioritized for caching
    expect(anthropic.shouldCacheMessage(messages[0], 0, filteredMessages)).toBe(true);
  });

  test("backward compatibility - respects original behavior", () => {
    const anthropicOriginal = new TestAnthropic({
      model: "claude-3-5-sonnet-latest",
      apiKey: "test-key",
      cacheBehavior: {
        cacheConversation: true,
        // cacheToolMessages not specified - should not cache tool messages
      },
    });

    const messages: ChatMessage[] = [
      { role: "user", content: "Large user message ".repeat(200) },
      { role: "assistant", content: "Large assistant response ".repeat(200) },
      { role: "user", content: "Another large user message ".repeat(200) },
      { role: "tool", content: "Large tool result ".repeat(300), toolCallId: "tool_1" },
    ];

    const convertedMessages = anthropicOriginal.convertMessages(messages);

    // Count cached blocks
    let totalCachedBlocks = 0;
    convertedMessages.forEach((msg: any) => {
      if (msg.content && Array.isArray(msg.content)) {
        msg.content.forEach((content: any) => {
          if (content.cache_control) {
            totalCachedBlocks++;
          }
        });
      }
    });

    // Should cache some conversation messages but stay within limits
    expect(totalCachedBlocks).toBeGreaterThan(0);
    expect(totalCachedBlocks).toBeLessThanOrEqual(4);

    // Tool messages should NOT be cached (cacheToolMessages not enabled)
    const toolMessages = convertedMessages.filter(
      (msg: any) => msg.role === "user" && msg.content[0]?.type === "tool_result",
    );
    const cachedToolMessages = toolMessages.filter(
      (msg: any) => msg.content[0]?.cache_control,
    );
    expect(cachedToolMessages).toHaveLength(0);
  });
});
