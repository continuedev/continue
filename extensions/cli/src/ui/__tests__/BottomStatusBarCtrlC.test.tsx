import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { BottomStatusBar } from "../components/BottomStatusBar.js";

// Mock the index module functions
vi.mock("../../index.js", () => ({
  shouldShowExitMessage: vi.fn(() => false),
  setExitMessageCallback: vi.fn(),
}));

describe("BottomStatusBar Ctrl+C message", () => {
  const defaultProps = {
    currentMode: "normal" as const,
    repoURLText: "github.com/user/repo",
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
});
