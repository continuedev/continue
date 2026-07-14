import type { ChatHistoryItem } from "core/index.js";
import {
  convertFromUnifiedHistory,
  convertFromUnifiedHistoryWithSystemMessage,
} from "core/util/messageConversion.js";

describe("convertFromUnifiedHistory", () => {
  it("should expand contextItems into user message content", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: {
          role: "user",
          content: "Please review @test-file.txt",
        },
        contextItems: [
          {
            id: {
              providerTitle: "file",
              itemId: "550e8400-e29b-41d4-a716-446655440000",
            },
            content: "console.log('Hello, world!');",
            name: "test-file.txt",
            description: "File: test-file.txt",
            uri: {
              type: "file",
              value: "file:///Users/user/test-file.txt",
            },
          },
        ],
      },
    ];

    const result = convertFromUnifiedHistory(historyItems);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "user",
      content:
        "<context name=\"test-file.txt\">\nconsole.log('Hello, world!');\n</context>\n\nPlease review @test-file.txt",
    });
  });

  it("should handle user messages without contextItems", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: {
          role: "user",
          content: "Hello",
        },
        contextItems: [],
      },
    ];

    const result = convertFromUnifiedHistory(historyItems);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "user",
      content: "Hello",
    });
  });

  it("should handle multiple contextItems", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: {
          role: "user",
          content: "Compare @file1.js and @file2.js",
        },
        contextItems: [
          {
            id: {
              providerTitle: "file",
              itemId: "550e8400-e29b-41d4-a716-446655440000",
            },
            content: "const a = 1;",
            name: "file1.js",
            description: "File: file1.js",
            uri: {
              type: "file",
              value: "file:///Users/user/file1.js",
            },
          },
          {
            id: {
              providerTitle: "file",
              itemId: "550e8400-e29b-41d4-a716-446655440001",
            },
            content: "const b = 2;",
            name: "file2.js",
            description: "File: file2.js",
            uri: {
              type: "file",
              value: "file:///Users/user/file2.js",
            },
          },
        ],
      },
    ];

    const result = convertFromUnifiedHistory(historyItems);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "user",
      content:
        '<context name="file1.js">\nconst a = 1;\n</context>\n\n<context name="file2.js">\nconst b = 2;\n</context>\n\nCompare @file1.js and @file2.js',
    });
  });

  it("should not expand contextItems for non-user messages", () => {
    const historyItems: ChatHistoryItem[] = [
      {
        message: {
          role: "assistant",
          content: "Here's the analysis",
        },
        contextItems: [
          {
            id: {
              providerTitle: "file",
              itemId: "550e8400-e29b-41d4-a716-446655440000",
            },
            content: "some content",
            name: "file.txt",
            description: "File: file.txt",
            uri: {
              type: "file",
              value: "file:///Users/user/file.txt",
            },
          },
        ],
      },
    ];

    const result = convertFromUnifiedHistory(historyItems);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "assistant",
      content: "Here's the analysis",
    });
  });
});

describe("convertFromUnifiedHistoryWithSystemMessage", () => {
  it("injects the system message at index 0", () => {
    const historyItems: ChatHistoryItem[] = [
      { message: { role: "user", content: "Hello" }, contextItems: [] },
    ];

    const result = convertFromUnifiedHistoryWithSystemMessage(
      historyItems,
      "You are a helpful assistant",
    );

    expect(result[0]).toEqual({
      role: "system",
      content: "You are a helpful assistant",
    });
    expect(result).toHaveLength(2);
    expect(result[1].role).toBe("user");
  });

  it("does not leave a duplicate system message when history already starts with one", () => {
    const historyItems: ChatHistoryItem[] = [
      { message: { role: "system", content: "Stored system" }, contextItems: [] },
      { message: { role: "user", content: "Hello" }, contextItems: [] },
    ];

    const result = convertFromUnifiedHistoryWithSystemMessage(
      historyItems,
      "Injected system",
    );

    const systemMessages = result.filter((m) => m.role === "system");
    expect(systemMessages).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "system",
      content: "Injected system\n\nStored system",
    });
    // No system message should appear anywhere except index 0
    result.slice(1).forEach((m) => expect(m.role).not.toBe("system"));
  });

  it("hoists a mid-conversation system message so it is not sent at a non-zero index (tool cancellation follow-up)", () => {
    // Reproduces the "System message must be at the beginning" 400 error:
    // a tool call is cancelled and a system notification lives mid-history.
    const historyItems: ChatHistoryItem[] = [
      { message: { role: "user", content: "Run the command" }, contextItems: [] },
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tc-1",
              type: "function",
              function: { name: "run", arguments: "{}" },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "tc-1",
            toolCall: {
              id: "tc-1",
              type: "function",
              function: { name: "run", arguments: "{}" },
            },
            status: "canceled",
            parsedArgs: {},
          },
        ],
      },
      {
        message: { role: "system", content: "Chat history auto-compacted successfully." },
        contextItems: [],
      },
    ];

    const result = convertFromUnifiedHistoryWithSystemMessage(
      historyItems,
      "Base system",
    );

    // Only one system message, and it is first
    expect(result[0].role).toBe("system");
    result.slice(1).forEach((m) => expect(m.role).not.toBe("system"));
    expect(result[0]).toEqual({
      role: "system",
      content: "Base system\n\nChat history auto-compacted successfully.",
    });
    // The cancelled tool call still produces a tool result message
    expect(result.some((m) => m.role === "tool")).toBe(true);
  });

  it("emits a leading system message even when base system message is empty but history has one", () => {
    const historyItems: ChatHistoryItem[] = [
      { message: { role: "system", content: "Only stored system" }, contextItems: [] },
      { message: { role: "user", content: "Hi" }, contextItems: [] },
    ];

    const result = convertFromUnifiedHistoryWithSystemMessage(historyItems, "");

    expect(result[0]).toEqual({
      role: "system",
      content: "Only stored system",
    });
    expect(result.filter((m) => m.role === "system")).toHaveLength(1);
  });
});
