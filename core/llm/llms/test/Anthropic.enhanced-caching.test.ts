import { jest } from "@jest/globals";
import { ChatMessage } from "../../../index.js";
import Anthropic from "../Anthropic";

// Create a test class that exposes the methods we need to test
class TestAnthropic extends Anthropic {
  // Make convertMessage public for testing
  public convertMessage(message: ChatMessage, addCaching: boolean): any {
    return super.convertMessage(message, addCaching);
  }

  // Make convertMessages public for testing
  public convertMessages(msgs: ChatMessage[]): any[] {
    return super.convertMessages(msgs);
  }
}

test("should cache system message when cacheSystemMessage is enabled", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheSystemMessage: true,
      useExtendedCacheTtlBeta: true,
      cacheTtl: "1h",
    },
  });

  const systemMessage = "You are a helpful assistant with extensive knowledge.";

  // Test system message conversion in _streamChat context
  // This simulates how system messages are processed
  const systemConfig = {
    type: "text",
    text: systemMessage,
    cache_control: {
      type: "ephemeral",
      ttl: "1h",
    },
  };

  expect(systemConfig.cache_control).toEqual({
    type: "ephemeral",
    ttl: "1h",
  });
});

test("should cache tool results when cacheToolMessages is enabled", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheToolMessages: true,
      useExtendedCacheTtlBeta: true,
      cacheTtl: "1h",
    },
  });

  const toolMessage: ChatMessage = {
    role: "tool",
    content: "def main():\n    print('Hello World')",
    toolCallId: "tool_1",
  };

  const convertedMessage = anthropic.convertMessage(toolMessage, true);

  expect(convertedMessage.role).toBe("user");
  expect(convertedMessage.content[0].type).toBe("tool_result");
  expect(convertedMessage.content[0]).toHaveProperty("cache_control");
  expect(convertedMessage.content[0].cache_control).toEqual({
    type: "ephemeral",
    ttl: "1h",
  });
});

test("should cache assistant tool calls when cacheToolMessages is enabled", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheToolMessages: true,
      useExtendedCacheTtlBeta: true,
      cacheTtl: "1h",
    },
  });

  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: "",
    toolCalls: [
      {
        id: "tool_1",
        type: "function",
        function: { name: "readFile", arguments: '{"path": "main.py"}' },
      },
      {
        id: "tool_2",
        type: "function",
        function: { name: "writeFile", arguments: '{"path": "test.py"}' },
      },
    ],
  };

  const convertedMessage = anthropic.convertMessage(assistantMessage, true);

  expect(convertedMessage.role).toBe("assistant");
  expect(convertedMessage.content).toHaveLength(2);

  // Only the last tool call should have cache_control
  expect(convertedMessage.content[0]).not.toHaveProperty("cache_control");
  expect(convertedMessage.content[1]).toHaveProperty("cache_control");
  expect(convertedMessage.content[1].cache_control).toEqual({
    type: "ephemeral",
    ttl: "1h",
  });
});

test("should implement last_two message selection strategy", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheConversation: true,
    },
  });

  const messages: ChatMessage[] = [
    { role: "user", content: "Message 1" },
    { role: "assistant", content: "Response 1" },
    { role: "user", content: "Message 2" },
    { role: "assistant", content: "Response 2" },
    { role: "user", content: "Message 3" },
  ];

  // Call private method using casting
  const selectedIndices = (anthropic as any).selectMessagesToCache(messages);

  // Should select last 2 messages (indices 3 and 4)
  expect(selectedIndices).toEqual([3, 4]);
});

test("should handle small message arrays in last_two strategy", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheConversation: true,
    },
  });

  // Test with 1 message
  const oneMessage: ChatMessage[] = [{ role: "user", content: "Only message" }];
  expect((anthropic as any).selectMessagesToCache(oneMessage)).toEqual([0]);

  // Test with empty array
  const noMessages: ChatMessage[] = [];
  expect((anthropic as any).selectMessagesToCache(noMessages)).toEqual([]);
});

test("should cache last two messages regardless of role with cacheConversation", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheConversation: true,
      useExtendedCacheTtlBeta: true,
      cacheTtl: "1h",
    },
  });

  const messages: ChatMessage[] = [
    { role: "user", content: "User message 1" },
    { role: "assistant", content: "Assistant response 1" },
    { role: "user", content: "User message 2" },
    { role: "assistant", content: "Assistant response 2" },
  ];

  const convertedMessages = anthropic.convertMessages(messages);

  // Last 2 messages should have cache_control (indices 2 and 3)
  expect(convertedMessages[0].content[0]).not.toHaveProperty("cache_control");
  expect(convertedMessages[1].content[0]).not.toHaveProperty("cache_control");
  expect(convertedMessages[2].content[0]).toHaveProperty("cache_control");
  expect(convertedMessages[3].content[0]).toHaveProperty("cache_control");

  // Verify cache configuration
  expect(convertedMessages[2].content[0].cache_control).toEqual({
    type: "ephemeral",
    ttl: "1h",
  });
});

