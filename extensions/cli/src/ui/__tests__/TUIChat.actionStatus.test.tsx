import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import { AppRoot } from "../AppRoot.js";

// Mock the useChat hook to control state
const mockUseChat = vi.fn();

vi.mock("../hooks/useChat.js", () => ({
  useChat: () => mockUseChat(),
}));

describe("TUIChat - ActionStatus", () => {
  let context: any;

  beforeEach(() => {
    context = createUITestContext({
      allServicesReady: true,
      serviceState: "ready",
    });

    // Default mock return value
    mockUseChat.mockReturnValue({
      chatHistory: [],
      setChatHistory: vi.fn(),
      isWaitingForResponse: false,
      responseStartTime: null,
      isCompacting: false,
      compactionStartTime: null,
      inputMode: true,
      attachedFiles: [],
      activePermissionRequest: null,
      wasInterrupted: false,
      handleUserMessage: vi.fn(),
      handleInterrupt: vi.fn(),
      handleFileAttached: vi.fn(),
      resetChatHistory: vi.fn(),
      handleToolPermissionResponse: vi.fn(),
    });
  });

  afterEach(() => {
    context.cleanup();
    vi.clearAllMocks();
  });

  it("shows only response status when waiting for response", () => {
    const responseStartTime = Date.now();

    mockUseChat.mockReturnValue({
      chatHistory: [],
      setChatHistory: vi.fn(),
      isWaitingForResponse: true,
      responseStartTime,
      isCompacting: false,
      compactionStartTime: null,
      inputMode: false,
      attachedFiles: [],
      activePermissionRequest: null,
      wasInterrupted: false,
      handleUserMessage: vi.fn(),
      handleInterrupt: vi.fn(),
      handleFileAttached: vi.fn(),
      resetChatHistory: vi.fn(),
      handleToolPermissionResponse: vi.fn(),
    });

    const { lastFrame, unmount } = render(React.createElement(AppRoot, {}));

    try {
      const frame = lastFrame();
      expect(frame).toBeDefined();

      // Should show spinner/response indicator but not compaction message
      expect(frame).toContain("esc to interrupt");
      expect(frame).not.toContain("Compacting history");
    } finally {
      unmount();
    }
  });

  it("shows only compaction status when compacting", () => {
    const compactionStartTime = Date.now();

    mockUseChat.mockReturnValue({
      chatHistory: [],
      setChatHistory: vi.fn(),
      isWaitingForResponse: false,
      responseStartTime: null,
      isCompacting: true,
      compactionStartTime,
      inputMode: true,
      attachedFiles: [],
      activePermissionRequest: null,
      wasInterrupted: false,
      handleUserMessage: vi.fn(),
      handleInterrupt: vi.fn(),
      handleFileAttached: vi.fn(),
      resetChatHistory: vi.fn(),
      handleToolPermissionResponse: vi.fn(),
    });

    const { lastFrame, unmount } = render(React.createElement(AppRoot, {}));

    try {
      const frame = lastFrame();
      expect(frame).toBeDefined();

      // Should show compaction message but not spinner
      expect(frame).toContain("Compacting history");
      expect(frame).toContain("esc to interrupt");
    } finally {
      unmount();
    }
  });

  it("shows neither status when both states are false", () => {
    mockUseChat.mockReturnValue({
      chatHistory: [],
      setChatHistory: vi.fn(),
      isWaitingForResponse: false,
      responseStartTime: null,
      isCompacting: false,
      compactionStartTime: null,
      inputMode: true,
      attachedFiles: [],
      activePermissionRequest: null,
      wasInterrupted: false,
      handleUserMessage: vi.fn(),
      handleInterrupt: vi.fn(),
      handleFileAttached: vi.fn(),
      resetChatHistory: vi.fn(),
      handleToolPermissionResponse: vi.fn(),
    });

    const { lastFrame, unmount } = render(React.createElement(AppRoot, {}));

    try {
      const frame = lastFrame();
      expect(frame).toBeDefined();

      // Should not show any status messages
      expect(frame).not.toContain("Compacting history");
      // The basic UI should still be there
      expect(frame).toContain("Ask anything");
    } finally {
      unmount();
    }
  });

  it("handles state transitions correctly", () => {
    const { lastFrame, rerender, unmount } = render(
      React.createElement(AppRoot, {}),
    );

    // Start with compaction
    const compactionStartTime = Date.now();
    mockUseChat.mockReturnValue({
      chatHistory: [],
      setChatHistory: vi.fn(),
      isWaitingForResponse: false,
      responseStartTime: null,
      isCompacting: true,
      compactionStartTime,
      inputMode: true,
      attachedFiles: [],
      activePermissionRequest: null,
      wasInterrupted: false,
      handleUserMessage: vi.fn(),
      handleInterrupt: vi.fn(),
      handleFileAttached: vi.fn(),
      resetChatHistory: vi.fn(),
      handleToolPermissionResponse: vi.fn(),
    });

    try {
      rerender(React.createElement(AppRoot, {}));

      let frame = lastFrame();
      expect(frame).toContain("Compacting history");
      expect(frame).not.toContain("⠀⠁⠃⠇⠏⠟⠿⣿"); // No spinner chars when only compacting

      // Transition to response waiting
      const responseStartTime = Date.now();
      mockUseChat.mockReturnValue({
        chatHistory: [],
        setChatHistory: vi.fn(),
        isWaitingForResponse: true,
        responseStartTime,
        isCompacting: false,
        compactionStartTime: null,
        inputMode: false,
        attachedFiles: [],
        activePermissionRequest: null,
        wasInterrupted: false,
        handleUserMessage: vi.fn(),
        handleInterrupt: vi.fn(),
        handleFileAttached: vi.fn(),
        resetChatHistory: vi.fn(),
        handleToolPermissionResponse: vi.fn(),
      });

      rerender(React.createElement(AppRoot, {}));

      frame = lastFrame();
      expect(frame).not.toContain("Compacting history");
      expect(frame).toContain("esc to interrupt");
    } finally {
      unmount();
    }
  });
});
