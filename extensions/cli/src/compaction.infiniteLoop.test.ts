import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { convertToUnifiedHistory } from "core/util/messageConversion.js";
import { describe, expect, it, vi } from "vitest";

import { compactChatHistory } from "./compaction.js";
import { streamChatResponse } from "./stream/streamChatResponse.js";

// Mock the dependencies
vi.mock("./stream/streamChatResponse.js", () => ({
  streamChatResponse: vi.fn(),
}));

vi.mock("./util/tokenizer.js", () => ({
  countChatHistoryTokens: vi.fn(),
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

  it("should not loop infinitely when pruning doesn't reduce history size", async () => {
    const { countChatHistoryTokens, getModelContextLimit } = await import(
      "./util/tokenizer.js"
    );
    const mockStreamResponse = vi.mocked(streamChatResponse);
    const mockCountTokens = vi.mocked(countChatHistoryTokens);
    const mockGetContextLimit = vi.mocked(getModelContextLimit);

    // Setup mocks
    mockGetContextLimit.mockReturnValue(4000);
    mockCountTokens.mockReturnValue(5000); // Always too big
    mockStreamResponse.mockImplementation(
      async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Summary");
        callbacks?.onContentComplete?.("Summary");
        return "Summary";
      },
    );

    // History that can't be pruned further (only system message)
    const history = convertToUnifiedHistory([
      { role: "system", content: "System message" },
    ]);

    // This should not hang - it should break out of the loop
    const result = await compactChatHistory(history, mockModel, mockLlmApi);

    // Should complete successfully even though token count is still too high
    expect(result.compactedHistory).toBeDefined();
    expect(mockCountTokens).toHaveBeenCalled();
  });

  it("should not loop infinitely with history ending in assistant message", async () => {
    const { countChatHistoryTokens, getModelContextLimit } = await import(
      "./util/tokenizer.js"
    );
    const mockStreamResponse = vi.mocked(streamChatResponse);
    const mockCountTokens = vi.mocked(countChatHistoryTokens);
    const mockGetContextLimit = vi.mocked(getModelContextLimit);

    // Setup mocks
    mockGetContextLimit.mockReturnValue(4000);
    mockCountTokens.mockReturnValue(5000); // Always too big
    mockStreamResponse.mockImplementation(
      async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Summary");
        callbacks?.onContentComplete?.("Summary");
        return "Summary";
      },
    );

    // History that ends with assistant - pruning won't change it
    const history = convertToUnifiedHistory([
      { role: "system", content: "System message" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);

    // This should not hang
    const result = await compactChatHistory(history, mockModel, mockLlmApi);

    expect(result.compactedHistory).toBeDefined();
  });

  it("should successfully prune when pruning actually reduces size", async () => {
    const { countChatHistoryTokens, getModelContextLimit } = await import(
      "./util/tokenizer.js"
    );
    const mockStreamResponse = vi.mocked(streamChatResponse);
    const mockCountTokens = vi.mocked(countChatHistoryTokens);
    const mockGetContextLimit = vi.mocked(getModelContextLimit);

    // Setup mocks
    mockGetContextLimit.mockReturnValue(4000);

    // Mock token counting to show reduction after pruning
    let callCount = 0;
    mockCountTokens.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return 5000; // Initial too big
      if (callCount === 2) return 3000; // After pruning, fits
      return 2000; // Subsequent calls
    });

    mockStreamResponse.mockImplementation(
      async (history, model, api, controller, callbacks) => {
        callbacks?.onContent?.("Summary");
        callbacks?.onContentComplete?.("Summary");
        return "Summary";
      },
    );

    // History that can be successfully pruned
    const history = convertToUnifiedHistory([
      { role: "system", content: "System message" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "Another question" },
    ]);

    const result = await compactChatHistory(history, mockModel, mockLlmApi);

    expect(result.compactedHistory).toBeDefined();
    // The function will call countTokens multiple times during the process
    expect(mockCountTokens).toHaveBeenCalled();
  });
});
