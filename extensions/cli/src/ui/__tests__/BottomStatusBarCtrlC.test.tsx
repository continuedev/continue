import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BottomStatusBar,
  BottomStatusBarProps,
} from "../components/BottomStatusBar.js";

// Mock the index module functions
vi.mock("../../index.js", () => ({
  shouldShowExitMessage: vi.fn(() => false),
  setExitMessageCallback: vi.fn(),
}));

// Mock git utility functions
vi.mock("../../util/git.js", () => ({
  isGitRepo: vi.fn(() => false),
  getGitRemoteUrl: vi.fn(() => null),
  getGitBranch: vi.fn(() => null),
}));

describe("BottomStatusBar Ctrl+C message", () => {
  const defaultProps: BottomStatusBarProps = {
    currentMode: "normal" as const,
    remoteUrl: "github.com/user/repo",
    isRemoteMode: false,
    services: { model: { model: null } },
    navState: { currentScreen: "chat" },
    navigateTo: vi.fn(),
    closeCurrentScreen: vi.fn(),
    contextPercentage: undefined,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mocks to default state
    const indexModule = (await vi.importMock("../../index.js")) as any;
    indexModule.shouldShowExitMessage.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows repo URL when not in exit message mode", async () => {
    const indexModule = (await vi.importMock("../../index.js")) as any;
    indexModule.shouldShowExitMessage.mockReturnValue(false);

    const { lastFrame } = render(<BottomStatusBar {...defaultProps} />);

    expect(lastFrame()).toContain("github.com/user/repo");
    expect(lastFrame()).not.toContain("ctrl+c to exit");
  });

  it("shows exit message when shouldShowExitMessage returns true", async () => {
    const indexModule = (await vi.importMock("../../index.js")) as any;
    indexModule.shouldShowExitMessage.mockReturnValue(true);

    const { lastFrame } = render(<BottomStatusBar {...defaultProps} />);

    expect(lastFrame()).toContain("ctrl+c to exit");
    expect(lastFrame()).not.toContain("github.com/user/repo");
  });

  it("registers exit message callback on mount", async () => {
    const indexModule = (await vi.importMock("../../index.js")) as any;

    render(<BottomStatusBar {...defaultProps} />);

    expect(indexModule.setExitMessageCallback).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it("shows the enhanced statusline when the feature flag is enabled", async () => {
    const { lastFrame } = render(
      <BottomStatusBar
        {...defaultProps}
        services={{
          featureFlags: { flags: { CLI_STATUSLINE: true } },
          model: { model: { title: "GPT-5.4" } },
          taskState: {
            currentTask: {
              id: "c123",
              type: "chat",
              status: "running",
              description: "Implement the statusline",
              startTime: Date.now(),
              toolCallCount: 1,
              tokensUsed: 250,
            },
            taskHistory: [],
            sessionTaskCount: 1,
            sessionStartTime: Date.now(),
          },
          progressTracker: {
            totalToolCalls: 3,
            latestInputTokens: 1200,
            cumulativeOutputTokens: 300,
            latestCacheReadTokens: 0,
            latestCacheWriteTokens: 0,
            recentActivities: [],
            turnCount: 1,
            sessionStartTime: Date.now(),
          },
          taskNotifications: {
            enabled: true,
            notifications: [],
            lastUpdated: null,
          },
        }}
        contextPercentage={42}
      />,
    );

    expect(lastFrame()).toContain("mode");
    expect(lastFrame()).toContain("normal");
    expect(lastFrame()).toContain("GPT-5.");
    expect(lastFrame()).toContain("ctx");
    expect(lastFrame()).toContain("42%");
    expect(lastFrame()).toContain("tools");
    expect(lastFrame()).toContain("Implement the stat");
  });
});
