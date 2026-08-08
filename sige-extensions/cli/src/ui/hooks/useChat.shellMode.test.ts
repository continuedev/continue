import { beforeEach, describe, expect, it, vi } from "vitest";

import { runTerminalCommandTool } from "src/tools/runTerminalCommand.js";

import { services } from "../../services/index.js";

import { handleBashModeProcessing } from "./useChat.shellMode.js";

// Mock the runTerminalCommandTool with the correct path for the import in shellMode.ts
vi.mock("src/tools/runTerminalCommand.js", () => ({
  runTerminalCommandTool: {
    run: vi.fn(),
  },
}));

// Mock the services
vi.mock("../../services/index.js", () => ({
  services: {
    chatHistory: {
      addAssistantMessage: vi.fn(),
      updateToolStatus: vi.fn(),
      addToolResult: vi.fn(),
    },
  },
}));

describe("handleBashModeProcessing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect bash mode when message starts with !", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);
    mockRun.mockResolvedValue(
      "total 5\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .\ndrwxr-xr-x 3 user user 4096 Jan 1 12:00 ..",
    );

    const result = await handleBashModeProcessing("!ls -la");

    expect(result).toBe(null); // Processed, no further handling needed
    expect(services.chatHistory.addAssistantMessage).toHaveBeenCalled();
    expect(services.chatHistory.updateToolStatus).toHaveBeenCalledWith(
      expect.any(String),
      "calling",
    );

    // Use vi.waitFor to wait for async operations in the void expression
    await vi.waitFor(
      () => {
        expect(mockRun).toHaveBeenCalledWith({ command: "ls -la" });
      },
      { timeout: 1000 },
    );

    await vi.waitFor(
      () => {
        expect(services.chatHistory.addToolResult).toHaveBeenCalledWith(
          expect.any(String),
          "total 5\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .\ndrwxr-xr-x 3 user user 4096 Jan 1 12:00 ..",
          "done",
        );
      },
      { timeout: 1000 },
    );
  });

  it("should handle bash command errors", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);
    mockRun.mockRejectedValue(new Error("Command not found"));

    const result = await handleBashModeProcessing("!invalidcommand");

    expect(result).toBe(null); // Processed, no further handling needed
    expect(services.chatHistory.addAssistantMessage).toHaveBeenCalled();
    expect(services.chatHistory.updateToolStatus).toHaveBeenCalledWith(
      expect.any(String),
      "calling",
    );

    // Use vi.waitFor to wait for async operations in the void expression
    await vi.waitFor(
      () => {
        expect(mockRun).toHaveBeenCalledWith({ command: "invalidcommand" });
      },
      { timeout: 1000 },
    );

    await vi.waitFor(
      () => {
        expect(services.chatHistory.addToolResult).toHaveBeenCalledWith(
          expect.any(String),
          "Bash command failed: Command not found",
          "errored",
        );
      },
      { timeout: 1000 },
    );
  });

  it("should not trigger bash mode for regular messages", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);

    const result = await handleBashModeProcessing("Hello! How are you?");

    expect(result).toBe("Hello! How are you?"); // Pass through unchanged
    expect(mockRun).not.toHaveBeenCalled();
    expect(services.chatHistory.addAssistantMessage).not.toHaveBeenCalled();
  });

  it("should handle empty bash command", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);

    const result = await handleBashModeProcessing("!");

    expect(result).toBe("!"); // Pass through unchanged for empty command
    expect(mockRun).not.toHaveBeenCalled();
    expect(services.chatHistory.addAssistantMessage).not.toHaveBeenCalled();
  });

  it("should handle bash command with leading whitespace", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);
    mockRun.mockResolvedValue("echo test output");

    const result = await handleBashModeProcessing("   !echo hello");

    expect(result).toBe(null); // Processed, no further handling needed
    expect(services.chatHistory.addAssistantMessage).toHaveBeenCalled();

    // Use vi.waitFor to wait for async operations in the void expression
    await vi.waitFor(
      () => {
        expect(mockRun).toHaveBeenCalledWith({ command: "echo hello" });
      },
      { timeout: 1000 },
    );

    await vi.waitFor(
      () => {
        expect(services.chatHistory.addToolResult).toHaveBeenCalledWith(
          expect.any(String),
          "echo test output",
          "done",
        );
      },
      { timeout: 1000 },
    );
  });
});
