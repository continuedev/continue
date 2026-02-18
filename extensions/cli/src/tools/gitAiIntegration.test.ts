import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PreprocessedToolCall } from "./types.js";

import { executeToolCall } from "./index.js";

// Mock the services
vi.mock("../services/index.js", () => ({
  services: {
    gitAiIntegration: {
      trackToolUse: vi.fn().mockResolvedValue(undefined),
    },
  },
  SERVICE_NAMES: {},
  serviceContainer: {},
}));

// Mock telemetry services
vi.mock("../telemetry/telemetryService.js", () => ({
  telemetryService: {
    logToolResult: vi.fn(),
  },
}));

vi.mock("../telemetry/posthogService.js", () => ({
  posthogService: {
    capture: vi.fn(),
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

describe("Git AI Integration - executeToolCall", () => {
  let mockGitAiService: any;

  beforeEach(async () => {
    const { services } = await import("../services/index.js");
    mockGitAiService = services.gitAiIntegration;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("File editing tools", () => {
    it("should call git-ai before and after Edit tool execution", async () => {
      const mockTool = {
        run: vi.fn().mockResolvedValue("Edit completed"),
      };

      const toolCall: PreprocessedToolCall = {
        id: "test-edit-id",
        name: "Edit",
        arguments: { file_path: "/test/file.ts" },
        argumentsStr: JSON.stringify({ file_path: "/test/file.ts" }),
        startNotified: false,
        tool: mockTool as any,
        preprocessResult: {
          args: {
            resolvedPath: "/test/file.ts",
            oldContent: "old",
            newContent: "new",
          },
          context: { toolCallId: "test-edit-id" },
        },
      };

      const result = await executeToolCall(toolCall);

      expect(result).toBe("Edit completed");

      // Should call trackToolUse twice: PreToolUse and PostToolUse
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledTimes(2);

      // Check PreToolUse call
      expect(mockGitAiService.trackToolUse).toHaveBeenNthCalledWith(
        1,
        toolCall,
        "PreToolUse",
      );

      // Check PostToolUse call
      expect(mockGitAiService.trackToolUse).toHaveBeenNthCalledWith(
        2,
        toolCall,
        "PostToolUse",
      );

      // Verify tool.run was called
      expect(mockTool.run).toHaveBeenCalledWith(
        {
          resolvedPath: "/test/file.ts",
          oldContent: "old",
          newContent: "new",
        },
        {
          toolCallId: "test-edit-id",
          parallelToolCallCount: 1,
        },
      );
    });

    it("should call git-ai before and after MultiEdit tool execution", async () => {
      const mockTool = {
        run: vi.fn().mockResolvedValue("MultiEdit completed"),
      };

      const toolCall: PreprocessedToolCall = {
        id: "test-multiedit-id",
        name: "MultiEdit",
        arguments: { file_path: "/test/file.ts" },
        argumentsStr: JSON.stringify({ file_path: "/test/file.ts" }),
        startNotified: false,
        tool: mockTool as any,
        preprocessResult: {
          args: {
            file_path: "/test/file.ts",
            edits: [],
          },
        },
      };

      await executeToolCall(toolCall);

      expect(mockGitAiService.trackToolUse).toHaveBeenCalledTimes(2);
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledWith(
        toolCall,
        "PreToolUse",
      );
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledWith(
        toolCall,
        "PostToolUse",
      );
    });

    it("should call git-ai before and after Write tool execution", async () => {
      const mockTool = {
        run: vi.fn().mockResolvedValue("Write completed"),
      };

      const toolCall: PreprocessedToolCall = {
        id: "test-write-id",
        name: "Write",
        arguments: { filepath: "/test/newfile.ts" },
        argumentsStr: JSON.stringify({ filepath: "/test/newfile.ts" }),
        startNotified: false,
        tool: mockTool as any,
        preprocessResult: {
          args: {
            filepath: "/test/newfile.ts",
            content: "new content",
          },
        },
      };

      await executeToolCall(toolCall);

      expect(mockGitAiService.trackToolUse).toHaveBeenCalledTimes(2);
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledWith(
        toolCall,
        "PreToolUse",
      );
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledWith(
        toolCall,
        "PostToolUse",
      );
    });

    it("should complete file edit even if git-ai tracking encounters errors internally", async () => {
      // Note: trackToolUse has internal error handling, so it won't throw
      // This test verifies that the tool execution completes normally
      const mockTool = {
        run: vi.fn().mockResolvedValue("Edit completed despite internal error"),
      };

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: mockTool as any,
        preprocessResult: {
          args: { resolvedPath: "/test/file.ts" },
        },
      };

      const result = await executeToolCall(toolCall);

      expect(result).toBe("Edit completed despite internal error");
      expect(mockTool.run).toHaveBeenCalled();
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledTimes(2);
    });
  });

  describe("Non-file editing tools", () => {
    it("should call trackToolUse for Bash tool (service will no-op internally)", async () => {
      const mockTool = {
        run: vi.fn().mockResolvedValue("Command output"),
      };

      const toolCall: PreprocessedToolCall = {
        id: "test-bash-id",
        name: "Bash",
        arguments: { command: "ls" },
        argumentsStr: JSON.stringify({ command: "ls" }),
        startNotified: false,
        tool: mockTool as any,
      };

      await executeToolCall(toolCall);

      // trackToolUse is called but service checks isFileEdit internally
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledTimes(2);
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledWith(
        toolCall,
        "PreToolUse",
      );
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledWith(
        toolCall,
        "PostToolUse",
      );
      expect(mockTool.run).toHaveBeenCalled();
    });

    it("should call trackToolUse for Read tool (service will no-op internally)", async () => {
      const mockTool = {
        run: vi.fn().mockResolvedValue("File contents"),
      };

      const toolCall: PreprocessedToolCall = {
        id: "test-read-id",
        name: "Read",
        arguments: { file_path: "/test/file.ts" },
        argumentsStr: JSON.stringify({ file_path: "/test/file.ts" }),
        startNotified: false,
        tool: mockTool as any,
      };

      await executeToolCall(toolCall);

      expect(mockGitAiService.trackToolUse).toHaveBeenCalledTimes(2);
      expect(mockTool.run).toHaveBeenCalled();
    });

    it("should call trackToolUse for Grep tool (service will no-op internally)", async () => {
      const mockTool = {
        run: vi.fn().mockResolvedValue("Search results"),
      };

      const toolCall: PreprocessedToolCall = {
        id: "test-grep-id",
        name: "Grep",
        arguments: { pattern: "test" },
        argumentsStr: JSON.stringify({ pattern: "test" }),
        startNotified: false,
        tool: mockTool as any,
      };

      await executeToolCall(toolCall);

      expect(mockGitAiService.trackToolUse).toHaveBeenCalledTimes(2);
      expect(mockTool.run).toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should propagate tool execution errors", async () => {
      const mockTool = {
        run: vi.fn().mockRejectedValue(new Error("Tool execution failed")),
      };

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: mockTool as any,
        preprocessResult: {
          args: { resolvedPath: "/test/file.ts" },
        },
      };

      await expect(executeToolCall(toolCall)).rejects.toThrow(
        "Tool execution failed",
      );

      // PreToolUse should have been called
      expect(mockGitAiService.trackToolUse).toHaveBeenCalledWith(
        toolCall,
        "PreToolUse",
      );
    });
  });

  describe("Execution order", () => {
    it("should execute in correct order: PreToolUse -> tool.run -> PostToolUse", async () => {
      const executionOrder: string[] = [];

      mockGitAiService.trackToolUse.mockImplementation(
        (_toolCall: any, phase: string) => {
          executionOrder.push(`git-ai:${phase}`);
          return Promise.resolve();
        },
      );

      const mockTool = {
        run: vi.fn().mockImplementation(() => {
          executionOrder.push("tool:run");
          return Promise.resolve("result");
        }),
      };

      const toolCall: PreprocessedToolCall = {
        id: "test-id",
        name: "Edit",
        arguments: {},
        argumentsStr: JSON.stringify({}),
        startNotified: false,
        tool: mockTool as any,
        preprocessResult: {
          args: { resolvedPath: "/test/file.ts" },
        },
      };

      await executeToolCall(toolCall);

      expect(executionOrder).toEqual([
        "git-ai:PreToolUse",
        "tool:run",
        "git-ai:PostToolUse",
      ]);
    });
  });
});
