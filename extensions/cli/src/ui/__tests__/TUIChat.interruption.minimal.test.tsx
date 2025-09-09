import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserInput } from "../UserInput.js";

describe("TUIChat - Interruption UI (Minimal Test)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows interruption message when wasInterrupted is true", () => {
    const mockOnSubmit = vi.fn();
    const mockOnInterrupt = vi.fn();

    const { lastFrame, rerender, unmount } = render(
      React.createElement(UserInput, {
        onSubmit: mockOnSubmit,
        isWaitingForResponse: false,
        inputMode: true,
        onInterrupt: mockOnInterrupt,
        wasInterrupted: false, // Initially false
      }),
    );

    try {
      // Initial render - no interruption message
      let frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).not.toContain("Interrupted by user");
      expect(frame).not.toContain("Press enter to continue");

      // Re-render with wasInterrupted: true
      rerender(
        React.createElement(UserInput, {
          onSubmit: mockOnSubmit,
          isWaitingForResponse: false,
          inputMode: true,
          onInterrupt: mockOnInterrupt,
          wasInterrupted: true, // Now true
        }),
      );

      // Should show interruption message
      frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain("Interrupted by user");
      expect(frame).toContain("Press enter to continue");
    } finally {
      unmount();
    }
  });

  it("hides interruption message when wasInterrupted is false", () => {
    const mockOnSubmit = vi.fn();
    const mockOnInterrupt = vi.fn();

    const { lastFrame, rerender, unmount } = render(
      React.createElement(UserInput, {
        onSubmit: mockOnSubmit,
        isWaitingForResponse: false,
        inputMode: true,
        onInterrupt: mockOnInterrupt,
        wasInterrupted: true, // Initially true
      }),
    );

    try {
      // Initial render - should show interruption message
      let frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain("Interrupted by user");
      expect(frame).toContain("Press enter to continue");

      // Re-render with wasInterrupted: false
      rerender(
        React.createElement(UserInput, {
          onSubmit: mockOnSubmit,
          isWaitingForResponse: false,
          inputMode: true,
          onInterrupt: mockOnInterrupt,
          wasInterrupted: false, // Now false
        }),
      );

      // Should not show interruption message
      frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).not.toContain("Interrupted by user");
      expect(frame).not.toContain("Press enter to continue");
    } finally {
      unmount();
    }
  });

  it("calls onSubmit with empty string when Enter is pressed while interrupted", () => {
    const mockOnSubmit = vi.fn();
    const mockOnInterrupt = vi.fn();

    const { stdin, unmount } = render(
      React.createElement(UserInput, {
        onSubmit: mockOnSubmit,
        isWaitingForResponse: false,
        inputMode: true,
        onInterrupt: mockOnInterrupt,
        wasInterrupted: true, // Interrupted state
      }),
    );

    try {
      // Press Enter while in interrupted state
      stdin.write("\r");

      // Should call onSubmit with empty string (for resume)
      expect(mockOnSubmit).toHaveBeenCalledWith("", expect.any(Map));
    } finally {
      unmount();
    }
  });

  it("calls onSubmit with typed content when typing new message after interruption", () => {
    const mockOnSubmit = vi.fn();
    const mockOnInterrupt = vi.fn();

    const { stdin, unmount } = render(
      React.createElement(UserInput, {
        onSubmit: mockOnSubmit,
        isWaitingForResponse: false,
        inputMode: true,
        onInterrupt: mockOnInterrupt,
        wasInterrupted: true, // Interrupted state
      }),
    );

    try {
      // Type a new message
      stdin.write("New message after interruption");
      stdin.write("\r");

      // Should call onSubmit with the typed content
      expect(mockOnSubmit).toHaveBeenCalledWith(
        "New message after interruption",
        expect.any(Map),
      );
    } finally {
      unmount();
    }
  });

  it("shows interruption message above input box in correct position", () => {
    const mockOnSubmit = vi.fn();
    const mockOnInterrupt = vi.fn();

    const { lastFrame, unmount } = render(
      React.createElement(UserInput, {
        onSubmit: mockOnSubmit,
        isWaitingForResponse: false,
        inputMode: true,
        onInterrupt: mockOnInterrupt,
        wasInterrupted: true,
      }),
    );

    try {
      const frame = lastFrame();
      expect(frame).toBeDefined();

      // The interruption message should appear before the input box
      const frameLines = frame?.split("\n") || [];

      let foundInterruptionLine = -1;
      let foundInputBoxLine = -1;

      frameLines.forEach((line, index) => {
        if (line.includes("Interrupted by user")) {
          foundInterruptionLine = index;
        }
        if (line.includes("●") || line.includes("▋")) {
          foundInputBoxLine = index;
        }
      });

      // Interruption message should come before the input box
      expect(foundInterruptionLine).toBeGreaterThan(-1);
      expect(foundInputBoxLine).toBeGreaterThan(-1);
      expect(foundInterruptionLine).toBeLessThan(foundInputBoxLine);
    } finally {
      unmount();
    }
  });
});
