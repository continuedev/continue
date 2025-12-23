import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { gracefulExit, updateAgentMetadata } from "./exit.js";

// Mock dependencies
vi.mock("../sentry.js", () => ({
  sentryService: {
    flush: vi.fn(),
  },
}));

vi.mock("../session.js", () => ({
  getSessionUsage: vi.fn(),
}));

vi.mock("../telemetry/telemetryService.js", () => ({
  telemetryService: {
    shutdown: vi.fn(),
  },
}));

vi.mock("./git.js", () => ({
  getGitDiffSnapshot: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./metadata.js", () => ({
  getAgentIdFromArgs: vi.fn(),
  calculateDiffStats: vi.fn(),
  extractSummary: vi.fn(),
  postAgentMetadata: vi.fn(),
}));

// Mock the hadUnhandledError function from index.ts
vi.mock("../index.js", () => ({
  hadUnhandledError: vi.fn(),
}));

describe("exit", () => {
  let mockProcessExit: any;
  let mockSentryService: any;
  let mockTelemetryService: any;
  let mockGetSessionUsage: any;
  let mockHadUnhandledError: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock process.exit to prevent actually exiting during tests
    mockProcessExit = vi.spyOn(process, "exit").mockImplementation((() => {
      // Do nothing
    }) as any);

    // Get mocked modules
    const sentryModule = await import("../sentry.js");
    const telemetryModule = await import("../telemetry/telemetryService.js");
    const sessionModule = await import("../session.js");
    const indexModule = await import("../index.js");

    mockSentryService = vi.mocked(sentryModule.sentryService);
    mockTelemetryService = vi.mocked(telemetryModule.telemetryService);
    mockGetSessionUsage = vi.mocked(sessionModule.getSessionUsage);
    mockHadUnhandledError = vi.mocked(indexModule.hadUnhandledError);

    // Setup default mocks
    mockSentryService.flush.mockResolvedValue(undefined);
    mockTelemetryService.shutdown.mockResolvedValue(undefined);
    mockGetSessionUsage.mockReturnValue({
      totalCost: 0,
      promptTokens: 0,
      completionTokens: 0,
    });
    mockHadUnhandledError.mockReturnValue(false);

    // Mock process.argv to not trigger verbose mode
    process.argv = ["node", "cn"];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("gracefulExit", () => {
    test("should flush telemetry and sentry before exiting", async () => {
      await gracefulExit(0);

      expect(mockTelemetryService.shutdown).toHaveBeenCalledTimes(1);
      expect(mockSentryService.flush).toHaveBeenCalledTimes(1);
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    test("should exit with provided exit code when no unhandled errors", async () => {
      mockHadUnhandledError.mockReturnValue(false);

      await gracefulExit(42);

      expect(mockProcessExit).toHaveBeenCalledWith(42);
    });

    test("should exit with code 1 when exit code is 0 but unhandled error occurred", async () => {
      mockHadUnhandledError.mockReturnValue(true);

      await gracefulExit(0);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    test("should preserve non-zero exit code even if unhandled error occurred", async () => {
      mockHadUnhandledError.mockReturnValue(true);

      await gracefulExit(42);

      expect(mockProcessExit).toHaveBeenCalledWith(42);
    });

    test("should preserve non-zero exit code 130 (SIGINT) even if unhandled error occurred", async () => {
      mockHadUnhandledError.mockReturnValue(true);

      await gracefulExit(130);

      expect(mockProcessExit).toHaveBeenCalledWith(130);
    });

    test("should handle telemetry shutdown errors gracefully", async () => {
      mockTelemetryService.shutdown.mockRejectedValue(
        new Error("Telemetry error"),
      );

      await gracefulExit(0);

      expect(mockSentryService.flush).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    test("should handle sentry flush errors gracefully", async () => {
      mockSentryService.flush.mockRejectedValue(new Error("Sentry error"));

      await gracefulExit(0);

      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    test("should handle both telemetry and sentry errors gracefully", async () => {
      mockTelemetryService.shutdown.mockRejectedValue(
        new Error("Telemetry error"),
      );
      mockSentryService.flush.mockRejectedValue(new Error("Sentry error"));

      await gracefulExit(0);

      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    test("should display session usage in verbose mode", async () => {
      process.argv = ["node", "cn", "--verbose"];
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0.05,
        promptTokens: 1000,
        completionTokens: 500,
        promptTokensDetails: {
          cachedTokens: 100,
          cacheWriteTokens: 50,
        },
      });

      await gracefulExit(0);

      const loggerModule = await import("./logger.js");
      const mockLogger = vi.mocked(loggerModule.logger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Session Usage Summary"),
      );
    });

    test("should not display session usage when not verbose", async () => {
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0.05,
        promptTokens: 1000,
        completionTokens: 500,
      });

      await gracefulExit(0);

      const loggerModule = await import("./logger.js");
      const mockLogger = vi.mocked(loggerModule.logger);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("Session Usage Summary"),
      );
    });

    test("should not display session usage when cost is zero", async () => {
      process.argv = ["node", "cn", "--verbose"];
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
      });

      await gracefulExit(0);

      const loggerModule = await import("./logger.js");
      const mockLogger = vi.mocked(loggerModule.logger);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("Session Usage Summary"),
      );
    });
  });

  describe("updateAgentMetadata", () => {
    let mockGetAgentIdFromArgs: any;
    let mockGetGitDiffSnapshot: any;
    let mockCalculateDiffStats: any;
    let mockExtractSummary: any;
    let mockPostAgentMetadata: any;

    beforeEach(async () => {
      const metadataModule = await import("./metadata.js");
      const gitModule = await import("./git.js");

      mockGetAgentIdFromArgs = vi.mocked(metadataModule.getAgentIdFromArgs);
      mockGetGitDiffSnapshot = vi.mocked(gitModule.getGitDiffSnapshot);
      mockCalculateDiffStats = vi.mocked(metadataModule.calculateDiffStats);
      mockExtractSummary = vi.mocked(metadataModule.extractSummary);
      mockPostAgentMetadata = vi.mocked(metadataModule.postAgentMetadata);

      // Setup defaults
      mockGetAgentIdFromArgs.mockReturnValue("test-agent-id");
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: "diff --git a/file.ts b/file.ts\n+added line\n-removed line",
        repoFound: true,
      });
      mockCalculateDiffStats.mockReturnValue({
        additions: 10,
        deletions: 5,
      });
      mockExtractSummary.mockReturnValue("Test summary");
      mockPostAgentMetadata.mockResolvedValue(undefined);
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0.05,
        promptTokens: 1000,
        completionTokens: 500,
        promptTokensDetails: {
          cachedTokens: 100,
          cacheWriteTokens: 50,
        },
      });
    });

    test("should not update metadata when no agent ID", async () => {
      mockGetAgentIdFromArgs.mockReturnValue(null);

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });

    test("should update metadata with diff stats", async () => {
      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith("test-agent-id", {
        additions: 10,
        deletions: 5,
        usage: {
          totalCost: 0.05,
          promptTokens: 1000,
          completionTokens: 500,
          cachedTokens: 100,
          cacheWriteTokens: 50,
        },
      });
    });

    test("should not include diff stats when no changes", async () => {
      mockCalculateDiffStats.mockReturnValue({
        additions: 0,
        deletions: 0,
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.not.objectContaining({
          additions: expect.anything(),
          deletions: expect.anything(),
        }),
      );
    });

    test("should extract summary from provided history", async () => {
      const history = [
        { message: { content: "Test message", role: "user" } },
      ] as any;

      await updateAgentMetadata(history);

      expect(mockExtractSummary).toHaveBeenCalledWith(history);
      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.objectContaining({
          summary: "Test summary",
        }),
      );
    });

    test("should not include summary when history is empty", async () => {
      const history = [] as any;

      await updateAgentMetadata(history);

      expect(mockExtractSummary).not.toHaveBeenCalled();
    });

    test("should handle git diff errors gracefully", async () => {
      mockGetGitDiffSnapshot.mockRejectedValue(new Error("Git error"));

      await updateAgentMetadata();

      // Should still post other metadata
      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.objectContaining({
          usage: expect.anything(),
        }),
      );
    });

    test("should handle summary extraction errors gracefully", async () => {
      const history = [{ message: { content: "Test", role: "user" } }] as any;
      mockExtractSummary.mockImplementation(() => {
        throw new Error("Summary error");
      });

      await updateAgentMetadata(history);

      // Should still post other metadata
      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.objectContaining({
          additions: 10,
        }),
      );
    });

    test("should handle usage calculation errors gracefully", async () => {
      mockGetSessionUsage.mockImplementation(() => {
        throw new Error("Usage error");
      });

      await updateAgentMetadata();

      // Should still post other metadata
      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.objectContaining({
          additions: 10,
        }),
      );
    });

    test("should not include usage when cost is zero", async () => {
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).toHaveBeenCalledWith(
        "test-agent-id",
        expect.not.objectContaining({
          usage: expect.anything(),
        }),
      );
    });

    test("should handle when no repo is found", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: null,
        repoFound: false,
      });

      await updateAgentMetadata();

      expect(mockCalculateDiffStats).not.toHaveBeenCalled();
    });

    test("should handle API posting errors gracefully", async () => {
      mockPostAgentMetadata.mockRejectedValue(new Error("API error"));

      await expect(updateAgentMetadata()).resolves.not.toThrow();
    });

    test("should not post metadata when no metadata to send", async () => {
      mockGetGitDiffSnapshot.mockResolvedValue({
        diff: null,
        repoFound: false,
      });
      mockGetSessionUsage.mockReturnValue({
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
      });

      await updateAgentMetadata();

      expect(mockPostAgentMetadata).not.toHaveBeenCalled();
    });
  });
});