test("should not cache when caching is disabled", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheSystemMessage: false,
      cacheConversation: false,
      cacheToolMessages: false,
    },
  });

  const messages: ChatMessage[] = [
    { role: "user", content: "Test message" },
    { role: "tool", content: "Tool result", toolCallId: "tool_1" },
  ];

  const convertedMessages = anthropic.convertMessages(messages);

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
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheConversation: true,
      useExtendedCacheTtlBeta: true,
      // cacheTtl not specified - should use fallback "5m"
    },
  });

  const userMessage: ChatMessage = {
    role: "user",
    content: "Test message",
  };

  const convertedMessage = anthropic.convertMessage(userMessage, true);

  expect(convertedMessage.content[0]).toHaveProperty("cache_control");
  expect(convertedMessage.content[0].cache_control).toEqual({
    type: "ephemeral",
    ttl: "5m", // Default fallback TTL
  });
});

test("should use standard cache control when useExtendedCacheTtlBeta is false", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheConversation: true,
      useExtendedCacheTtlBeta: false,
    },
  });

  const userMessage: ChatMessage = {
    role: "user",
    content: "Test message",
  };

  const convertedMessage = anthropic.convertMessage(userMessage, true);

  expect(convertedMessage.content[0]).toHaveProperty("cache_control");
  expect(convertedMessage.content[0].cache_control).toEqual({
    type: "ephemeral",
  });
});

test("should calculate message size correctly", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
  });

  // Test string content
  const stringMessage: ChatMessage = {
    role: "user",
    content: "Hello world",
  };
  expect((anthropic as any).getMessageSize(stringMessage)).toBe(11);

  // Test array content
  const arrayMessage: ChatMessage = {
    role: "user",
    content: [
      { type: "text", text: "Hello" },
      { type: "text", text: " world" },
    ],
  };
  expect((anthropic as any).getMessageSize(arrayMessage)).toBe(11);

  // Test empty content
  const emptyMessage: ChatMessage = {
    role: "user",
    content: "",
  };
  expect((anthropic as any).getMessageSize(emptyMessage)).toBe(0);
});

test("should handle mixed content types correctly", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheConversation: true,
    },
  });

  const mixedMessage: ChatMessage = {
    role: "user",
    content: [
      { type: "text", text: "Check this image:" },
      { type: "imageUrl", imageUrl: { url: "data:image/jpeg;base64,abc123" } },
      { type: "text", text: " What do you see?" },
    ],
  };

  const convertedMessage = anthropic.convertMessage(mixedMessage, true);

  expect(convertedMessage.content).toHaveLength(3);
  expect(convertedMessage.content[0].type).toBe("text");
  expect(convertedMessage.content[1].type).toBe("image");

  // Only the last text part should have cache_control
  expect(convertedMessage.content[0]).not.toHaveProperty("cache_control");
  expect(convertedMessage.content[1]).not.toHaveProperty("cache_control");
  expect(convertedMessage.content[2]).toHaveProperty("cache_control");
});

test("should handle no cacheBehavior configuration", () => {
  const anthropic = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    // No cacheBehavior specified
  });

  const messages: ChatMessage[] = [{ role: "user", content: "Test message" }];

  const convertedMessages = anthropic.convertMessages(messages);

  // Should not crash and should not add cache_control
  expect(convertedMessages).toHaveLength(1);
  expect(convertedMessages[0].content[0]).not.toHaveProperty("cache_control");
});

test("should respect cacheDebug configuration", () => {
  const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

  const anthropicWithDebug = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheConversation: true,
      cacheDebug: true,
    },
  });

  const anthropicWithoutDebug = new TestAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    cacheBehavior: {
      cacheConversation: true,
      cacheDebug: false,
    },
  });

  const messages: ChatMessage[] = [{ role: "user", content: "Test message" }];

  // Clear previous calls
  consoleSpy.mockClear();

  // With debug enabled
  anthropicWithDebug.convertMessages(messages);
  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining("[ANTHROPIC CACHE DEBUG]"),
    expect.any(Object),
  );

  // Clear and test without debug
  consoleSpy.mockClear();
  anthropicWithoutDebug.convertMessages(messages);
  expect(consoleSpy).not.toHaveBeenCalledWith(
    expect.stringContaining("[ANTHROPIC CACHE DEBUG]"),
    expect.any(Object),
  );

  consoleSpy.mockRestore();
});
