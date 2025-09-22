import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunTerminalCommand } from "./RunTerminalCommand";
import { ToolCallState } from "core";

// Mock the UnifiedTerminalCommand component since it requires Redux
vi.mock("../../../components/UnifiedTerminal/UnifiedTerminal", () => ({
  UnifiedTerminalCommand: ({
    command,
    output,
    status,
    statusMessage,
    toolCallState,
    toolCallId,
  }: any) => (
    <div data-testid="unified-terminal">
      <div data-testid="command">{command}</div>
      <div data-testid="output">{output}</div>
      <div data-testid="status">{status}</div>
      <div data-testid="status-message">{statusMessage}</div>
    </div>
  ),
}));

describe("RunTerminalCommand", () => {
  it("should display error message when tool call is errored", () => {
    const erroredToolCallState: ToolCallState = {
      toolCallId: "test-id",
      toolCall: {
        id: "test-id",
        type: "function",
        function: {
          name: "runTerminalCommand",
          arguments: JSON.stringify({ command: 'eval "echo hello"' }),
        },
      },
      status: "errored",
      parsedArgs: { command: 'eval "echo hello"' },
      output: [
        {
          name: "Security Policy Violation",
          description: "Command Disabled",
          content:
            'This command has been disabled by security policy:\n\neval "echo hello"\n\nThis command cannot be executed as it may pose a security risk.',
          icon: "problems",
          hidden: false,
        },
      ],
    };

    render(
      <RunTerminalCommand
        command='eval "echo hello"'
        toolCallState={erroredToolCallState}
        toolCallId="test-id"
      />,
    );

    // Check that the error message is displayed in the output
    const outputElement = screen.getByTestId("output");
    expect(outputElement.textContent).toContain(
      "This command has been disabled by security policy",
    );
    expect(outputElement.textContent).toContain('eval "echo hello"');
    expect(outputElement.textContent).toContain(
      "cannot be executed as it may pose a security risk",
    );

    // Check that status is set to failed
    const statusElement = screen.getByTestId("status");
    expect(statusElement.textContent).toBe("failed");
  });

  it("should display terminal output for successful commands", () => {
    const successfulToolCallState: ToolCallState = {
      toolCallId: "test-id",
      toolCall: {
        id: "test-id",
        type: "function",
        function: {
          name: "runTerminalCommand",
          arguments: JSON.stringify({ command: "ls -la" }),
        },
      },
      status: "done",
      parsedArgs: { command: "ls -la" },
      output: [
        {
          name: "Terminal",
          description: "Command executed successfully",
          content:
            "total 64\ndrwxr-xr-x  10 user  staff   320 Jan  1 12:00 .\ndrwxr-xr-x  20 user  staff   640 Jan  1 11:00 ..",
          icon: "terminal",
          hidden: false,
        },
      ],
    };

    render(
      <RunTerminalCommand
        command="ls -la"
        toolCallState={successfulToolCallState}
        toolCallId="test-id"
      />,
    );

    // Check that the terminal output is displayed
    const outputElement = screen.getByTestId("output");
    expect(outputElement.textContent).toContain("total 64");
    expect(outputElement.textContent).toContain("drwxr-xr-x");

    // Check that status is completed
    const statusElement = screen.getByTestId("status");
    expect(statusElement.textContent).toBe("completed");
  });

  it("should handle running status correctly", () => {
    const runningToolCallState: ToolCallState = {
      toolCallId: "test-id",
      toolCall: {
        id: "test-id",
        type: "function",
        function: {
          name: "runTerminalCommand",
          arguments: JSON.stringify({ command: "npm install" }),
        },
      },
      status: "calling",
      parsedArgs: { command: "npm install" },
      output: [],
    };

    render(
      <RunTerminalCommand
        command="npm install"
        toolCallState={runningToolCallState}
        toolCallId="test-id"
      />,
    );

    // Check that status is set to running
    const statusElement = screen.getByTestId("status");
    expect(statusElement.textContent).toBe("running");

    // Check that command is displayed
    const commandElement = screen.getByTestId("command");
    expect(commandElement.textContent).toBe("npm install");
  });

  it("should detect failed status from error state", () => {
    const failedToolCallState: ToolCallState = {
      toolCallId: "test-id",
      toolCall: {
        id: "test-id",
        type: "function",
        function: {
          name: "runTerminalCommand",
          arguments: JSON.stringify({ command: "invalid-command" }),
        },
      },
      status: "errored",
      parsedArgs: { command: "invalid-command" },
      output: [
        {
          name: "Tool Call Error",
          description: "Command Failed",
          content: "Command 'invalid-command' not found",
          icon: "problems",
          hidden: false,
        },
      ],
    };

    render(
      <RunTerminalCommand
        command="invalid-command"
        toolCallState={failedToolCallState}
        toolCallId="test-id"
      />,
    );

    // Check that error content is displayed
    const outputElement = screen.getByTestId("output");
    expect(outputElement.textContent).toContain(
      "Command 'invalid-command' not found",
    );

    // Check that status is failed
    const statusElement = screen.getByTestId("status");
    expect(statusElement.textContent).toBe("failed");
  });

  it("should handle empty output gracefully", () => {
    const emptyOutputState: ToolCallState = {
      toolCallId: "test-id",
      toolCall: {
        id: "test-id",
        type: "function",
        function: {
          name: "runTerminalCommand",
          arguments: JSON.stringify({ command: "echo" }),
        },
      },
      status: "done",
      parsedArgs: { command: "echo" },
      output: [],
    };

    render(
      <RunTerminalCommand
        command="echo"
        toolCallState={emptyOutputState}
        toolCallId="test-id"
      />,
    );

    // Should render with empty output
    const outputElement = screen.getByTestId("output");
    expect(outputElement.textContent).toBe("");

    // Status should still be completed
    const statusElement = screen.getByTestId("status");
    expect(statusElement.textContent).toBe("completed");
  });

  it("should prioritize first output item for errored status", () => {
    const multiOutputErrorState: ToolCallState = {
      toolCallId: "test-id",
      toolCall: {
        id: "test-id",
        type: "function",
        function: {
          name: "runTerminalCommand",
          arguments: JSON.stringify({ command: "sudo rm -rf /" }),
        },
      },
      status: "errored",
      parsedArgs: { command: "sudo rm -rf /" },
      output: [
        {
          name: "Security Policy Violation",
          description: "Dangerous Command Blocked",
          content: "This command is extremely dangerous and has been blocked.",
          icon: "problems",
          hidden: false,
        },
        {
          name: "Terminal",
          description: "Should not be shown",
          content: "This should not appear for errored status",
          icon: "terminal",
          hidden: false,
        },
      ],
    };

    render(
      <RunTerminalCommand
        command="sudo rm -rf /"
        toolCallState={multiOutputErrorState}
        toolCallId="test-id"
      />,
    );

    // Should show the security error, not the terminal output
    const outputElement = screen.getByTestId("output");
    expect(outputElement.textContent).toContain(
      "extremely dangerous and has been blocked",
    );
    expect(outputElement.textContent).not.toContain("This should not appear");

    // Status should be failed for errored state
    const statusElement = screen.getByTestId("status");
    expect(statusElement.textContent).toBe("failed");
  });
});
