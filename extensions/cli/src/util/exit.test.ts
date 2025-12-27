import type { ChatHistoryItem } from "core/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UpdateAgentMetadataOptions } from "./exit.js";
import { updateAgentMetadata } from "./exit.js";

// Mock dependencies
vi.mock("./git.js", () => ({
  getGitDiffSnapshot: vi.fn(),
}));

vi.mock("./metadata.js", () => ({
  calculateDiffStats: vi.fn(),
  extractSummary: vi.fn(),
  getAgentIdFromArgs: vi.fn(),
  postAgentMetadata: vi.fn(),
}));

vi.mock("../session.js", () => ({
  getSessionUsage: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to create mock chat history
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
  let mockGetGitDiffSnapshot: any;
  let mockCalculateDiffStats: any;
  let mockExtractSummary: any;
  let mockGetAgentIdFromArgs: any;
  let mockPostAgentMetadata: any;
  let mockGetSessionUsage: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked modules
    const gitModule = await import("./git.js");
    const metadataModule = await import("./metadata.js");
    const sessionModule = await import("../session.js");

    mockGetGitDiffSnapshot = vi.mocked(gitModule.getGitDiffSnapshot);
    mockCalculateDiffStats = vi.mocked(metadataModule.calculateDiffStats);
    mockExtractSummary = vi.mocked(metadataModule.extractSummary);
    mockGetAgentIdFromArgs = vi.mocked(metadataModule.getAgentIdFromArgs);
    mockPostAgentMetadata = vi.mocked(metadataModule.postAgentMetadata);
    mockGetSessionUsage = vi.mocked(sessionModule.getSessionUsage);

    // Default mocks
    mockGetAgentIdFromArgs.mockReturnValue("test-agent-id");
    mockGetGitDiffSnapshot.mockResolvedValue({
      diff: "",
      repoFound: true,
    });
    mockCalculateDiffStats.mockReturnValue({ additions: 0, deletions: 0 });
    mockExtractSummary.mockReturnValue(undefined);
    mockGetSessionUsage.mockReturnValue({
      totalCost: 0,
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: {
        cachedTokens: 0,
        cacheWriteTokens: 0,
      },
    });
    mockPostAgentMetadata.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("backward compatibility", () => {
    it("should accept history array (old signature)", async () => {
      const history = [createMockChatHistoryItem("Test message", "assistant")];

      mockExtractSummary.mockReturnValue("Test message");

      await updateAgentMetadata(history);

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        summary: "Test message",
      });
    });

    it("should accept options object with history (new signature)", async () => {
      const history = [createMockChatHistoryItem("Test message", "assistant")];
      const options: UpdateAgentMetadataOptions = { history };

      mockExtractSummary.mockReturnValue("Test message");

      await updateAgentMetadata(options);

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        summary: "Test message",
      });
    });

    it("should accept undefined (no arguments)", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "diff content",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 5, deletions: 3 });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        additions: 5,
        deletions: 3,
      });
    });
  });

  describe("isComplete flag", () => {
    it("should not include completion flags when isComplete is false", async () => {
      const options: UpdateAgentMetadataOptions = {
        history: [],
        isComplete: false,
      };

      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "some diff",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 2, deletions: 1 });

      await updateAgentMetadata(options);

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        additions: 2,
        deletions: 1,
      });
    });

    it("should include isComplete and hasChanges when isComplete is true with changes", async () => {
      const options: UpdateAgentMetadataOptions = {
        history: [],
        isComplete: true,
      };

      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "diff content",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 5, deletions: 3 });

      await updateAgentMetadata(options);

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        additions: 5,
        deletions: 3,
        isComplete: true,
        hasChanges: true,
      });
    });

    it("should include isComplete and hasChanges=false when no changes", async () => {
      const options: UpdateAgentMetadataOptions = {
        history: [],
        isComplete: true,
      };

      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 0, deletions: 0 });

      await updateAgentMetadata(options);

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        isComplete: true,
        hasChanges: false,
      });
    });

    it("should default isComplete to false when not provided in options", async () => {
      const options: UpdateAgentMetadataOptions = {
        history: [],
      };

      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "diff content",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 2, deletions: 1 });

      await updateAgentMetadata(options);

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        additions: 2,
        deletions: 1,
      });
    });
  });

  describe("diff stats collection", () => {
    it("should include diff stats when changes exist", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "some diff content",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 10, deletions: 5 });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        additions: 10,
        deletions: 5,
      });
    });

    it("should not include diff stats when no changes", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 0, deletions: 0 });
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0.5,
        promptTokens: 100,
        completionTokens: 50,
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        usage: {
          totalCost: 0.5,
          promptTokens: 100,
          completionTokens: 50,
        },
      });
    });

    it("should handle git diff errors gracefully", async () => {
      mockGetGitDiffSnapshot.mockRejectedValue(new Error("Git error"));

      await updateAgentMetadata();

      // Should still work without diff stats
      expect(mockPostAgentMetadata).not.toHaveBeenCalled(); // No metadata to post
    });

    it("should not include diff stats when repo not found", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "",
        repoFound: false,
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });
  });

  describe("summary collection", () => {
    it("should include summary from conversation history", async () => {
      const history = [
        createMockChatHistoryItem("User question", "user"),
        createMockChatHistoryItem(
          "I've completed the requested changes",
          "assistant",
        ),
      ];

      mockExtractSummary.mockReturnValue(
        "I've completed the requested changes",
      );

      await updateAgentMetadata({ history });

      expect(mockExtractSummary).toHaveBeenCalledWith(history);
      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        summary: "I've completed the requested changes",
      });
    });

    it("should not include summary when history is empty", async () => {
      await updateAgentMetadata({ history: [] });

      expect(mockExtractSummary).not.toHaveBeenCalled();
      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });

    it("should not include summary when history is undefined", async () => {
      await updateAgentMetadata({});

      expect(mockExtractSummary).not.toHaveBeenCalled();
    });

    it("should handle summary extraction errors gracefully", async () => {
      const history = [createMockChatHistoryItem("Test message", "assistant")];
      mockExtractSummary.mockImplementation(() => {
        throw new Error("Summary error");
      });

      // Should not throw
      await updateAgentMetadata({ history });

      // Should still attempt to post metadata (without summary)
      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });
  });

  describe("session usage collection", () => {
    it("should include usage when cost > 0", async () => {
      mockGetSessionUsage.mockReturnValue({
        totalCost: 1.234567,
        promptTokens: 1000,
        completionTokens: 500,
        promptTokensDetails: {
          cachedTokens: 200,
          cacheWriteTokens: 100,
        },
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        usage: {
          totalCost: 1.234567,
          promptTokens: 1000,
          completionTokens: 500,
          cachedTokens: 200,
          cacheWriteTokens: 100,
        },
      });
    });

    it("should round totalCost to 6 decimal places", async () => {
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0.123456789,
        promptTokens: 100,
        completionTokens: 50,
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        usage: {
          totalCost: 0.123457,
          promptTokens: 100,
          completionTokens: 50,
        },
      });
    });

    it("should not include usage when totalCost is 0", async () => {
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });

    it("should omit cache token fields when not present", async () => {
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0.5,
        promptTokens: 100,
        completionTokens: 50,
        promptTokensDetails: {},
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        usage: {
          totalCost: 0.5,
          promptTokens: 100,
          completionTokens: 50,
        },
      });
    });

    it("should include cachedTokens when present but not cacheWriteTokens", async () => {
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0.5,
        promptTokens: 100,
        completionTokens: 50,
        promptTokensDetails: {
          cachedTokens: 25,
        },
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        usage: {
          totalCost: 0.5,
          promptTokens: 100,
          completionTokens: 50,
          cachedTokens: 25,
        },
      });
    });

    it("should handle usage errors gracefully", async () => {
      mockGetSessionUsage.mockImplementation(() => {
        throw new Error("Usage error");
      });

      // Should not throw
      await updateAgentMetadata();

      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });
  });

  describe("combined metadata", () => {
    it("should combine all metadata types", async () => {
      const history = [createMockChatHistoryItem("Complete task", "assistant")];

      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "diff content",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 5, deletions: 2 });
      mockExtractSummary.mockReturnValue("Complete task");
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0.123456,
        promptTokens: 200,
        completionTokens: 100,
      });

      await updateAgentMetadata({ history, isComplete: true });

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        additions: 5,
        deletions: 2,
        isComplete: true,
        hasChanges: true,
        summary: "Complete task",
        usage: {
          totalCost: 0.123456,
          promptTokens: 200,
          completionTokens: 100,
        },
      });
    });

    it("should not post when no metadata collected", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 0, deletions: 0 });
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
      });

      await updateAgentMetadata({ history: [] });

      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });
  });

  describe("agent ID validation", () => {
    it("should skip posting when no agent ID available", async () => {
      mockGetAgentIdFromArgs.mockReturnValue(undefined);

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });

    it("should skip posting when agent ID is empty string", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("");

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle postAgentMetadata errors gracefully", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "diff",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 1, deletions: 1 });
      mockPostAgentMetadata.mockRejectedValue(new Error("Network error"));

      // Should not throw
      await expect(updateAgentMetadata()).resolves.toBeUndefined();
    });

    it("should continue with other collections if diff collection fails", async () => {
      mockGetGitDiffSnapshot.mockRejectedValue(new Error("Git error"));
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0.5,
        promptTokens: 100,
        completionTokens: 50,
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        usage: {
          totalCost: 0.5,
          promptTokens: 100,
          completionTokens: 50,
        },
      });
    });

    it("should handle all collection failures gracefully", async () => {
      mockGetGitDiffSnapshot.mockRejectedValue(new Error("Git error"));
      mockExtractSummary.mockImplementation(() => {
        throw new Error("Summary error");
      });
      mockGetSessionUsage.mockImplementation(() => {
        throw new Error("Usage error");
      });

      // Should not throw
      await expect(updateAgentMetadata()).resolves.toBeUndefined();

      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });
  });

  describe("hasChanges determination", () => {
    it("should set hasChanges=true when additions > 0", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "diff",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 5, deletions: 0 });

      await updateAgentMetadata({ isComplete: true });

      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.objectContaining({
          hasChanges: true,
        }),
      );
    });

    it("should set hasChanges=true when deletions > 0", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "diff",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 0, deletions: 3 });

      await updateAgentMetadata({ isComplete: true });

      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.objectContaining({
          hasChanges: true,
        }),
      );
    });

    it("should set hasChanges=false when no additions or deletions", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({ additions: 0, deletions: 0 });

      await updateAgentMetadata({ isComplete: true });

      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.objectContaining({
          hasChanges: false,
        }),
      );
    });

    it("should set hasChanges=false when repo not found", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "",
        repoFound: false,
      });

      await updateAgentMetadata({ isComplete: true });

      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.objectContaining({
          hasChanges: false,
        }),
      );
    });

    it("should set hasChanges=false when git diff fails", async () => {
      mockGetGitDiffSnapshot.mockRejectedValue(new Error("Git error"));

      await updateAgentMetadata({ isComplete: true });

      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.objectContaining({
          hasChanges: false,
        }),
      );
    });
  });
});
