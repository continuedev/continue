import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { convertToUnifiedHistory } from "core/util/messageConversion.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { compactChatHistory } from "./compaction.js";
import { streamChatResponse } from "./stream/streamChatResponse.js";

// Mock the dependencies
vi.mock("./stream/streamChatResponse.js", () => ({
  streamChatResponse: vi.fn(),
}));

vi.mock("./util/tokenizer.js", () => ({
  countChatHistoryItemTokens: vi.fn(),
  countChatHistoryTokens: vi.fn(),
  countToolDefinitionTokens: vi.fn(),
  countTotalInputTokens: vi.fn(),
  getModelContextLimit: vi.fn(),
  getModelMaxTokens: vi.fn(),
}));

describe("compaction infinite loop prevention", () => {
  const mockModel: ModelConfig = {
    name: "test-model",
    provider: "test",
    model: "test-model",
    defaultCompletionOptions: {
      maxTokens: 1000,
      contextLength: 4000,
    },
  } as ModelConfig;

  const mockLlmApi = {} as BaseLlmApi;

  // Keep tokenizer/stream spy call histories isolated per test so exact
  // call-count assertions (e.g. "pruned until it fits") are per-test.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * A history large enough that the pinned prefix + recent tail do not cover
   * it all, so compactChatHistory reaches the pruning loop instead of taking
   * the no-op (everything-fits) early return.
   */
  const buildLargeHistory = () => {
    const history = convertToUnifiedHistory([
      { role: "system", content: "System message" },
      { role: "user", content: "Initial task" },
    ]);
    for (let i = 0; i < 20; i++) {
      history.push({
        message: { role: "assistant", content: `Assistant response ${i}` },
        contextItems: [],
      });
      history.push({
        message: { role: "user", content: `User followup ${i}` },
        contextItems: [],
      });
    }
    return history;
  };

  const setupDefaultMocks = async () => {
    const {
      countChatHistoryItemTokens,
      countChatHistoryTokens,
      getModelContextLimit,
      getModelMaxTokens,
    } = await import("./util/tokenizer.js");
    const mockStreamResponse = vi.mocked(streamChatResponse);

    vi.mocked(getModelContextLimit).mockReturnValue(4000);
    vi.mocked(getModelMaxTokens).mockReturnValue(1000);
    // Per-message token estimate: keep the tail budget (~12K) from covering
    // the whole 40+ message history, so the fold region is non-empty.
    vi.mocked(countChatHistoryItemTokens).mockReturnValue(1000);
    vi.mocked(countChatHistoryTokens).mockReturnValue(5000);

    mockStreamResponse.mockImplementation(
      async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Summary");
        callbacks?.onContentComplete?.("Summary");
        return "Summary";
      },
    );

    return {
      mockStreamResponse,
      mockCountHistoryTokens: vi.mocked(countChatHistoryTokens),
      mockGetContextLimit: vi.mocked(getModelContextLimit),
    };
  };

  it("should not loop infinitely when pruning doesn't reduce history size", async () => {
    const { mockCountHistoryTokens } = await setupDefaultMocks();

    // Token count is always over the available-for-input budget, so the
    // pruning loop must keep pruning and eventually exit (when the history is
    // exhausted) instead of hanging.
    const history = buildLargeHistory();

    const result = await compactChatHistory(history, mockModel, mockLlmApi);

    expect(result.compactedHistory).toBeDefined();
    expect(mockCountHistoryTokens).toHaveBeenCalled();
  });

  it("should not loop infinitely with history ending in assistant message", async () => {
    await setupDefaultMocks();

    // Ends with an assistant message (after a user turn); pruneLastMessage
    // must remove the pair and the loop must terminate.
    const history = buildLargeHistory();
    history.push({
      message: { role: "user", content: "Last user turn" },
      contextItems: [],
    });
    history.push({
      message: { role: "assistant", content: "Last assistant turn" },
      contextItems: [],
    });

    const result = await compactChatHistory(history, mockModel, mockLlmApi);

    expect(result.compactedHistory).toBeDefined();
  });

  it("should successfully prune when pruning actually reduces size", async () => {
    const { mockCountHistoryTokens } = await setupDefaultMocks();

    // Available for input = 4000 - 1000 - 700 (prompt) = 2300. First check is
    // over budget, second is still over, third fits -> loop exits.
    let callCount = 0;
    mockCountHistoryTokens.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return 5000; // Initial too big
      if (callCount === 2) return 3000; // After first prune, still too big
      return 2000; // Subsequent calls fit
    });

    const history = buildLargeHistory();

    const result = await compactChatHistory(history, mockModel, mockLlmApi);

    expect(result.compactedHistory).toBeDefined();
    expect(mockCountHistoryTokens).toHaveBeenCalledTimes(3);
  });
});
