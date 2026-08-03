import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { convertToUnifiedHistory } from "core/util/messageConversion.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  const mockLlmApi = {} as BaseLlmApi;

  // Keep the streamChatResponse spy's call history isolated per test; mock
  // implementations set via stubSummaryStream persist across tests.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Builds a history large enough that a compaction has a real fold region:
   * a pinned prefix (system + small first user turn) followed by many turns
   * with large tool results, so the middle exceeds the recent-tail budget.
   */
  const buildLargeHistory = (): ChatHistoryItem[] => {
    const history = convertToUnifiedHistory([
      { role: "system", content: "System message" },
      { role: "user", content: "Initial task: implement feature X" },
    ]);
    for (let i = 0; i < 40; i++) {
      history.push({
        message: { role: "assistant", content: `Assistant response ${i}` },
        contextItems: [],
      });
      history.push({
        message: {
          role: "tool",
          content: "x".repeat(4000),
          tool_call_id: `tool-${i}`,
        },
        contextItems: [],
      });
      history.push({
        message: { role: "user", content: `User followup ${i}` },
        contextItems: [],
      });
    }
    return history;
  };

  const stubSummaryStream = (mockContent = "This is a summary") => {
    const mockStreamResponse = vi.mocked(streamChatResponse);
    mockStreamResponse.mockImplementation(
      async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.(mockContent);
        callbacks?.onContentComplete?.(mockContent);
        return mockContent;
      },
    );
    return mockContent;
  };

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

    it("should return the full compacted history, preserving the pinned prefix", () => {
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
      history[3].conversationSummary = "This is a summary";

      // The stored history already IS the compacted history (pinned prefix +
      // summary + recent tail), so it must be sent in full — trimming before
      // the compaction index would drop the cache-stable prefix.
      const result = getHistoryForLLM(history, 3);
      expect(result).toEqual(history);
      expect(result).toHaveLength(5);
    });

    it("should return full history for out-of-bounds, negative, empty, and system-only cases", () => {
      const history = convertToUnifiedHistory([
        { role: "system", content: "System message" },
        { role: "user", content: "Hello" },
      ]);

      expect(getHistoryForLLM(history, 10)).toEqual(history);
      expect(getHistoryForLLM(history, -1)).toEqual(history);
      expect(getHistoryForLLM([], 0)).toEqual([]);
      expect(
        getHistoryForLLM(
          convertToUnifiedHistory([{ role: "system", content: "System" }]),
          0,
        ),
      ).toEqual(
        convertToUnifiedHistory([{ role: "system", content: "System" }]),
      );
    });
  });

  describe("compactChatHistory", () => {
    it("should preserve pinned prefix and recent tail when compacting a large history", async () => {
      const mockContent = stubSummaryStream("Structured summary");
      const history = buildLargeHistory();

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      // Pinned prefix: system message + first user turn kept verbatim
      expect(result.compactedHistory[0]).toEqual(history[0]);
      expect(result.compactedHistory[1]).toEqual(history[1]);

      // compactionIndex points at the new summary
      expect(
        result.compactedHistory[result.compactionIndex].conversationSummary,
      ).toBe(mockContent);
      // The summary is spliced in the middle: not first, not last
      expect(result.compactionIndex).toBeGreaterThan(0);
      expect(result.compactionIndex).toBeLessThan(
        result.compactedHistory.length - 1,
      );

      // Recent tail preserved verbatim
      expect(
        result.compactedHistory[result.compactedHistory.length - 1],
      ).toEqual(history[history.length - 1]);

      // Compaction actually reduced the message count
      expect(result.compactedHistory.length).toBeLessThan(history.length);
    });

    it("should return history unchanged (no-op) when everything fits", async () => {
      const mockStreamResponse = vi.mocked(streamChatResponse);
      const history = convertToUnifiedHistory([
        { role: "system", content: "System" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ]);

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      expect(result.compactedHistory).toEqual(history);
      expect(result.compactionContent).toBe("");
      // Nothing worth folding — the summarizer must not be called
      expect(mockStreamResponse).not.toHaveBeenCalled();
    });

    it("should handle history without system message", async () => {
      const mockContent = stubSummaryStream("Summary without system");
      const history = buildLargeHistory().slice(1); // drop the system message

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      // First user turn pinned verbatim
      expect(result.compactedHistory[0]).toEqual(history[0]);
      expect(
        result.compactedHistory[result.compactionIndex].conversationSummary,
      ).toBe(mockContent);
      expect(result.compactionIndex).toBe(1);
    });

    it("should keep prior digests verbatim in the pinned prefix", async () => {
      stubSummaryStream("New summary");
      const history = buildLargeHistory();
      const priorDigest: ChatHistoryItem = {
        message: { role: "assistant", content: "Earlier digest" },
        contextItems: [],
        conversationSummary: "Earlier digest",
      };
      history.splice(2, 0, priorDigest);

      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      // The prior digest must survive before the new summary
      const priorIdx = result.compactedHistory.findIndex(
        (item) => item.conversationSummary === "Earlier digest",
      );
      const newIdx = result.compactedHistory.findIndex(
        (item) => item.conversationSummary === "New summary",
      );
      expect(priorIdx).toBeGreaterThanOrEqual(0);
      expect(newIdx).toBeGreaterThan(priorIdx);
    });

    it("should call callbacks correctly", async () => {
      const onStreamContent = vi.fn();
      const onStreamComplete = vi.fn();
      const mockStreamResponse = vi.mocked(streamChatResponse);
      mockStreamResponse.mockImplementation(
        async (history, model, api, controller, callbacks) => {
          callbacks?.onContent?.("Summary ");
          callbacks?.onContent?.("content");
          callbacks?.onContentComplete?.("Summary content");
          return "Summary content";
        },
      );

      await compactChatHistory(buildLargeHistory(), mockModel, mockLlmApi, {
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

      await expect(
        compactChatHistory(buildLargeHistory(), mockModel, mockLlmApi, {
          callbacks: { onError },
        }),
      ).rejects.toThrow("Stream failed");

      expect(onError).toHaveBeenCalledWith(mockError);
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

      await compactChatHistory(buildLargeHistory(), mockModel, mockLlmApi);

      // The compaction prompt is appended to the history sent to the summarizer
      const lastMessage = capturedHistory[capturedHistory.length - 1];
      expect(lastMessage.message.role).toBe("user");
      expect(lastMessage.message.content).toContain("## Standing facts");
      expect(lastMessage.message.content).toContain("## Pending & next step");
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

      const result = await compactChatHistory(
        buildLargeHistory(),
        mockModel,
        mockLlmApi,
      );

      expect(result.compactionContent).toBe("");
      expect(
        result.compactedHistory[result.compactionIndex].message.content,
      ).toBe("");
    });
  });

  describe("invariant tests", () => {
    it("compactionIndex should always point to a message with conversationSummary", async () => {
      stubSummaryStream("Summary content");

      const result = await compactChatHistory(
        buildLargeHistory(),
        mockModel,
        mockLlmApi,
      );

      const compactionMessage = result.compactedHistory[result.compactionIndex];
      expect(compactionMessage.message.role).toBe("assistant");
      expect(compactionMessage.conversationSummary).toBeDefined();
    });

    it("system message should always be preserved in the same position", async () => {
      stubSummaryStream("Summary");

      const history = buildLargeHistory();
      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      expect(result.compactedHistory[0]).toEqual(history[0]);
    });

    it("findCompactionIndex should be consistent with compactChatHistory result", async () => {
      stubSummaryStream("Summary");

      const result = await compactChatHistory(
        buildLargeHistory(),
        mockModel,
        mockLlmApi,
      );

      const foundIndex = findCompactionIndex(result.compactedHistory);
      expect(foundIndex).toBe(result.compactionIndex);
    });

    it("compaction should always reduce message count for a large history", async () => {
      stubSummaryStream("Summary");

      const history = buildLargeHistory();
      const result = await compactChatHistory(history, mockModel, mockLlmApi);

      expect(result.compactedHistory.length).toBeLessThan(history.length);
    });
  });
});
