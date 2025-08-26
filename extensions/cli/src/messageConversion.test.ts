import type { ChatHistoryItem } from "../../../core/index.js";
import { convertFromUnifiedHistory } from "./messageConversion.js";

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
              itemId: "attached-file-0",
            },
            content: "console.log('Hello, world!');",
            name: "test-file.txt",
            description: "File: test-file.txt",
            uri: {
              type: "file",
              value: "test-file.txt",
            },
          },
        ],
      },
    ];

    const result = convertFromUnifiedHistory(historyItems);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "user",
      content: "Please review @test-file.txt\n\n<file path=\"test-file.txt\">\nconsole.log('Hello, world!');\n</file>",
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
              itemId: "attached-file-0",
            },
            content: "const a = 1;",
            name: "file1.js",
            description: "File: file1.js",
            uri: {
              type: "file",
              value: "file1.js",
            },
          },
          {
            id: {
              providerTitle: "file",
              itemId: "attached-file-1",
            },
            content: "const b = 2;",
            name: "file2.js",
            description: "File: file2.js",
            uri: {
              type: "file",
              value: "file2.js",
            },
          },
        ],
      },
    ];

    const result = convertFromUnifiedHistory(historyItems);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "user",
      content: "Compare @file1.js and @file2.js\n\n<file path=\"file1.js\">\nconst a = 1;\n</file>\n\n<file path=\"file2.js\">\nconst b = 2;\n</file>",
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
              itemId: "attached-file-0",
            },
            content: "some content",
            name: "file.txt",
            description: "File: file.txt",
            uri: {
              type: "file",
              value: "file.txt",
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