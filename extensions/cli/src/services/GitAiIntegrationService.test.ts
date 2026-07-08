import type { ChildProcess } from "child_process";
import { EventEmitter } from "events";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { PreprocessedToolCall } from "../tools/types.js";

import { GitAiIntegrationService } from "./GitAiIntegrationService.js";

// Mock child_process
vi.mock("child_process", () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

// Mock session functions
vi.mock("../session.js", () => ({
  getCurrentSession: vi.fn(),
  getSessionFilePath: vi.fn(),
}));

// Mock serviceContainer
vi.mock("./ServiceContainer.js", () => ({
  serviceContainer: {
    getSync: vi.fn(),
  },
}));

// Mock logger
vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("GitAiIntegrationService", () => {
  let service: GitAiIntegrationService;
  let mockExec: any;
  let mockSpawn: any;
  let mockGetCurrentSession: any;
  let mockGetSessionFilePath: any;
  let mockServiceContainer: any;

  beforeEach(async () => {
    // Import mocked modules
    const childProcess = await import("child_process");
    const session = await import("../session.js");
    const { serviceContainer } = await import("./ServiceContainer.js");

    mockExec = childProcess.exec as any;
    mockSpawn = childProcess.spawn as any;
    mockGetCurrentSession = session.getCurrentSession as any;
    mockGetSessionFilePath = session.getSessionFilePath as any;
    mockServiceContainer = serviceContainer;

    // Setup default mocks
    mockGetCurrentSession.mockReturnValue({
      sessionId: "test-session-id",
      workspaceDirectory: "/test/workspace",
      chatModelTitle: "claude-sonnet-4-5",
    });

    mockGetSessionFilePath.mockReturnValue(
      "/test/.continue/sessions/test-session-id.json",
    );

    mockServiceContainer.getSync.mockReturnValue({
      value: {
        model: {
          model: "claude-sonnet-4-5",
        },
      },
    });

    service = new GitAiIntegrationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should check if git-ai is available on initialization", async () => {
      mockExec.mockImplementation((_cmd: string, callback: Function) => {
        callback(null); // No error = git-ai is available
      });

      const state = await service.initialize();

      expect(state.isEnabled).toBe(true);
      expect(state.isGitAiAvailable).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        "git-ai --version",
        expect.any(Function),
      );
    });

    it("should mark git-ai as unavailable if version check fails", async () => {
      mockExec.mockImplementation((_cmd: string, callback: Function) => {
        callback(new Error("command not found")); // Error = git-ai not available
      });

      const state = await service.initialize();

      expect(state.isEnabled).toBe(true);
      expect(state.isGitAiAvailable).toBe(false);
    });
  });

  describe("trackToolUse", () => {
    beforeEach(async () => {
      mockExec.mockImplementation((_cmd: string, callback: Function) => {
        callback(null); // git-ai is available
      });
      await service.initialize();
    });

    it("should not track non-file-editing tools", async () => {
      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Bash",
        arguments: { command: "ls" },
        argumentsStr: JSON.stringify({ command: "ls" }),
        startNotified: false,
        tool: {} as any,
      };

      await service.trackToolUse(toolCall, "PreToolUse");

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should track Edit tool usage", async () => {
      const mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: {
            resolvedPath: "/test/file.ts",
          },
        },
      };

      await service.trackToolUse(toolCall, "PreToolUse");

      expect(mockSpawn).toHaveBeenCalledWith(
        "git-ai",
        ["checkpoint", "continue-cli", "--hook-input", "stdin"],
        { cwd: "/test/workspace" },
      );

      // Check that the correct JSON was written to stdin
      const writtenData = (mockProcess.stdin!.write as any).mock.calls[0][0];
      const hookInput = JSON.parse(writtenData);

      expect(hookInput).toMatchObject({
        session_id: "test-session-id",
        transcript_path: "/test/.continue/sessions/test-session-id.json",
        cwd: "/test/workspace",
        model: "claude-sonnet-4-5",
        hook_event_name: "PreToolUse",
        tool_input: {
          file_path: "/test/file.ts",
        },
      });
    });

    it("should track MultiEdit tool usage", async () => {
      const mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "MultiEdit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: {
            file_path: "/test/file.ts",
          },
        },
      };

      await service.trackToolUse(toolCall, "PostToolUse");

      const writtenData = (mockProcess.stdin!.write as any).mock.calls[0][0];
      const hookInput = JSON.parse(writtenData);

      expect(hookInput.hook_event_name).toBe("PostToolUse");
      expect(hookInput.tool_input.file_path).toBe("/test/file.ts");
    });

    it("should track Write tool usage", async () => {
      const mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Write",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: {
            filepath: "/test/newfile.ts",
          },
        },
      };

      await service.trackToolUse(toolCall, "PreToolUse");

      const writtenData = (mockProcess.stdin!.write as any).mock.calls[0][0];
      const hookInput = JSON.parse(writtenData);

      expect(hookInput.tool_input.file_path).toBe("/test/newfile.ts");
    });

    it("should not track if no file path is found", async () => {
      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: {}, // No file path
        },
      };

      await service.trackToolUse(toolCall, "PreToolUse");

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should not track if service is disabled", async () => {
      service.setEnabled(false);

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: { resolvedPath: "/test/file.ts" },
        },
      };

      await service.trackToolUse(toolCall, "PreToolUse");

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should not track if git-ai is unavailable", async () => {
      // Reinitialize with git-ai unavailable
      mockExec.mockImplementation((_cmd: string, callback: Function) => {
        callback(new Error("not found"));
      });
      await service.initialize();

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: { resolvedPath: "/test/file.ts" },
        },
      };

      await service.trackToolUse(toolCall, "PreToolUse");

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should omit model field if model is not available", async () => {
      mockServiceContainer.getSync.mockReturnValue({
        value: {
          model: null,
        },
      });

      const mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: { resolvedPath: "/test/file.ts" },
        },
      };

      await service.trackToolUse(toolCall, "PreToolUse");

      const writtenData = (mockProcess.stdin!.write as any).mock.calls[0][0];
      const hookInput = JSON.parse(writtenData);

      expect(hookInput.model).toBeUndefined();
    });

    it("should handle git-ai errors gracefully", async () => {
      const mockProcess = createMockChildProcess(1); // Exit with error code
      mockSpawn.mockReturnValue(mockProcess);

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: { resolvedPath: "/test/file.ts" },
        },
      };

      // Should not throw
      await expect(
        service.trackToolUse(toolCall, "PreToolUse"),
      ).resolves.toBeUndefined();

      // Should mark git-ai as unavailable
      const state = service.getState();
      expect(state.isGitAiAvailable).toBe(false);
    });

    it("should handle spawn errors gracefully", async () => {
      const mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: { resolvedPath: "/test/file.ts" },
        },
      };

      // Trigger an error event
      setTimeout(() => {
        mockProcess.emit("error", new Error("spawn failed"));
      }, 0);

      // Should not throw
      await expect(
        service.trackToolUse(toolCall, "PreToolUse"),
      ).resolves.toBeUndefined();

      // Should mark git-ai as unavailable
      const state = service.getState();
      expect(state.isGitAiAvailable).toBe(false);
    });
  });

  describe("extractFilePathFromToolCall", () => {
    it("should extract path from Edit tool", () => {
      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: { resolvedPath: "/test/edit.ts" },
        },
      };

      const result = service.extractFilePathFromToolCall(toolCall);
      expect(result).toBe("/test/edit.ts");
    });

    it("should extract path from MultiEdit tool", () => {
      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "MultiEdit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: { file_path: "/test/multiedit.ts" },
        },
      };

      const result = service.extractFilePathFromToolCall(toolCall);
      expect(result).toBe("/test/multiedit.ts");
    });

    it("should extract path from Write tool", () => {
      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Write",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: { filepath: "/test/write.ts" },
        },
      };

      const result = service.extractFilePathFromToolCall(toolCall);
      expect(result).toBe("/test/write.ts");
    });

    it("should return null if no preprocessResult", () => {
      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
      };

      const result = service.extractFilePathFromToolCall(toolCall);
      expect(result).toBeNull();
    });

    it("should return null if no args", () => {
      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {} as any,
      };

      const result = service.extractFilePathFromToolCall(toolCall);
      expect(result).toBeNull();
    });

    it("should return null for unknown tool", () => {
      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "UnknownTool",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: {} as any,
        preprocessResult: {
          args: { somePath: "/test/file.ts" },
        },
      };

      const result = service.extractFilePathFromToolCall(toolCall);
      expect(result).toBeNull();
    });
  });

  describe("setEnabled", () => {
    it("should enable the service", () => {
      service.setEnabled(true);
      const state = service.getState();
      expect(state.isEnabled).toBe(true);
    });

    it("should disable the service", () => {
      service.setEnabled(false);
      const state = service.getState();
      expect(state.isEnabled).toBe(false);
    });
  });
});

/**
 * Helper function to create a mock ChildProcess
 */
function createMockChildProcess(exitCode: number = 0): ChildProcess {
  const mockProcess = new EventEmitter() as any;

  mockProcess.stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };

  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();

  // Simulate process completion after a short delay
  setTimeout(() => {
    mockProcess.emit("close", exitCode);
  }, 10);

  return mockProcess;
}
