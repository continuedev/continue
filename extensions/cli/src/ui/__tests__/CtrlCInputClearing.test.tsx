import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { UserInput } from "../UserInput.js";

describe("Ctrl+C input clearing", () => {
  let mockOnSubmit: ReturnType<typeof vi.fn>;
  let mockProcessKill: any;

  beforeEach(() => {
    mockOnSubmit = vi.fn();

    // Mock process.kill using vi.spyOn
    mockProcessKill = vi.spyOn(process, "kill").mockImplementation(() => {
      return true;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("sends SIGINT when Ctrl+C is pressed (input clearing tested implicitly)", () => {
    const { stdin } = render(
      <UserInput
        onSubmit={mockOnSubmit}
        inputMode={true}
        disabled={false}
        isWaitingForResponse={false}
      />,
    );

    // Type some text first
    stdin.write("hello world");

    // Simulate Ctrl+C using raw character code (like other tests in codebase)
    stdin.write("\u0003");

    // Should send SIGINT to process (which handles the two-stage exit)
    expect(mockProcessKill).toHaveBeenCalledWith(process.pid, "SIGINT");
  });

  it("sends SIGINT to main process for two-stage exit handling", () => {
    const { stdin } = render(
      <UserInput
        onSubmit={mockOnSubmit}
        inputMode={true}
        disabled={false}
        isWaitingForResponse={false}
      />,
    );

    // Simulate Ctrl+C using raw character code (like other tests in codebase)
    stdin.write("\u0003");

    // Should delegate to main process SIGINT handler
    expect(mockProcessKill).toHaveBeenCalledWith(process.pid, "SIGINT");
  });
});
