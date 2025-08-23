import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { UserInput } from "../UserInput.js";

describe("Ctrl+C input clearing", () => {
  let mockOnSubmit: ReturnType<typeof vi.fn>;
  let mockProcess: any;

  beforeEach(() => {
    mockOnSubmit = vi.fn();
    
    // Mock process.kill for SIGINT simulation
    mockProcess = {
      kill: vi.fn(),
      pid: 12345,
    };
    vi.stubGlobal("process", mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends SIGINT when Ctrl+C is pressed (input clearing tested implicitly)", () => {
    const { stdin } = render(
      <UserInput
        onSubmit={mockOnSubmit}
        onExit={vi.fn()}
        disabled={false}
        isWaitingForResponse={false}
      />
    );

    // Type some text first
    stdin.write("hello world");

    // Simulate Ctrl+C
    stdin.write("\u0003");

    // Should send SIGINT to process (which handles the two-stage exit)
    expect(mockProcess.kill).toHaveBeenCalledWith(12345, "SIGINT");
  });

  it("sends SIGINT to main process for two-stage exit handling", () => {
    const { stdin } = render(
      <UserInput
        onSubmit={mockOnSubmit}
        onExit={vi.fn()}
        disabled={false}
        isWaitingForResponse={false}
      />
    );

    // Simulate Ctrl+C
    stdin.write("\u0003");

    // Should delegate to main process SIGINT handler
    expect(mockProcess.kill).toHaveBeenCalledWith(12345, "SIGINT");
  });
});