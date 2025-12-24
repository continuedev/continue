import type { ChatHistoryItem } from "core/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as git from "./git.js";
import * as metadata from "./metadata.js";
import { updateAgentMetadata, UpdateAgentMetadataOptions } from "./exit.js";

// Mock dependencies
vi.mock("./git.js");
vi.mock("./metadata.js");
vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("../session.js", () => ({
  getSessionUsage: vi.fn(() => ({
    totalCost: 0,
    promptTokens: 0,
    completionTokens: 0,
    promptTokensDetails: {},
  })),
}));

// Helper to create a mock chat history item
function createMockChatHistoryItem(
  content: string,
  role: "user" | "assistant" | "system" = "assistant",
): ChatHistoryItem {
  return {
    message: {
      role,
      content,
    },
  } as ChatHistoryItem;
}

describe("updateAgentMetadata", () => {
  const mockAgentId = "test-agent-123";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.spyOn(metadata, "getAgentIdFromArgs").mockReturnValue(mockAgentId);
    vi.spyOn(metadata, "postAgentMetadata").mockResolvedValue();
    vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
      additions: 0,
      deletions: 0,
    });
    vi.spyOn(metadata, "extractSummary").mockReturnValue(undefined);
    vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
      diff: "",
      repoFound: false,
    });
  });

  describe("backward compatibility with old signature", () => {
    it("should accept history array directly (old signature)", async () => {
      const history = [
        createMockChatHistoryItem("Hello", "user"),
        createMockChatHistoryItem("Hi there!", "assistant"),
      ];

      await updateAgentMetadata(history);

      expect(metadata.extractSummary).toHaveBeenCalledWith(history);
    });

    it("should treat history array as isComplete=false", async () => {
      const history = [createMockChatHistoryItem("Test message", "assistant")];

      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "diff content",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 5,
        deletions: 2,
      });

      await updateAgentMetadata(history);

      // Should not include isComplete or hasChanges
      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          additions: 5,
          deletions: 2,
        }),
      );
      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.not.objectContaining({
          isComplete: expect.anything(),
          hasChanges: expect.anything(),
        }),
      );
    });
  });

  describe("new signature with UpdateAgentMetadataOptions", () => {
    it("should accept options object with history", async () => {
      const history = [createMockChatHistoryItem("Test", "assistant")];
      const options: UpdateAgentMetadataOptions = {
        history,
        isComplete: false,
      };

      await updateAgentMetadata(options);

      expect(metadata.extractSummary).toHaveBeenCalledWith(history);
    });

    it("should accept options object with isComplete=true", async () => {
      const options: UpdateAgentMetadataOptions = {
        isComplete: true,
      };

      await updateAgentMetadata(options);

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          isComplete: true,
          hasChanges: false,
        }),
      );
    });

    it("should accept options object with both history and isComplete", async () => {
      const history = [createMockChatHistoryItem("Done!", "assistant")];
      const options: UpdateAgentMetadataOptions = {
        history,
        isComplete: true,
      };

      vi.spyOn(metadata, "extractSummary").mockReturnValue("Done!");

      await updateAgentMetadata(options);

      expect(metadata.extractSummary).toHaveBeenCalledWith(history);
      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          isComplete: true,
          summary: "Done!",
        }),
      );
    });
  });

  describe("isComplete flag behavior", () => {
    it("should set isComplete=true and hasChanges=false when no changes", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "",
        repoFound: true,
      });

      await updateAgentMetadata({ isComplete: true });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          isComplete: true,
          hasChanges: false,
        }),
      );
    });

    it("should set isComplete=true and hasChanges=true when changes exist", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "some diff content",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 10,
        deletions: 5,
      });

      await updateAgentMetadata({ isComplete: true });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          isComplete: true,
          hasChanges: true,
          additions: 10,
          deletions: 5,
        }),
      );
    });

    it("should set hasChanges=true even with only additions", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "diff content",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 5,
        deletions: 0,
      });

      await updateAgentMetadata({ isComplete: true });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          hasChanges: true,
          additions: 5,
        }),
      );
    });

    it("should set hasChanges=true even with only deletions", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "diff content",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 0,
        deletions: 3,
      });

      await updateAgentMetadata({ isComplete: true });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          hasChanges: true,
          deletions: 3,
        }),
      );
    });

    it("should not include isComplete/hasChanges when isComplete=false", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "some diff",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 5,
        deletions: 2,
      });

      await updateAgentMetadata({ isComplete: false });

      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty("isComplete");
      expect(callArgs).not.toHaveProperty("hasChanges");
    });

    it("should default to isComplete=false when not specified in options", async () => {
      await updateAgentMetadata({});

      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty("isComplete");
      expect(callArgs).not.toHaveProperty("hasChanges");
    });
  });

  describe("diff stats collection", () => {
    it("should collect diff stats when repo found with changes", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "diff content",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 15,
        deletions: 8,
      });

      await updateAgentMetadata({});

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          additions: 15,
          deletions: 8,
        }),
      );
    });

    it("should not include diff stats when no changes", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 0,
        deletions: 0,
      });

      await updateAgentMetadata({});

      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty("additions");
      expect(callArgs).not.toHaveProperty("deletions");
    });

    it("should not include diff stats when repo not found", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "",
        repoFound: false,
      });

      await updateAgentMetadata({});

      expect(metadata.calculateDiffStats).not.toHaveBeenCalled();
    });

    it("should handle git diff errors gracefully", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockRejectedValue(
        new Error("Git error"),
      );

      await expect(updateAgentMetadata({})).resolves.not.toThrow();

      // Should still call postAgentMetadata but without diff stats
      expect(metadata.postAgentMetadata).toHaveBeenCalled();
    });
  });

  describe("summary extraction", () => {
    it("should extract summary from history", async () => {
      const history = [createMockChatHistoryItem("Summary text", "assistant")];
      vi.spyOn(metadata, "extractSummary").mockReturnValue("Summary text");

      await updateAgentMetadata({ history });

      expect(metadata.extractSummary).toHaveBeenCalledWith(history);
      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          summary: "Summary text",
        }),
      );
    });

    it("should not include summary when history is empty", async () => {
      await updateAgentMetadata({ history: [] });

      expect(metadata.extractSummary).toHaveBeenCalledWith([]);
      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty("summary");
    });

    it("should not include summary when history is undefined", async () => {
      await updateAgentMetadata({});

      expect(metadata.extractSummary).toHaveBeenCalledWith(undefined);
      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty("summary");
    });

    it("should handle extractSummary errors gracefully", async () => {
      const history = [createMockChatHistoryItem("Test", "assistant")];
      vi.spyOn(metadata, "extractSummary").mockImplementation(() => {
        throw new Error("Extract error");
      });

      await expect(updateAgentMetadata({ history })).resolves.not.toThrow();
    });
  });

  describe("session usage collection", () => {
    it("should include usage when cost > 0", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.05,
        promptTokens: 1000,
        completionTokens: 500,
        promptTokensDetails: {
          cachedTokens: 100,
          cacheWriteTokens: 50,
        },
      });

      await updateAgentMetadata({});

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          usage: {
            totalCost: 0.05,
            promptTokens: 1000,
            completionTokens: 500,
            cachedTokens: 100,
            cacheWriteTokens: 50,
          },
        }),
      );
    });

    it("should not include usage when cost is 0", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: {},
      });

      await updateAgentMetadata({});

      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty("usage");
    });

    it("should round totalCost to 6 decimal places", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.123456789,
        promptTokens: 1000,
        completionTokens: 500,
        promptTokensDetails: {},
      });

      await updateAgentMetadata({});

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          usage: expect.objectContaining({
            totalCost: 0.123457, // Rounded to 6 decimals
          }),
        }),
      );
    });

    it("should omit cachedTokens when not present", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.01,
        promptTokens: 100,
        completionTokens: 50,
        promptTokensDetails: {},
      });

      await updateAgentMetadata({});

      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs.usage).not.toHaveProperty("cachedTokens");
      expect(callArgs.usage).not.toHaveProperty("cacheWriteTokens");
    });

    it("should handle getSessionUsage errors gracefully", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockImplementation(() => {
        throw new Error("Session error");
      });

      await expect(updateAgentMetadata({})).resolves.not.toThrow();
    });
  });

  describe("agent ID handling", () => {
    it("should skip metadata update when no agent ID", async () => {
      vi.spyOn(metadata, "getAgentIdFromArgs").mockReturnValue(undefined);

      await updateAgentMetadata({});

      expect(metadata.postAgentMetadata).not.toHaveBeenCalled();
    });

    it("should use agent ID from process args", async () => {
      const customAgentId = "custom-agent-456";
      vi.spyOn(metadata, "getAgentIdFromArgs").mockReturnValue(customAgentId);

      await updateAgentMetadata({});

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        customAgentId,
        expect.any(Object),
      );
    });
  });

  describe("metadata posting", () => {
    it("should not post when metadata object is empty", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "",
        repoFound: false,
      });
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: {},
      });

      await updateAgentMetadata({});

      expect(metadata.postAgentMetadata).not.toHaveBeenCalled();
    });

    it("should post metadata when any field is present", async () => {
      const history = [createMockChatHistoryItem("Test", "assistant")];
      vi.spyOn(metadata, "extractSummary").mockReturnValue("Test");

      await updateAgentMetadata({ history });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          summary: "Test",
        }),
      );
    });

    it("should handle postAgentMetadata errors gracefully", async () => {
      vi.spyOn(metadata, "postAgentMetadata").mockRejectedValue(
        new Error("API error"),
      );
      const history = [createMockChatHistoryItem("Test", "assistant")];
      vi.spyOn(metadata, "extractSummary").mockReturnValue("Test");

      await expect(updateAgentMetadata({ history })).resolves.not.toThrow();
    });
  });

  describe("comprehensive integration scenarios", () => {
    it("should collect all metadata when available with isComplete=true", async () => {
      const history = [
        createMockChatHistoryItem("User request", "user"),
        createMockChatHistoryItem("Assistant response", "assistant"),
      ];

      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "diff content",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 20,
        deletions: 10,
      });
      vi.spyOn(metadata, "extractSummary").mockReturnValue(
        "Assistant response",
      );

      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.075,
        promptTokens: 2000,
        completionTokens: 1000,
        promptTokensDetails: {
          cachedTokens: 500,
          cacheWriteTokens: 100,
        },
      });

      await updateAgentMetadata({ history, isComplete: true });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(mockAgentId, {
        additions: 20,
        deletions: 10,
        isComplete: true,
        hasChanges: true,
        summary: "Assistant response",
        usage: {
          totalCost: 0.075,
          promptTokens: 2000,
          completionTokens: 1000,
          cachedTokens: 500,
          cacheWriteTokens: 100,
        },
      });
    });

    it("should handle partial metadata with isComplete=false", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "",
        repoFound: true,
      });

      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.01,
        promptTokens: 100,
        completionTokens: 50,
        promptTokensDetails: {},
      });

      await updateAgentMetadata({ isComplete: false });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(mockAgentId, {
        usage: {
          totalCost: 0.01,
          promptTokens: 100,
          completionTokens: 50,
        },
      });
    });
  });

  describe("edge cases", () => {
    it("should handle undefined options", async () => {
      await expect(updateAgentMetadata(undefined)).resolves.not.toThrow();
    });

    it("should handle empty options object", async () => {
      await expect(updateAgentMetadata({})).resolves.not.toThrow();
    });

    it("should handle null history in options", async () => {
      await expect(
        updateAgentMetadata({ history: null as any }),
      ).resolves.not.toThrow();
    });

    it("should distinguish between empty array and undefined history", async () => {
      // Empty array
      await updateAgentMetadata({ history: [] });
      expect(metadata.extractSummary).toHaveBeenCalledWith([]);

      vi.clearAllMocks();

      // Undefined history
      await updateAgentMetadata({});
      expect(metadata.extractSummary).toHaveBeenCalledWith(undefined);
    });
  });

  describe("concurrency and race conditions", () => {
    it("should handle multiple simultaneous calls", async () => {
      const history = [createMockChatHistoryItem("Test", "assistant")];
      vi.spyOn(metadata, "extractSummary").mockReturnValue("Test");

      // Simulate multiple concurrent updates
      const promises = [
        updateAgentMetadata({ history }),
        updateAgentMetadata({ history }),
        updateAgentMetadata({ history }),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(metadata.postAgentMetadata).toHaveBeenCalledTimes(3);
    });

    it("should handle interleaved isComplete true/false calls", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "changes",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 5,
        deletions: 2,
      });

      await updateAgentMetadata({ isComplete: false });
      await updateAgentMetadata({ isComplete: true });
      await updateAgentMetadata({ isComplete: false });

      const calls = (metadata.postAgentMetadata as any).mock.calls;
      expect(calls[0][1]).not.toHaveProperty("isComplete");
      expect(calls[1][1]).toHaveProperty("isComplete", true);
      expect(calls[2][1]).not.toHaveProperty("isComplete");
    });

    it("should handle slow git diff with fast metadata posting", async () => {
      let resolveGitDiff: (value: any) => void;
      const gitDiffPromise = new Promise((resolve) => {
        resolveGitDiff = resolve;
      });

      vi.spyOn(git, "getGitDiffSnapshot").mockReturnValue(
        gitDiffPromise as any,
      );
      vi.spyOn(metadata, "extractSummary").mockReturnValue("Fast summary");

      const history = [createMockChatHistoryItem("Test", "assistant")];
      const updatePromise = updateAgentMetadata({ history });

      // Resolve git diff after a delay
      setTimeout(() => {
        resolveGitDiff!({ diff: "delayed diff", repoFound: true });
      }, 10);

      await updatePromise;
      expect(metadata.postAgentMetadata).toHaveBeenCalled();
    });
  });

  describe("boundary value testing", () => {
    it("should handle very large history arrays", async () => {
      const largeHistory = Array.from({ length: 10000 }, (_, i) =>
        createMockChatHistoryItem(`Message ${i}`, "assistant"),
      );
      vi.spyOn(metadata, "extractSummary").mockReturnValue("Summary");

      await expect(
        updateAgentMetadata({ history: largeHistory }),
      ).resolves.not.toThrow();
      expect(metadata.extractSummary).toHaveBeenCalledWith(largeHistory);
    });

    it("should handle very large diff stats", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "large diff",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 999999,
        deletions: 888888,
      });

      await updateAgentMetadata({ isComplete: true });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          additions: 999999,
          deletions: 888888,
          hasChanges: true,
        }),
      );
    });

    it("should handle very small token costs", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.000001,
        promptTokens: 1,
        completionTokens: 1,
        promptTokensDetails: {},
      });

      await updateAgentMetadata({});

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          usage: expect.objectContaining({
            totalCost: 0.000001,
          }),
        }),
      );
    });

    it("should handle maximum precision cost rounding", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.123456789012345,
        promptTokens: 1000,
        completionTokens: 500,
        promptTokensDetails: {},
      });

      await updateAgentMetadata({});

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          usage: expect.objectContaining({
            totalCost: 0.123457, // Rounded to 6 decimals
          }),
        }),
      );
    });

    it("should handle zero values in all fields", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 0,
        deletions: 0,
      });
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: {},
      });

      await updateAgentMetadata({ history: [] });

      expect(metadata.postAgentMetadata).not.toHaveBeenCalled();
    });
  });

  describe("complex state transitions", () => {
    it("should handle transition from no data to complete with data", async () => {
      // First call: no data
      await updateAgentMetadata({});
      expect(metadata.postAgentMetadata).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // Second call: complete with data
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "new changes",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 10,
        deletions: 5,
      });

      await updateAgentMetadata({ isComplete: true });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          isComplete: true,
          hasChanges: true,
        }),
      );
    });

    it("should handle summary changing between calls", async () => {
      const history1 = [createMockChatHistoryItem("First", "assistant")];
      const history2 = [createMockChatHistoryItem("Second", "assistant")];

      vi.spyOn(metadata, "extractSummary")
        .mockReturnValueOnce("First")
        .mockReturnValueOnce("Second");

      await updateAgentMetadata({ history: history1 });
      await updateAgentMetadata({ history: history2 });

      const calls = (metadata.postAgentMetadata as any).mock.calls;
      expect(calls[0][1].summary).toBe("First");
      expect(calls[1][1].summary).toBe("Second");
    });

    it("should handle diff stats changing between calls", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockResolvedValue({
        diff: "changes",
        repoFound: true,
      });
      vi.spyOn(metadata, "calculateDiffStats")
        .mockReturnValueOnce({ additions: 5, deletions: 2 })
        .mockReturnValueOnce({ additions: 15, deletions: 8 });

      await updateAgentMetadata({});
      await updateAgentMetadata({});

      const calls = (metadata.postAgentMetadata as any).mock.calls;
      expect(calls[0][1]).toMatchObject({ additions: 5, deletions: 2 });
      expect(calls[1][1]).toMatchObject({ additions: 15, deletions: 8 });
    });
  });

  describe("error recovery scenarios", () => {
    it("should recover from git diff timeout", async () => {
      vi.spyOn(git, "getGitDiffSnapshot")
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValueOnce({ diff: "success", repoFound: true });

      vi.spyOn(metadata, "calculateDiffStats").mockReturnValue({
        additions: 5,
        deletions: 2,
      });

      // First call fails
      await updateAgentMetadata({});
      expect(metadata.postAgentMetadata).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // Second call succeeds
      await updateAgentMetadata({});
      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({ additions: 5 }),
      );
    });

    it("should handle all collectors failing", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockRejectedValue(
        new Error("Git error"),
      );
      vi.spyOn(metadata, "extractSummary").mockImplementation(() => {
        throw new Error("Summary error");
      });
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockImplementation(() => {
        throw new Error("Session error");
      });

      await expect(updateAgentMetadata({})).resolves.not.toThrow();
      expect(metadata.postAgentMetadata).not.toHaveBeenCalled();
    });

    it("should handle partial collector failures", async () => {
      vi.spyOn(git, "getGitDiffSnapshot").mockRejectedValue(
        new Error("Git error"),
      );
      vi.spyOn(metadata, "extractSummary").mockReturnValue("Working summary");

      const history = [createMockChatHistoryItem("Test", "assistant")];
      await updateAgentMetadata({ history });

      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({
          summary: "Working summary",
        }),
      );
      expect(metadata.postAgentMetadata).toHaveBeenCalledWith(
        mockAgentId,
        expect.not.objectContaining({
          additions: expect.anything(),
        }),
      );
    });
  });

  describe("cache token details handling", () => {
    it("should include only cachedTokens when cacheWriteTokens is 0", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.01,
        promptTokens: 100,
        completionTokens: 50,
        promptTokensDetails: {
          cachedTokens: 50,
          cacheWriteTokens: 0,
        },
      });

      await updateAgentMetadata({});

      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs.usage.cachedTokens).toBe(50);
      expect(callArgs.usage).not.toHaveProperty("cacheWriteTokens");
    });

    it("should include only cacheWriteTokens when cachedTokens is 0", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.01,
        promptTokens: 100,
        completionTokens: 50,
        promptTokensDetails: {
          cachedTokens: 0,
          cacheWriteTokens: 25,
        },
      });

      await updateAgentMetadata({});

      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs.usage).not.toHaveProperty("cachedTokens");
      expect(callArgs.usage.cacheWriteTokens).toBe(25);
    });

    it("should handle undefined promptTokensDetails", async () => {
      const { getSessionUsage } = await import("../session.js");
      vi.mocked(getSessionUsage).mockReturnValue({
        totalCost: 0.01,
        promptTokens: 100,
        completionTokens: 50,
        promptTokensDetails: undefined as any,
      });

      await updateAgentMetadata({});

      const callArgs = (metadata.postAgentMetadata as any).mock.calls[0][1];
      expect(callArgs.usage).not.toHaveProperty("cachedTokens");
      expect(callArgs.usage).not.toHaveProperty("cacheWriteTokens");
    });
  });
});
