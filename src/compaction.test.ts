import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { describe, it, expect, vi } from "vitest";

import { compactChatHistory, findCompactionIndex, getHistoryForLLM, COMPACTION_MARKER } from "./compaction.js";
import { streamChatResponse } from "./streamChatResponse.js";


// Mock the streamChatResponse function
vi.mock("./streamChatResponse.js", () => ({
  streamChatResponse: vi.fn()
}));

describe("compaction", () => {
  const mockModel: ModelConfig = {
    name: "test-model",
    provider: "test",
    model: "test-model",
  } as ModelConfig;

  const mockLlmApi = {} as BaseLlmApi;

  describe("findCompactionIndex", () => {
    it("should find compaction marker in chat history", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "assistant", content: `${COMPACTION_MARKER}\nThis is a summary` },
        { role: "user", content: "Another message" },
      ];

      const index = findCompactionIndex(history);
      expect(index).toBe(3);
    });

    it("should return null if no compaction marker found", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const index = findCompactionIndex(history);
      expect(index).toBeNull();
    });

    it("should return first compaction marker when multiple exist", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "assistant", content: `${COMPACTION_MARKER}\nFirst summary` },
        { role: "user", content: "Hello" },
        { role: "assistant", content: `${COMPACTION_MARKER}\nSecond summary` },
      ];

      const index = findCompactionIndex(history);
      expect(index).toBe(1);
    });

    it("should return null for empty chat history", () => {
      const history: ChatCompletionMessageParam[] = [];
      const index = findCompactionIndex(history);
      expect(index).toBeNull();
    });

    it("should not match marker in middle of content", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "assistant", content: `Some text ${COMPACTION_MARKER} in the middle` },
        { role: "user", content: "Hello" },
      ];

      const index = findCompactionIndex(history);
      expect(index).toBeNull();
    });

    it("should handle non-string content", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "assistant", content: null as any },
        { role: "assistant", content: undefined as any },
        { role: "assistant", content: 123 as any },
      ];

      const index = findCompactionIndex(history);
      expect(index).toBeNull();
    });

    it("should only match assistant role messages", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: `${COMPACTION_MARKER}\nSystem compaction?` },
        { role: "user", content: `${COMPACTION_MARKER}\nUser compaction?` },
        { role: "assistant", content: `${COMPACTION_MARKER}\nReal compaction` },
      ];

      const index = findCompactionIndex(history);
      expect(index).toBe(2);
    });
  });

  describe("getHistoryForLLM", () => {
    it("should return full history when no compaction index", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const result = getHistoryForLLM(history, null);
      expect(result).toEqual(history);
    });

    it("should return compacted history with system message", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "assistant", content: `${COMPACTION_MARKER}\nThis is a summary` },
        { role: "user", content: "Another message" },
      ];

      const result = getHistoryForLLM(history, 3);
      expect(result).toEqual([
        { role: "system", content: "System message" },
        { role: "assistant", content: `${COMPACTION_MARKER}\nThis is a summary` },
        { role: "user", content: "Another message" },
      ]);
    });

    it("should return compacted history without system message when compaction is at index 0", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "assistant", content: `${COMPACTION_MARKER}\nThis is a summary` },
        { role: "user", content: "Another message" },
      ];

      const result = getHistoryForLLM(history, 0);
      expect(result).toEqual(history);
    });

    it("should return full history when compactionIndex is out of bounds", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
      ];

      const result = getHistoryForLLM(history, 10);
      expect(result).toEqual(history);
    });

    it("should handle negative compactionIndex", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
      ];

      const result = getHistoryForLLM(history, -1);
      // Negative index with slice means "from the end", so -1 gives us only the last message
      // Since compactionIndex is not > 0, system message is not included
      expect(result).toEqual([
        { role: "user", content: "Hello" },
      ]);
    });

    it("should handle empty history", () => {
      const history: ChatCompletionMessageParam[] = [];
      const result = getHistoryForLLM(history, 0);
      expect(result).toEqual([]);
    });

    it("should handle history with only system message", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
      ];

      const result = getHistoryForLLM(history, 0);
      expect(result).toEqual(history);
    });

    it("should handle history without system message but with compaction", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "user", content: "First message" },
        { role: "assistant", content: `${COMPACTION_MARKER}\nSummary` },
        { role: "user", content: "New message" },
      ];

      const result = getHistoryForLLM(history, 1);
      expect(result).toEqual([
        { role: "assistant", content: `${COMPACTION_MARKER}\nSummary` },
        { role: "user", content: "New message" },
      ]);
    });

    it("should include system message when first message is not system", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "user", content: "First user message" },
        { role: "system", content: "System message in wrong position" },
        { role: "assistant", content: `${COMPACTION_MARKER}\nSummary` },
        { role: "user", content: "New message" },
      ];

      // Since system message is not at index 0, it's not included
      const result = getHistoryForLLM(history, 2);
      expect(result).toEqual([
        { role: "assistant", content: `${COMPACTION_MARKER}\nSummary` },
        { role: "user", content: "New message" },
      ]);
    });

    it("should preserve message order from compaction point", () => {
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System" },
        { role: "user", content: "Old 1" },
        { role: "assistant", content: "Old 2" },
        { role: "assistant", content: `${COMPACTION_MARKER}\nSummary` },
        { role: "user", content: "New 1" },
        { role: "assistant", content: "New 2" },
        { role: "user", content: "New 3" },
      ];

      const result = getHistoryForLLM(history, 3);
      expect(result).toEqual([
        { role: "system", content: "System" },
        { role: "assistant", content: `${COMPACTION_MARKER}\nSummary` },
        { role: "user", content: "New 1" },
        { role: "assistant", content: "New 2" },
        { role: "user", content: "New 3" },
      ]);
    });
  });

  describe("compactChatHistory", () => {
    it("should compact chat history successfully", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "This is a summary of the conversation";
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.(mockContent);
        callbacks?.onContentComplete?.(mockContent);
        return mockContent;
      });

      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const result = await compactChatHistory(history, mockModel, mockLlmApi);
      
      expect(result.compactedHistory).toHaveLength(2);
      expect(result.compactedHistory[0]).toEqual({ role: "system", content: "System message" });
      expect(result.compactedHistory[1]).toEqual({
        role: "assistant",
        content: `${COMPACTION_MARKER}\n${mockContent}`
      });
      expect(result.compactionIndex).toBe(1);
      expect(result.compactionContent).toBe(mockContent);
    });

    it("should handle callbacks correctly", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "Summary content";
      const onStreamContent = vi.fn();
      const onStreamComplete = vi.fn();
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Summary ");
        callbacks?.onContent?.("content");
        callbacks?.onContentComplete?.(mockContent);
        return mockContent;
      });

      const history: ChatCompletionMessageParam[] = [
        { role: "user", content: "Hello" },
      ];

      await compactChatHistory(history, mockModel, mockLlmApi, {
        onStreamContent,
        onStreamComplete
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

      const history: ChatCompletionMessageParam[] = [
        { role: "user", content: "Hello" },
      ];

      await expect(
        compactChatHistory(history, mockModel, mockLlmApi, { onError })
      ).rejects.toThrow("Stream failed");
      
      expect(onError).toHaveBeenCalledWith(mockError);
    });

    it("should handle history with only system message", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "Summary of system setup";
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.(mockContent);
        callbacks?.onContentComplete?.(mockContent);
        return mockContent;
      });

      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "You are a helpful assistant" },
      ];

      const result = await compactChatHistory(history, mockModel, mockLlmApi);
      
      expect(result.compactedHistory).toHaveLength(2);
      expect(result.compactedHistory[0]).toEqual({ role: "system", content: "You are a helpful assistant" });
      expect(result.compactedHistory[1].content).toContain(COMPACTION_MARKER);
    });

    it("should handle empty content from stream", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("");
        callbacks?.onContentComplete?.("");
        return "";
      });

      const history: ChatCompletionMessageParam[] = [
        { role: "user", content: "Hello" },
      ];

      const result = await compactChatHistory(history, mockModel, mockLlmApi);
      
      expect(result.compactionContent).toBe("");
      expect(result.compactedHistory[0].content).toBe(`${COMPACTION_MARKER}\n`);
    });

    it("should correctly construct prompt for compaction", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      let capturedHistory: ChatCompletionMessageParam[] = [];
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        capturedHistory = [...history];
        callbacks?.onContent?.("Summary");
        callbacks?.onContentComplete?.("Summary");
        return "Summary";
      });

      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ];

      await compactChatHistory(history, mockModel, mockLlmApi);
      
      // Should have original history plus the compaction prompt
      expect(capturedHistory).toHaveLength(4);
      expect(capturedHistory[3]).toEqual({
        role: "user",
        content: expect.stringContaining("provide a concise summary")
      });
    });

    it("should handle history with tool calls and mixed message types", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "Summary including tool usage";
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.(mockContent);
        callbacks?.onContentComplete?.(mockContent);
        return mockContent;
      });

      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System" },
        { role: "user", content: "Do something" },
        { role: "assistant", content: "I'll help", tool_calls: [{} as any] },
        { role: "tool", content: "Tool result", tool_call_id: "123" },
        { role: "assistant", content: "Done" },
      ];

      const result = await compactChatHistory(history, mockModel, mockLlmApi);
      
      expect(result.compactedHistory).toHaveLength(2);
      expect(result.compactionContent).toBe(mockContent);
    });

    it("should handle very long chat histories", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Long summary");
        callbacks?.onContentComplete?.("Long summary");
        return "Long summary";
      });

      // Create a very long history
      const history: ChatCompletionMessageParam[] = [
        { role: "system", content: "System" },
      ];
      
      for (let i = 0; i < 100; i++) {
        history.push({ role: "user", content: `User message ${i}` });
        history.push({ role: "assistant", content: `Assistant response ${i}` });
      }

      const result = await compactChatHistory(history, mockModel, mockLlmApi);
      
      expect(result.compactedHistory).toHaveLength(2); // System + compaction
      expect(result.compactionIndex).toBe(1);
    });

    it("should handle history without system message", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const mockContent = "Summary without system";
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.(mockContent);
        callbacks?.onContentComplete?.(mockContent);
        return mockContent;
      });

      const history: ChatCompletionMessageParam[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ];

      const result = await compactChatHistory(history, mockModel, mockLlmApi);
      
      expect(result.compactedHistory).toHaveLength(1); // Only compaction
      expect(result.compactedHistory[0].role).toBe("assistant");
      expect(result.compactionIndex).toBe(0);
    });
  });

  describe("property-based tests", () => {
    it("getHistoryForLLM should always return a subset of the original history", () => {
      const testCases: Array<{ history: ChatCompletionMessageParam[], compactionIndex: number | null }> = [
        {
          history: [
            { role: "system", content: "System" },
            { role: "user", content: "User 1" },
            { role: "assistant", content: "Assistant 1" },
          ],
          compactionIndex: 1
        },
        {
          history: [
            { role: "user", content: "User 1" },
            { role: "assistant", content: "Assistant 1" },
            { role: "user", content: "User 2" },
          ],
          compactionIndex: 2
        },
        {
          history: [],
          compactionIndex: null
        }
      ];

      testCases.forEach(({ history, compactionIndex }) => {
        const result = getHistoryForLLM(history, compactionIndex);
        
        // Every message in result should exist in original history
        result.forEach(msg => {
          expect(history).toContainEqual(msg);
        });
        
        // Result length should be <= original length
        expect(result.length).toBeLessThanOrEqual(history.length);
      });
    });

    it("getHistoryForLLM should always include system message if it exists at index 0", () => {
      const systemMessage: ChatCompletionMessageParam = { role: "system", content: "System" };
      const testCases: Array<{ history: ChatCompletionMessageParam[], compactionIndex: number | null }> = [
        {
          history: [
            systemMessage,
            { role: "user", content: "User 1" },
            { role: "assistant", content: `${COMPACTION_MARKER}\nSummary` },
          ],
          compactionIndex: 2
        },
        {
          history: [
            systemMessage,
            { role: "assistant", content: `${COMPACTION_MARKER}\nSummary` },
          ],
          compactionIndex: 1
        }
      ];

      testCases.forEach(({ history, compactionIndex }) => {
        const result = getHistoryForLLM(history, compactionIndex);
        
        if (history[0]?.role === "system" && compactionIndex !== null && compactionIndex > 0) {
          expect(result[0]).toEqual(systemMessage);
        }
      });
    });

    it("compaction should always reduce message count for non-trivial histories", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Summary");
        callbacks?.onContentComplete?.("Summary");
        return "Summary";
      });

      const testHistories: ChatCompletionMessageParam[][] = [
        [
          { role: "system", content: "System" },
          { role: "user", content: "User 1" },
          { role: "assistant", content: "Assistant 1" },
          { role: "user", content: "User 2" },
          { role: "assistant", content: "Assistant 2" },
        ],
        [
          { role: "user", content: "User 1" },
          { role: "assistant", content: "Assistant 1" },
          { role: "user", content: "User 2" },
        ]
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
    it("compactionIndex should always point to a message with COMPACTION_MARKER", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Summary content");
        callbacks?.onContentComplete?.("Summary content");
        return "Summary content";
      });

      const histories: ChatCompletionMessageParam[][] = [
        [{ role: "system", content: "System" }, { role: "user", content: "Hello" }],
        [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi" }],
        [{ role: "system", content: "System" }],
      ];

      for (const history of histories) {
        const result = await compactChatHistory(history, mockModel, mockLlmApi);
        
        // The message at compactionIndex should contain the marker
        const compactionMessage = result.compactedHistory[result.compactionIndex];
        expect(compactionMessage.role).toBe("assistant");
        expect(typeof compactionMessage.content === "string" && compactionMessage.content.startsWith(COMPACTION_MARKER)).toBe(true);
      }
    });

    it("system message should always be preserved in the same position", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Summary");
        callbacks?.onContentComplete?.("Summary");
        return "Summary";
      });

      const systemMessage: ChatCompletionMessageParam = { role: "system", content: "You are helpful" };
      const history: ChatCompletionMessageParam[] = [
        systemMessage,
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ];

      const result = await compactChatHistory(history, mockModel, mockLlmApi);
      
      // System message should still be at index 0
      expect(result.compactedHistory[0]).toEqual(systemMessage);
    });

    it("findCompactionIndex should be consistent with compactChatHistory result", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      
      mockStreamResponse.mockImplementation(async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Summary");
        callbacks?.onContentComplete?.("Summary");
        return "Summary";
      });

      const history: ChatCompletionMessageParam[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ];

      const result = await compactChatHistory(history, mockModel, mockLlmApi);
      
      // findCompactionIndex should find the same index
      const foundIndex = findCompactionIndex(result.compactedHistory);
      expect(foundIndex).toBe(result.compactionIndex);
    });
  });
});