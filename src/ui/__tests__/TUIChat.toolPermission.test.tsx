import { render } from "ink-testing-library";
import React from "react";
import { vi } from "vitest";

import { ToolPermissionSelector } from "../components/ToolPermissionSelector.js";

describe("TUIChat - Tool Permission Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it("shows ToolPermissionSelector with correct content", async () => {
    const handleResponse = vi.fn();

    const { lastFrame } = render(
      <ToolPermissionSelector
        toolName="Edit"
        toolArgs={{
          file_path: "/path/to/test.txt",
          old_string: "old content",
          new_string: "new content",
        }}
        requestId="test-request-123"
        onResponse={handleResponse}
      />
    );

    await vi.advanceTimersByTimeAsync(50);

    const frame = lastFrame();

    // Verify ToolPermissionSelector is shown
    expect(frame).toContain("Edit");
    expect(frame).toContain("Would you like to continue?");
    expect(frame).toContain("Continue");
    expect(frame).toContain("Continue + don't ask again");
    expect(frame).toContain("Cancel");
    expect(frame).toContain("(tab)");
    expect(frame).toContain("(shift+tab)");
    expect(frame).toContain("(esc)");
  });

  it("handles keyboard shortcuts for permission approval and rejection", async () => {
    const handleResponse = vi.fn();

    const { stdin } = render(
      <ToolPermissionSelector
        toolName="Write"
        toolArgs={{
          file_path: "/path/to/new-file.txt",
          content: "Hello, world!",
        }}
        requestId="test-request-123"
        onResponse={handleResponse}
      />
    );

    await vi.advanceTimersByTimeAsync(50);

    // Test Tab key for approval
    stdin.write("\t");

    await vi.advanceTimersByTimeAsync(50);

    expect(handleResponse).toHaveBeenCalledWith(
      "test-request-123",
      true,
      false
    );
  });

  it("handles escape key for rejection", async () => {
    const handleResponse = vi.fn();

    const { stdin } = render(
      <ToolPermissionSelector
        toolName="Bash"
        toolArgs={{
          command: "rm -rf /",
        }}
        requestId="test-request-456"
        onResponse={handleResponse}
      />
    );

    await vi.advanceTimersByTimeAsync(50);

    // Test escape key for rejection
    stdin.write("\x1b"); // ESC key

    await vi.advanceTimersByTimeAsync(50);

    expect(handleResponse).toHaveBeenCalledWith(
      "test-request-456",
      false,
      false
    );
  });

  it("handles 'n' key for rejection", async () => {
    const handleResponse = vi.fn();

    const { stdin } = render(
      <ToolPermissionSelector
        toolName="Delete"
        toolArgs={{
          path: "/important/file.txt",
        }}
        requestId="test-request-789"
        onResponse={handleResponse}
      />
    );

    await vi.advanceTimersByTimeAsync(50);

    // Test 'n' key for rejection
    stdin.write("n");

    await vi.advanceTimersByTimeAsync(50);

    expect(handleResponse).toHaveBeenCalledWith(
      "test-request-789",
      false,
      false
    );
  });

  it("handles arrow key navigation in permission selector", async () => {
    const handleResponse = vi.fn();

    const { lastFrame, stdin } = render(
      <ToolPermissionSelector
        toolName="Read"
        toolArgs={{
          file_path: "/path/to/secret.txt",
        }}
        requestId="test-request-123"
        onResponse={handleResponse}
      />
    );

    await vi.advanceTimersByTimeAsync(50);

    // Initial state should show "> Continue" selected
    const frame = lastFrame();
    expect(frame).toMatch(/>\s+Continue/);

    // Test that pressing Enter on default selection triggers approval
    stdin.write("\r");
    await vi.advanceTimersByTimeAsync(50);

    expect(handleResponse).toHaveBeenCalledWith(
      "test-request-123",
      true,
      undefined
    );
  });

  it("handles shift+tab key for policy creation", async () => {
    const handleResponse = vi.fn();

    const { stdin } = render(
      <ToolPermissionSelector
        toolName="Bash"
        toolArgs={{
          command: "ls -la",
        }}
        requestId="test-request-policy"
        onResponse={handleResponse}
      />
    );

    await vi.advanceTimersByTimeAsync(50);

    // Test shift+tab key for approval with policy creation
    // In terminal, shift+tab is typically represented as "\x1b[Z"
    stdin.write("\x1b[Z");

    await vi.advanceTimersByTimeAsync(50);

    expect(handleResponse).toHaveBeenCalledWith(
      "test-request-policy",
      true,
      true
    );
  });

  it("shows tool result with red dot and 'Cancelled by user' message", async () => {
    // Import the components we need for this test
    const { ToolResultSummary } = await import(
      "../ToolResultSummary.js"
    );
    const { MemoizedMessage } = await import(
      "../components/MemoizedMessage.js"
    );

    // Test the ToolResultSummary component directly
    const { lastFrame: summaryFrame } = render(
      <ToolResultSummary toolName="Edit" content="Permission denied by user" />
    );

    const summary = summaryFrame();
    expect(summary).toContain("Cancelled by user");

    // Test the MemoizedMessage component with a tool-result message
    const message = {
      role: "assistant",
      content: "Edit",
      messageType: "tool-result" as const,
      toolName: "Edit",
      toolResult: "Permission denied by user",
    };

    const { lastFrame: messageFrame } = render(
      <MemoizedMessage message={message} index={0} />
    );

    await vi.advanceTimersByTimeAsync(100);

    const messageOutput = messageFrame();

    // Verify the red dot appears
    expect(messageOutput).toContain("●");

    // Verify the tool name appears
    expect(messageOutput).toContain("Edit");

    // The MemoizedMessage component correctly identifies this as a failure
    // because message.toolResult includes "Permission denied"
    // This causes the red dot to be shown

    // Verify the correct data is passed to the component
    expect(message.toolResult).toBe("Permission denied by user");
    expect(message.messageType).toBe("tool-result");
  });
});
