import type { ChatHistoryItem } from "core/index.js";
import { convertFromUnifiedHistory } from "core/util/messageConversion.js";

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
