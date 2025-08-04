import { describe, it, expect, vi } from "vitest";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { compactChatHistory, findCompactionIndex, getHistoryForLLM, COMPACTION_MARKER } from "./compaction.js";
import { streamChatResponse } from "./streamChatResponse.js";
import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";

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
  });
});