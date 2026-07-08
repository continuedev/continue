import type { ChatHistoryItem } from "core";
import { describe, expect, it } from "vitest";

import { splitChatHistory } from "./historySplitting.js";

// Helper to create a mock chat history item
function createMockChatHistoryItem(
  content: string,
  role: "user" | "assistant" = "assistant",
): ChatHistoryItem {
  return {
    message: {
      role,
      content,
    },
  } as ChatHistoryItem;
}

describe("messageHistorySplitting", () => {
  describe("splitChatHistory", () => {
    it("should split multiple large messages in chat history", () => {
      const chatHistory = [
        createMockChatHistoryItem("Short message 1"),
        createMockChatHistoryItem(
          Array(30).fill("Long message 1").join("\n\n"),
        ),
        createMockChatHistoryItem("Short message 2"),
        createMockChatHistoryItem(
          Array(25).fill("Long message 2").join("\n\n"),
        ),
      ];

      const result = splitChatHistory(chatHistory, 80);

      // Should have more items than the original (due to splits)
      expect(result.length).toBeGreaterThan(chatHistory.length);

      // First and third messages should remain unchanged
      expect(result[0].message.content).toBe("Short message 1");
    });

    it("should maintain order after splitting", () => {
      const chatHistory = [
        createMockChatHistoryItem("First"),
        createMockChatHistoryItem(Array(30).fill("Long middle").join("\n\n")),
        createMockChatHistoryItem("Last"),
      ];

      const result = splitChatHistory(chatHistory, 80);

      // First message should still be first
      expect(result[0].message.content).toBe("First");

      // Last message should still be last
      expect(result[result.length - 1].message.content).toBe("Last");
    });
  });
});
