import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import { AppRoot } from "../AppRoot.js";

// Mock the useChat hook to control state
const mockUseChat = vi.fn();
const mockHandleInterrupt = vi.fn();

vi.mock("../hooks/useChat.js", () => ({
  useChat: () => mockUseChat(),
}));

describe("TUIChat - Compaction Cancellation", () => {
  let context: any;

  beforeEach(() => {
    context = createUITestContext({
      allServicesReady: true,
      serviceState: "ready",
    });

    // Reset the mock
    mockHandleInterrupt.mockClear();
  });

  afterEach(() => {
    context.cleanup();
    vi.clearAllMocks();
  });

  it("calls handleInterrupt when ESC is pressed during compaction", () => {
    const compactionStartTime = Date.now();

    mockUseChat.mockReturnValue({
      chatHistory: [],
      setChatHistory: vi.fn(),
      isWaitingForResponse: false,
      responseStartTime: null,
      isCompacting: true,
      compactionStartTime,
      inputMode: true, // Changed to true so ESC handling is active
      attachedFiles: [],
      activePermissionRequest: null,
      wasInterrupted: false,
      handleUserMessage: vi.fn(),
      handleInterrupt: mockHandleInterrupt,
      handleFileAttached: vi.fn(),
      resetChatHistory: vi.fn(),
      handleToolPermissionResponse: vi.fn(),
    });

    const { stdin, unmount } = render(React.createElement(AppRoot, {}));

    try {
      // Give some time for the component to render and set up input handling
      setTimeout(() => {
        // Simulate ESC key press during compaction
        stdin.write("\x1b"); // ESC key

        // The handleInterrupt should be called
        expect(mockHandleInterrupt).toHaveBeenCalledTimes(1);
      }, 100);
    } finally {
      unmount();
    }
  });

  it("shows compaction status with esc to interrupt message", () => {
    const compactionStartTime = Date.now();

    mockUseChat.mockReturnValue({
      chatHistory: [],
      setChatHistory: vi.fn(),
      isWaitingForResponse: false,
      responseStartTime: null,
      isCompacting: true,
      compactionStartTime,
      inputMode: false,
      attachedFiles: [],
      activePermissionRequest: null,
      wasInterrupted: false,
      handleUserMessage: vi.fn(),
      handleInterrupt: mockHandleInterrupt,
      handleFileAttached: vi.fn(),
      resetChatHistory: vi.fn(),
      handleToolPermissionResponse: vi.fn(),
    });

    const { lastFrame, unmount } = render(React.createElement(AppRoot, {}));

    try {
      const frame = lastFrame();
      expect(frame).toBeDefined();

      // Should show compaction message with interrupt option
      expect(frame).toContain("Compacting history");
      expect(frame).toContain("esc to interrupt");
    } finally {
      unmount();
    }
  });

  it("prioritizes compaction cancellation over response cancellation", () => {
    // This tests the case where both might be true (theoretical edge case)
    const compactionStartTime = Date.now();
    const responseStartTime = Date.now();

    mockUseChat.mockReturnValue({
      chatHistory: [],
      setChatHistory: vi.fn(),
      isWaitingForResponse: true,
      responseStartTime,
      isCompacting: true,
      compactionStartTime,
      inputMode: false,
      attachedFiles: [],
      activePermissionRequest: null,
      wasInterrupted: false,
      handleUserMessage: vi.fn(),
      handleInterrupt: mockHandleInterrupt,
      handleFileAttached: vi.fn(),
      resetChatHistory: vi.fn(),
      handleToolPermissionResponse: vi.fn(),
    });

    const { stdin, unmount } = render(React.createElement(AppRoot, {}));

    try {
      // Simulate ESC key press when both states are active
      stdin.write("\x1b"); // ESC key

      // Should still call handleInterrupt (which will prioritize compaction)
      expect(mockHandleInterrupt).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });
});
