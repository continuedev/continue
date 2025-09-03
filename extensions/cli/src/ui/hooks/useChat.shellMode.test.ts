import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMinimalTestContext } from "../../test-helpers/ui-test-context.js";
import { runTerminalCommandTool } from "../../tools/runTerminalCommand.js";

import { useChat } from "./useChat.js";

// Mock the runTerminalCommandTool
vi.mock("../../tools/runTerminalCommand.js", () => ({
  runTerminalCommandTool: {
    run: vi.fn(),
  },
}));

describe("useChat - Bash Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect bash mode when message starts with !", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);
    mockRun.mockResolvedValue(
      "total 5\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .\ndrwxr-xr-x 3 user user 4096 Jan 1 12:00 ..",
    );

    const ctx = createMinimalTestContext();
    const chat = useChat({
      assistant: { name: "test" } as any,
      model: { name: "test-model" } as any,
      llmApi: {} as any,
    } as any);

    await act(async () => {
      await chat.handleUserMessage("!ls -la");
    });

    expect(mockRun).toHaveBeenCalledWith({ command: "ls -la" });

    // Since history is managed by service, we just verify no exception and tool called
    ctx.cleanup();
  });

  it("should handle bash command errors", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);
    mockRun.mockRejectedValue(new Error("Command not found"));

    const chat = useChat({
      assistant: { name: "test" } as any,
      model: { name: "test-model" } as any,
      llmApi: {} as any,
    } as any);

    await act(async () => {
      await chat.handleUserMessage("!invalidcommand");
    });

    expect(mockRun).toHaveBeenCalledWith({ command: "invalidcommand" });
  });

  it("should not trigger bash mode for regular messages", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);

    const chat = useChat({
      assistant: { name: "test" } as any,
      model: { name: "test-model" } as any,
      llmApi: {} as any,
    } as any);

    await act(async () => {
      await chat.handleUserMessage("Hello! How are you?");
    });

    expect(mockRun).not.toHaveBeenCalled();
  });

  it("should handle empty bash command", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);

    const chat = useChat({
      assistant: { name: "test" } as any,
      model: { name: "test-model" } as any,
      llmApi: {} as any,
    } as any);

    await act(async () => {
      await chat.handleUserMessage("!");
    });

    // Should not call the tool for empty command
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("should handle bash command with leading whitespace", async () => {
    const mockRun = vi.mocked(runTerminalCommandTool.run);
    mockRun.mockResolvedValue("echo test output");

    const chat = useChat({
      assistant: { name: "test" } as any,
      model: { name: "test-model" } as any,
      llmApi: {} as any,
    } as any);

    await act(async () => {
      await chat.handleUserMessage("   !echo hello");
    });

    expect(mockRun).toHaveBeenCalledWith({ command: "echo hello" });
  });
});
