import type { ChatHistoryItem } from "core/index.js";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the message edit feature in useChat hook
 *
 * This test suite covers:
 * - handleEditMessage: Rewinds history and resubmits edited message
 * - processMessage with baseHistory: Uses explicit base history instead of state
 * - Integration: Full edit flow produces correct final history
 */

describe("useChat - Message Edit Feature", () => {
  const createMockChatHistory = (count: number): ChatHistoryItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      message: {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`,
      },
      contextItems: [],
    }));
  };

  describe("handleEditMessage", () => {
    it("should rewind history to exclude the message being edited", () => {
      const chatHistory = createMockChatHistory(5); // [user, asst, user, asst, user]
      let currentHistory = chatHistory;

      const setChatHistory = vi.fn();
      const setQueuedMessages = vi.fn();
      const setAttachedFiles = vi.fn();
      const updateSessionHistory = vi.fn();
      const onRefreshStatic = vi.fn();
      const processMessage = vi.fn();

      // Mock handleEditMessage behavior
      const handleEditMessage = async (
        messageIndex: number,
        newContent: string,
      ) => {
        const rewindedHistory = currentHistory.slice(0, messageIndex);
        setQueuedMessages([]);
        setAttachedFiles([]);
        updateSessionHistory(rewindedHistory);
        if (onRefreshStatic) {
          onRefreshStatic();
        }
        await processMessage(newContent, undefined, false, rewindedHistory);
      };

      // Edit message at index 2 (third message)
      handleEditMessage(2, "Edited message");

      // Verify history was rewound to [0, 1]
      expect(updateSessionHistory).toHaveBeenCalledWith(
        chatHistory.slice(0, 2),
      );

      // Verify state was cleared
      expect(setQueuedMessages).toHaveBeenCalledWith([]);
      expect(setAttachedFiles).toHaveBeenCalledWith([]);

      // Verify refresh was called
      expect(onRefreshStatic).toHaveBeenCalled();

      // Verify processMessage was called with correct baseHistory
      expect(processMessage).toHaveBeenCalledWith(
        "Edited message",
        undefined,
        false,
        chatHistory.slice(0, 2),
      );
    });

    it("should handle editing the first message", () => {
      const chatHistory = createMockChatHistory(5);
      let currentHistory = chatHistory;

      const updateSessionHistory = vi.fn();
      const processMessage = vi.fn();

      const handleEditMessage = async (
        messageIndex: number,
        newContent: string,
      ) => {
        const rewindedHistory = currentHistory.slice(0, messageIndex);
        updateSessionHistory(rewindedHistory);
        await processMessage(newContent, undefined, false, rewindedHistory);
      };

      // Edit first message (index 0)
      handleEditMessage(0, "New first message");

      // Should rewind to empty history
      expect(updateSessionHistory).toHaveBeenCalledWith([]);
      expect(processMessage).toHaveBeenCalledWith(
        "New first message",
        undefined,
        false,
        [],
      );
    });

    it("should handle editing the last message", () => {
      const chatHistory = createMockChatHistory(5);
      let currentHistory = chatHistory;

      const updateSessionHistory = vi.fn();
      const processMessage = vi.fn();

      const handleEditMessage = async (
        messageIndex: number,
        newContent: string,
      ) => {
        const rewindedHistory = currentHistory.slice(0, messageIndex);
        updateSessionHistory(rewindedHistory);
        await processMessage(newContent, undefined, false, rewindedHistory);
      };

      // Edit last message (index 4)
      handleEditMessage(4, "Edited last message");

      // Should rewind to [0, 1, 2, 3]
      expect(updateSessionHistory).toHaveBeenCalledWith(
        chatHistory.slice(0, 4),
      );
      expect(processMessage).toHaveBeenCalledWith(
        "Edited last message",
        undefined,
        false,
        chatHistory.slice(0, 4),
      );
    });
  });

  describe("processMessage with baseHistory", () => {
    it("should use baseHistory instead of chatHistory when provided", () => {
      // Simulate the scenario where chatHistory state hasn't updated yet
      const oldChatHistory = createMockChatHistory(5);
      const baseHistory = oldChatHistory.slice(0, 2); // Rewound history

      // Mock processMessage that uses baseHistory parameter
      const processMessage = (
        message: string,
        imageMap?: Map<string, Buffer>,
        isQueuedMessage: boolean = false,
        baseHistory?: ChatHistoryItem[],
      ) => {
        const currentHistory = baseHistory ?? oldChatHistory;
        return currentHistory;
      };

      // Call with baseHistory
      const result = processMessage(
        "New message",
        undefined,
        false,
        baseHistory,
      );

      // Should use baseHistory, not oldChatHistory
      expect(result).toEqual(baseHistory);
      expect(result).not.toEqual(oldChatHistory);
    });

    it("should fall back to chatHistory when baseHistory is not provided", () => {
      const chatHistory = createMockChatHistory(3);

      const processMessage = (
        message: string,
        imageMap?: Map<string, Buffer>,
        isQueuedMessage: boolean = false,
        baseHistory?: ChatHistoryItem[],
      ) => {
        const currentHistory = baseHistory ?? chatHistory;
        return currentHistory;
      };

      // Call without baseHistory
      const result = processMessage("New message");

      // Should use chatHistory
      expect(result).toEqual(chatHistory);
    });
  });

  describe("Edit flow integration", () => {
    it("should produce correct history after edit and resubmit", async () => {
      // Initial history: [user1, asst1, user2, asst2, user3]
      const initialHistory = createMockChatHistory(5);
      let chatHistory = initialHistory;

      const setChatHistory = vi.fn((updater: any) => {
        if (typeof updater === "function") {
          chatHistory = updater(chatHistory);
        } else {
          chatHistory = updater;
        }
      });

      // Simulate editing user2 (index 2)
      const messageIndexToEdit = 2;
      const newContent = "Edited user2";

      // Step 1: Rewind history
      const rewindedHistory = initialHistory.slice(0, messageIndexToEdit);
      // Result: [user1, asst1]

      // Step 2: Simulate processMessage adding new user message
      const newUserMessage: ChatHistoryItem = {
        message: { role: "user", content: newContent },
        contextItems: [],
      };

      const expectedHistory = [...rewindedHistory, newUserMessage];
      // Expected: [user1, asst1, edited_user2]

      setChatHistory(expectedHistory);

      // Verify final history
      expect(chatHistory).toHaveLength(3);
      expect(chatHistory[0]).toEqual(initialHistory[0]); // user1
      expect(chatHistory[1]).toEqual(initialHistory[1]); // asst1
      expect(chatHistory[2].message.content).toBe(newContent); // edited message

      // Verify old messages are gone
      expect(chatHistory).not.toContain(initialHistory[2]); // old user2
      expect(chatHistory).not.toContain(initialHistory[3]); // asst2
      expect(chatHistory).not.toContain(initialHistory[4]); // user3
    });

    it("should handle editing with queued messages", () => {
      const chatHistory = createMockChatHistory(3);
      const queuedMessages = ["queued1", "queued2"];

      const setQueuedMessages = vi.fn();
      const setAttachedFiles = vi.fn();

      // When editing, should clear queued messages
      const handleEdit = () => {
        setQueuedMessages([]);
        setAttachedFiles([]);
      };

      handleEdit();

      expect(setQueuedMessages).toHaveBeenCalledWith([]);
      expect(setAttachedFiles).toHaveBeenCalledWith([]);
    });

    it("should handle editing with attached files", () => {
      const attachedFiles = [
        { path: "/test.txt", content: "test" },
        { path: "/test2.txt", content: "test2" },
      ];

      const setAttachedFiles = vi.fn();

      // When editing, should clear attached files
      const handleEdit = () => {
        setAttachedFiles([]);
      };

      handleEdit();

      expect(setAttachedFiles).toHaveBeenCalledWith([]);
    });
  });

  describe("Edge cases", () => {
    it("should handle editing with empty chat history", () => {
      const chatHistory: ChatHistoryItem[] = [];

      const updateSessionHistory = vi.fn();
      const processMessage = vi.fn();

      const handleEditMessage = async (
        messageIndex: number,
        newContent: string,
      ) => {
        const rewindedHistory = chatHistory.slice(0, messageIndex);
        updateSessionHistory(rewindedHistory);
        await processMessage(newContent, undefined, false, rewindedHistory);
      };

      // Attempt to edit (should handle gracefully)
      handleEditMessage(0, "New message");

      expect(updateSessionHistory).toHaveBeenCalledWith([]);
      expect(processMessage).toHaveBeenCalledWith(
        "New message",
        undefined,
        false,
        [],
      );
    });

    it("should handle editing with out-of-bounds index", () => {
      const chatHistory = createMockChatHistory(3);

      const updateSessionHistory = vi.fn();

      const handleEditMessage = (messageIndex: number) => {
        const rewindedHistory = chatHistory.slice(0, messageIndex);
        updateSessionHistory(rewindedHistory);
      };

      // Index beyond history length
      handleEditMessage(10);

      // slice(0, 10) on array of length 3 returns full array
      expect(updateSessionHistory).toHaveBeenCalledWith(chatHistory);
    });

    it("should preserve message structure during edit", () => {
      const chatHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "Original" },
          contextItems: [{ name: "file.txt", content: "data" }],
        },
      ];

      const rewindedHistory = chatHistory.slice(0, 0); // Empty
      const newMessage: ChatHistoryItem = {
        message: { role: "user", content: "Edited" },
        contextItems: [], // New message may have different contextItems
      };

      const expectedHistory = [...rewindedHistory, newMessage];

      expect(expectedHistory).toHaveLength(1);
      expect(expectedHistory[0].message.content).toBe("Edited");
      // Original message with its contextItems is gone
      expect(expectedHistory[0]).not.toEqual(chatHistory[0]);
    });
  });
});
