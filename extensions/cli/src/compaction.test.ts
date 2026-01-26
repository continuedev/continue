import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { convertToUnifiedHistory } from "core/util/messageConversion.js";
import { describe, expect, it, vi } from "vitest";

import {
  compactChatHistory,
  findCompactionIndex,
  getHistoryForLLM,
} from "./compaction.js";
import { streamChatResponse } from "./stream/streamChatResponse.js";

// Mock the streamChatResponse function
vi.mock("./stream/streamChatResponse.js", () => ({
  streamChatResponse: vi.fn(),
}));

describe("compaction", () => {
  const mockModel: ModelConfig = {
    name: "test-model",
    provider: "test",
    model: "test-model",
  } as ModelConfig;

  const claudeModel: ModelConfig = {
    name: "claude-3-5-sonnet",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
  } as ModelConfig;

  const mockLlmApi = {} as BaseLlmApi;

  describe("findCompactionIndex", () => {
    it("should find compaction marker in chat history", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        {
          role: "assistant",
          content: `\nThis is a summary`,
        },
        { role: "user", content: "Another message" },
      ]);

      // Add conversationSummary to mark this as a compaction message
      history[3].conversationSummary = "This is a summary";

      const index = findCompactionIndex(history);
      expect(index).toBe(3);
    });

    it("should return null if no compaction marker found", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);

      const index = findCompactionIndex(history);
      expect(index).toBeNull();
    });

    it("should return first compaction marker when multiple exist", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        { role: "assistant", content: `\nFirst summary` },
        { role: "user", content: "Hello" },
        { role: "assistant", content: `\nSecond summary` },
      ]);

      // Add conversationSummary to mark these as compaction messages
      history[1].conversationSummary = "First summary";
      history[3].conversationSummary = "Second summary";

      const index = findCompactionIndex(history);
      expect(index).toBe(1);
    });

    it("should return null for empty chat history", () => {
      const history = convertToUnifiedHistory([]);
      const index = findCompactionIndex(history);
      expect(index).toBeNull();
    });

    it("should not match marker in middle of content", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        {
          role: "assistant",
          content: `Some text  in the middle`,
        },
        { role: "user", content: "Hello" },
      ]);

      // Don't add conversationSummary - this should not be found
      const index = findCompactionIndex(history);
      expect(index).toBeNull();
    });

    it("should handle non-string content", () => {
      // Create history items manually since convertToUnifiedHistory will throw on invalid content
      const history: ChatHistoryItem[] = [
        {
          message: { role: "system", content: "System message" },
          contextItems: [],
        },
        {
          message: { role: "assistant", content: null as any },
          contextItems: [],
        },
        {
          message: { role: "assistant", content: undefined as any },
          contextItems: [],
        },
        {
          message: {
            role: "assistant",
            content: `\\nValid compaction`,
          },
          contextItems: [],
          conversationSummary: "Valid compaction",
        },
      ];

      const index = findCompactionIndex(history);
      expect(index).toBe(3);
    });

    it("should only match messages with conversationSummary", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: `\nSystem compaction?` },
        { role: "user", content: `\nUser compaction?` },
        { role: "assistant", content: `\nReal compaction` },
      ]);

      // Only add conversationSummary to the assistant message
      history[2].conversationSummary = "Real compaction";

      const index = findCompactionIndex(history);
      expect(index).toBe(2);
    });
  });

  describe("getHistoryForLLM", () => {
    it("should return full history when no compaction index", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);

      const result = getHistoryForLLM(history, null);
      expect(result).toEqual(history);
    });

    it("should return compacted history with system message", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        {
          role: "assistant",
          content: `\nThis is a summary`,
        },
        { role: "user", content: "Another message" },
      ]);

      const result = getHistoryForLLM(history, 3);
      expect(result).toEqual([
        {
          message: { role: "system", content: "System message" },
          contextItems: [],
        },
        {
          message: {
            role: "assistant",
            content: `\nThis is a summary`,
          },
          contextItems: [],
        },
        {
          message: { role: "user", content: "Another message" },
          contextItems: [],
        },
      ]);
    });

    it("should return compacted history without system message when compaction is at index 0", () => {
      const history = convertToUnifiedHistory([
        {
          role: "assistant",
          content: `\nThis is a summary`,
        },
        { role: "user", content: "Another message" },
      ]);

      const result = getHistoryForLLM(history, 0);
      expect(result).toEqual(history);
    });

    it("should return full history when compactionIndex is out of bounds", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
      ]);

      const result = getHistoryForLLM(history, 10);
      expect(result).toEqual(history);
    });

    it("should handle negative compactionIndex", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
      ]);

      const result = getHistoryForLLM(history, -1);
      // Negative index with slice means "from the end", so -1 gives us only the last message
      // Since compactionIndex is not > 0, system message is not included
      expect(result).toEqual([
        {
          message: { role: "user", content: "Hello" },
          contextItems: [],
        },
      ]);
    });

    it("should handle empty history", () => {
      const history = convertToUnifiedHistory([]);
      const result = getHistoryForLLM(history, 0);
      expect(result).toEqual([]);
    });

    it("should handle history with only system message", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
      ]);

      const result = getHistoryForLLM(history, 0);
      expect(result).toEqual(history);
    });

    it("should handle history without system message but with compaction", () => {
      const history = convertToUnifiedHistory([
        { role: "user", content: "First message" },
        { role: "assistant", content: `\nSummary` },
        { role: "user", content: "New message" },
      ]);

      const result = getHistoryForLLM(history, 1);
      expect(result).toEqual([
        {
          message: {
            role: "assistant",
            content: `\nSummary`,
          },
          contextItems: [],
        },
        {
          message: { role: "user", content: "New message" },
          contextItems: [],
        },
      ]);
    });

    it("should include system message when first message is not system", () => {
      const history = convertToUnifiedHistory([
        { role: "user", content: "First user message" },
        { role: "system", content: "System message in wrong position" },
        { role: "assistant", content: `\nSummary` },
        { role: "user", content: "New message" },
      ]);

      // Since system message is not at index 0, it's not included
      const result = getHistoryForLLM(history, 2);
      expect(result).toEqual([
        {
          message: {
            role: "assistant",
            content: `\nSummary`,
          },
          contextItems: [],
        },
        {
          message: { role: "user", content: "New message" },
          contextItems: [],
        },
      ]);
    });

    it("should preserve message order from compaction point", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System" },
        { role: "user", content: "Old 1" },
        { role: "assistant", content: "Old 2" },
        { role: "assistant", content: `\nSummary` },
        { role: "user", content: "New 1" },
        { role: "assistant", content: "New 2" },
        { role: "user", content: "New 3" },
      ]);

      const result = getHistoryForLLM(history, 3);
      expect(result).toEqual([
        {
          message: { role: "system", content: "System" },
          contextItems: [],
        },
        {
          message: {
            role: "assistant",
            content: `\nSummary`,
          },
          contextItems: [],
        },
        {
          message: { role: "user", content: "New 1" },
          contextItems: [],
        },
        {
          message: { role: "assistant", content: "New 2" },
          contextItems: [],
        },
        {
          message: { role: "user", content: "New 3" },
          contextItems: [],
        },
      ]);
    });
  });

  describe("compactChatHistory", () => {
    it("should compact chat history successfully", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "This is a summary of the conversation";

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.(mockContent);
          callbacks?.onContentComplete?.(mockContent);
          return mockContent;
        },
      );

      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      expect(result.compactedHistory).toHaveLength(2);
      expect(result.compactedHistory[0]).toEqual({
        message: {
          role: "system",
          content: "System message",
        },
        contextItems: [],
      });
      expect(result.compactedHistory[1]).toEqual({
        message: {
          role: "assistant",
          content: mockContent,
        },
        contextItems: [],
        conversationSummary: mockContent,
      });
      expect(result.compactionIndex).toBe(1);
      expect(result.compactionContent).toBe(mockContent);
    });

    it("should handle callbacks correctly", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "Summary content";
      const onStreamContent = vi.fn();
      const onStreamComplete = vi.fn();

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.("Summary ");
          callbacks?.onContent?.("content");
          callbacks?.onContentComplete?.(mockContent);
          return mockContent;
        },
      );

      const history = convertToUnifiedHistory([
        { role: "user", content: "Hello" },
      ]);

      await compactChatHistory(history, mockModel, mockLlmApi, {
        callbacks: {
          onStreamContent,
          onStreamComplete,
        },
      });

      expect(onStreamContent).toHaveBeenCalledWith("Summary ");
      expect(onStreamContent).toHaveBeenCalledWith("content");
      expect(onStreamComplete).toHaveBeenCalled();
    });

    it("should handle errors correctly", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockError = new Error("Stream failed");
      const onError = vi.fn();

      mockStreamResponse.mockRejectedValue(mockError);

      const history = convertToUnifiedHistory([
        { role: "user", content: "Hello" },
      ]);

      await expect(
        compactChatHistory(history, mockModel, mockLlmApi, {
          callbacks: { onError },
        }),
      ).rejects.toThrow("Stream failed");

      expect(onError).toHaveBeenCalledWith(mockError);
    });

    it("should handle history with only system message", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "Summary of system setup";

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.(mockContent);
          callbacks?.onContentComplete?.(mockContent);
          return mockContent;
        },
      );

      const history = convertToUnifiedHistory([
        { role: "system", content: "You are a helpful assistant" },
      ]);

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      expect(result.compactedHistory).toHaveLength(2);
      expect(result.compactedHistory[0].message).toEqual({
        role: "system",
        content: "You are a helpful assistant",
      });
      expect(result.compactedHistory[1].message.content).toContain(
        "Summary of system setup",
      );
    });

    it("should handle empty content from stream", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.("");
          callbacks?.onContentComplete?.("");
          return "";
        },
      );

      const history = convertToUnifiedHistory([
        { role: "user", content: "Hello" },
      ]);

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      expect(result.compactionContent).toBe("");
      expect(result.compactedHistory[0].message.content).toBe("");
    });

    it("should correctly construct prompt for compaction", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      let capturedHistory: ChatHistoryItem[] = [];

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          capturedHistory = [...history];
          callbacks?.onContent?.("Summary");
          callbacks?.onContentComplete?.("Summary");
          return "Summary";
        },
      );

      const history = convertToUnifiedHistory([
        { role: "system", content: "System" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ]);

      await compactChatHistory(history, mockModel, mockLlmApi);

      // Should have original history plus the compaction prompt
      expect(capturedHistory).toHaveLength(4);
      expect(capturedHistory[3].message).toEqual({
        role: "user",
        content: expect.stringContaining("provide a concise summary"),
      });
    });

    it("should handle history with tool calls and mixed message types", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "Summary including tool usage";

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.(mockContent);
          callbacks?.onContentComplete?.(mockContent);
          return mockContent;
        },
      );

      const history = convertToUnifiedHistory([
        { role: "system", content: "System" },
        { role: "user", content: "Do something" },
        { role: "assistant", content: "I'll help", tool_calls: [{} as any] },
        { role: "tool", content: "Tool result", tool_call_id: "123" },
        { role: "assistant", content: "Done" },
      ]);

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      expect(result.compactedHistory).toHaveLength(2);
      expect(result.compactionContent).toBe(mockContent);
    });

    it("should handle very long chat histories", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.("Long summary");
          callbacks?.onContentComplete?.("Long summary");
          return "Long summary";
        },
      );

      // Create a very long history
      const history = convertToUnifiedHistory([
        { role: "system", content: "System" },
      ]);

      for (let i = 0; i < 100; i++) {
        history.push({
          message: { role: "user", content: `User message ${i}` },
          contextItems: [],
        });
        history.push({
          message: { role: "assistant", content: `Assistant response ${i}` },
          contextItems: [],
        });
      }

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      expect(result.compactedHistory).toHaveLength(2); // System + compaction
      expect(result.compactionIndex).toBe(1);
    });

    it("should handle history without system message", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "Summary without system";

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.(mockContent);
          callbacks?.onContentComplete?.(mockContent);
          return mockContent;
        },
      );

      const history = convertToUnifiedHistory([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ]);

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      expect(result.compactedHistory).toHaveLength(1); // Only compaction
      expect(result.compactedHistory[0].message.role).toBe("assistant");
      expect(result.compactionIndex).toBe(0);
    });
  });

  describe("property-based tests", () => {
    it("getHistoryForLLM should always return a subset of the original history", () => {
      const testCases: Array<{
        history: ChatHistoryItem[];
        compactionIndex: number | null;
      }> = [
        {
          history: convertToUnifiedHistory([
            { role: "system", content: "System" },
            { role: "user", content: "User 1" },
            { role: "assistant", content: "Assistant 1" },
          ]),
          compactionIndex: 1,
        },
        {
          history: convertToUnifiedHistory([
            { role: "user", content: "User 1" },
            { role: "assistant", content: "Assistant 1" },
            { role: "user", content: "User 2" },
          ]),
          compactionIndex: 2,
        },
        {
          history: [],
          compactionIndex: null,
        },
      ];

      testCases.forEach(({ history, compactionIndex }) => {
        const result = getHistoryForLLM(history, compactionIndex);

        // Every message in result should exist in original history
        result.forEach((msg) => {
          expect(history).toContainEqual(msg);
        });

        // Result length should be <= original length
        expect(result.length).toBeLessThanOrEqual(history.length);
      });
    });

    it("getHistoryForLLM should always include system message if it exists at index 0", () => {
      const systemMessage: ChatHistoryItem = {
        message: {
          role: "system",
          content: "System",
        },
        contextItems: [],
      };
      const testCases: Array<{
        history: ChatHistoryItem[];
        compactionIndex: number | null;
      }> = [
        {
          history: convertToUnifiedHistory([
            { role: "system", content: "System" },
            { role: "user", content: "User 1" },
            { role: "assistant", content: `\nSummary` },
          ]),
          compactionIndex: 2,
        },
        {
          history: convertToUnifiedHistory([
            { role: "system", content: "System" },
            { role: "assistant", content: `\nSummary` },
          ]),
          compactionIndex: 1,
        },
      ];

      testCases.forEach(({ history, compactionIndex }) => {
        const result = getHistoryForLLM(history, compactionIndex);

        if (
          history[0]?.message?.role === "system" &&
          compactionIndex !== null &&
          compactionIndex > 0
        ) {
          expect(result[0]).toEqual(history[0]);
        }
      });
    });

    it("compaction should always reduce message count for non-trivial histories", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.("Summary");
          callbacks?.onContentComplete?.("Summary");
          return "Summary";
        },
      );

      const testHistories: ChatHistoryItem[][] = [
        convertToUnifiedHistory([
          { role: "system", content: "System" },
          { role: "user", content: "User 1" },
          { role: "assistant", content: "Assistant 1" },
          { role: "user", content: "User 2" },
          { role: "assistant", content: "Assistant 2" },
        ]),
        convertToUnifiedHistory([
          { role: "user", content: "User 1" },
          { role: "assistant", content: "Assistant 1" },
          { role: "user", content: "User 2" },
        ]),
      ];

      for (const history of testHistories) {
        const result = await compactChatHistory(history, mockModel, mockLlmApi);

        // Compacted history should be shorter than original
        // (system + compaction) or just compaction
        expect(result.compactedHistory.length).toBeLessThanOrEqual(2);
        expect(result.compactedHistory.length).toBeLessThan(history.length);
      }
    });
  });

  describe("invariant tests", () => {
    it("compactionIndex should always point to a message with conversationSummary", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.("Summary content");
          callbacks?.onContentComplete?.("Summary content");
          return "Summary content";
        },
      );

      const histories: ChatHistoryItem[][] = [
        convertToUnifiedHistory([
          { role: "system", content: "System" },
          { role: "user", content: "Hello" },
        ]),
        convertToUnifiedHistory([
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
        ]),
        convertToUnifiedHistory([{ role: "system", content: "System" }]),
      ];

      for (const history of histories) {
        const result = await compactChatHistory(history, mockModel, mockLlmApi);

        // The message at compactionIndex should have a conversationSummary
        const compactionMessage =
          result.compactedHistory[result.compactionIndex];
        expect(compactionMessage.message.role).toBe("assistant");
        expect(compactionMessage.conversationSummary).toBeDefined();
      }
    });

    it("system message should always be preserved in the same position", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.("Summary");
          callbacks?.onContentComplete?.("Summary");
          return "Summary";
        },
      );

      const history = convertToUnifiedHistory([
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ]);

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      // System message should still be at index 0
      expect(result.compactedHistory[0]).toEqual(history[0]);
    });

    it("findCompactionIndex should be consistent with compactChatHistory result", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);

      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.("Summary");
          callbacks?.onContentComplete?.("Summary");
          return "Summary";
        },
      );

      const history = convertToUnifiedHistory([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ]);

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      // findCompactionIndex should find the same index
      const foundIndex = findCompactionIndex(result.compactedHistory);
      expect(foundIndex).toBe(result.compactionIndex);
    });
  });
});
