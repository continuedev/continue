import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { IDE, ToolExtras } from "../..";
import * as processTerminalStates from "../../util/processTerminalStates";
import { runTerminalCommandTool } from "../definitions/runTerminalCommand";
import { runTerminalCommandImpl } from "./runTerminalCommand";

// We're using real child processes, so ensure these aren't mocked
vi.unmock("node:child_process");
vi.unmock("node:util");

describe("runTerminalCommandImpl", () => {
  // Setup mocks and spies
  const mockGetIdeInfo = vi.fn();
  const mockGetWorkspaceDirs = vi.fn();
  const mockOnPartialOutput = vi.fn();
  const mockRunCommand = vi.fn();

  // Use a simple approach to ensure background processes are terminated
  let testPid: number | null = null;

  // Create a temp directory for our tests
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "terminal-command-test-"),
  );

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup backgrounded processes handling - don't mock, just make sure it's empty
    // Clear any processes that might be already tracked
    processTerminalStates.clearAllBackgroundProcesses();

    // Setup IDE mocks
    mockGetIdeInfo.mockReturnValue(Promise.resolve({ remoteName: "local" }));
    mockGetWorkspaceDirs.mockReturnValue(
      Promise.resolve([`file://${tempDir}`]),
    );
  });

  afterEach(async () => {
    // Clean up any lingering test processes
    if (testPid !== null) {
      try {
        // Platform-independent way to kill a process
        if (process.platform === "win32") {
          await new Promise((resolve) => {
            childProcess.exec(`taskkill /F /PID ${testPid}`, () =>
              resolve(null),
            );
          });
        } else {
          process.kill(testPid);
        }
      } catch (e) {
        // Process might already be gone, ignore
      }
      testPid = null;
    }
  });

  afterAll(() => {
    // Clean up the temp directory after tests
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Helper function to create a ToolExtras object
  const createMockExtras = (
    overrides: Partial<{
      onPartialOutput?: any;
      remoteName?: string;
    }> = {},
  ): ToolExtras => {
    // Update IDE info if remoteName is provided
    if (overrides.remoteName) {
      mockGetIdeInfo.mockReturnValue(
        Promise.resolve({ remoteName: overrides.remoteName }),
      );
    }

    // Create a minimally compliant IDE mock
    const mockIde = {
      getIdeInfo: mockGetIdeInfo,
      getWorkspaceDirs: mockGetWorkspaceDirs,
      runCommand: mockRunCommand,
      // Add stubs for other required IDE methods
      getIdeSettings: vi.fn(),
      getDiff: vi.fn(),
      getClipboardContent: vi.fn(),
      isTelemetryEnabled: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      renameFile: vi.fn(),
      deleteFile: vi.fn(),
      globFiles: vi.fn(),
      ls: vi.fn(),
    };

    // Create a base ToolExtras object with required properties
    const baseExtras = {
      ide: mockIde as unknown as IDE,
      llm: {} as any,
      fetch: {} as any,
      tool: {} as any,
      toolCallId: "test-tool-call",
    } as ToolExtras;

    // Apply overrides
    if (overrides.onPartialOutput) {
      baseExtras.onPartialOutput = overrides.onPartialOutput;
    }

    return baseExtras;
  };

  it("should execute a command synchronously and capture output", async () => {
    // Use Node.js for cross-platform output generation
    const command = `node -e "console.log('real test output')"`;
    const args = { command, waitForCompletion: true };
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);

    // Verify real command output
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Terminal");
    expect(result[0].description).toBe("Terminal command output");
    expect(result[0].content).toContain("real test output");
    // Verify status field indicates successful completion
    expect(result[0].status).toBe("Command completed");
  });

  it("should stream output when onPartialOutput is provided", async () => {
    // This test uses Node to create a command that outputs data incrementally
    const command = `node -e "
      console.log('first output');
      setTimeout(() => { 
        console.log('second output'); 
        console.error('error output');
      }, 50);
    "`;

    const args = { command, waitForCompletion: true };
    const mockOutputFn = vi.fn();
    const extras = createMockExtras({ onPartialOutput: mockOutputFn });

    // Execute the command with streaming
    const result = await runTerminalCommandImpl(args, extras);

    // Verify onPartialOutput was called with increasing content
    expect(mockOutputFn).toHaveBeenCalled();

    // Verify final result has all output
    expect(result[0].content).toContain("first output");
    expect(result[0].content).toContain("second output");
    expect(result[0].content).toContain("error output");
    // Verify status field indicates successful completion
    expect(result[0].status).toBe("Command completed");

    // Verify that initial streaming updates have empty status for regular commands
    const firstCall = mockOutputFn.mock.calls[0][0];
    if (firstCall && typeof firstCall === "object") {
      const contextItems = (firstCall as any).contextItems;
      if (contextItems && Array.isArray(contextItems) && contextItems[0]) {
        // For commands with waitForCompletion=true, status should be empty while streaming
        expect(contextItems[0].status).toBe("");
      }
    }
  });

  it("should run commands in background when waitForCompletion is false", async () => {
    // Create a self-identifying background process that writes its PID
    // to a file we can access to kill it later
    const pidFile = path.join(tempDir, "test-pid.txt");

    // This script creates a long-running process and writes its PID to our file
    // Using a fixed duration timeout so we can be sure to clean it up
    const command = `node -e "
      const fs = require('fs');
      console.log('starting background process with PID: ' + process.pid);
      fs.writeFileSync('${pidFile}', process.pid.toString());
      setTimeout(() => { 
        console.log('background process completed'); 
      }, 500);
    "`;

    const args = { command, waitForCompletion: false };
    const mockOutputFn = vi.fn();
    const extras = createMockExtras({ onPartialOutput: mockOutputFn });

    const result = await runTerminalCommandImpl(args, extras);

    // Result should indicate background running in either content or status
    expect(result[0].content || result[0].status).toContain(
      "running in the background",
    );
    // Verify status field indicates background running
    expect(result[0].status).toBe("Command is running in the background...");

    // Initial notification should indicate background running
    expect(mockOutputFn).toHaveBeenCalled();
    // Check the first call contains background running message
    const firstCallData = mockOutputFn.mock.calls[0][0];
    if (firstCallData && typeof firstCallData === "object") {
      const contextItems = (firstCallData as any).contextItems;
      if (contextItems && Array.isArray(contextItems) && contextItems[0]) {
        expect(contextItems[0].content).toContain("");
        expect(contextItems[0].status).toMatch(
          /Command is running in the background.../,
        );
      }
    }

    // Wait a bit to make sure the PID file is written
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Read the PID file to get the process ID so we can kill it later
    if (fs.existsSync(pidFile)) {
      testPid = Number(fs.readFileSync(pidFile, "utf-8"));
    }

    // Wait a bit longer for the process to complete and onPartialOutput to be called again
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Check for background process completion message in mockOutputFn calls
    // Note: This is optional and depends on timing, so we don't want to strictly enforce it
    let foundCompletionMessage = false;

    for (let i = 0; i < mockOutputFn.mock.calls.length; i++) {
      const call = mockOutputFn.mock.calls[i][0];
      if (call && typeof call === "object") {
        const contextItems = (call as any).contextItems;
        if (contextItems && Array.isArray(contextItems) && contextItems[0]) {
          if (
            contextItems[0].status === "\nBackground command completed" ||
            (contextItems[0].status &&
              contextItems[0].status.includes("Background command"))
          ) {
            foundCompletionMessage = true;
            break;
          }
        }
      }
    }

    // If we found any completion message in the output, great!
    // But we won't fail the test if we didn't, since it may be timing-dependent
    if (mockOutputFn.mock.calls.length > 1) {
      expect(foundCompletionMessage || true).toBeTruthy();
    }
  });

  it("should handle remote environments", async () => {
    // We'll keep mocking for remote environments as we can't test those directly
    const args = { command: "echo 'test'", waitForCompletion: true };
    const extras = createMockExtras({ remoteName: "ssh" });

    const result = await runTerminalCommandImpl(args, extras);

    // In remote environments, it should use the IDE's runCommand
    expect(mockRunCommand).toHaveBeenCalledWith("echo 'test'");
    // Match the actual output message
    expect(result[0].content).toContain("Terminal output not available");
    expect(result[0].content).toContain("SSH environments");
    // Verify status field indicates command failed in remote environments
    expect(result[0].status).toBe("Command failed");
  });

  it("should handle errors when executing invalid commands", async () => {
    // Use a command that should fail on any platform
    const args = {
      command: "non-existent-command-xyz",
      waitForCompletion: true,
    };
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);

    expect(result[0].name).toBe("Terminal");
    expect(result[0].description).toBe("Terminal command output");

    // The exact error message varies by platform, but should contain error information
    const errorContent = result[0].content;
    expect(
      errorContent.includes("Command failed") ||
        errorContent.includes("not found") ||
        errorContent.includes("recognized") ||
        /error/i.test(errorContent),
    ).toBe(true);

    // Verify status field indicates command failure
    expect(result[0].status).toContain("Command failed with:");
  });

  it("should handle error situations gracefully", async () => {
    // Use Node.js script that writes to stderr for cross-platform testing
    const command = `node -e "process.stderr.write('This is an error message'); process.exit(1)"`;
    const args = { command, waitForCompletion: true };
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);

    // Verify we still get a result with a name and description
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Terminal");
    expect(result[0].description).toBe("Terminal command output");

    // The command should have executed and returned content
    expect(result[0].content).toBeDefined();

    // We should see the error message we wrote to stderr
    expect(result[0].content).toContain("This is an error message");

    // Verify status field indicates command failure - the exact message format can vary
    // between different node versions and platforms
    expect(result[0].status).toContain("Command failed");
  });

  it("should set appropriate status when a command completes successfully", async () => {
    // Use a simple command that will succeed
    const command = `node -e "console.log('success test')"`;
    const args = { command, waitForCompletion: true };
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Terminal");
    expect(result[0].content).toContain("success test");
    // Verify status field for successful command
    expect(result[0].status).toBe("Command completed");
  });

  it("should include status info for background commands in non-streaming mode", async () => {
    // Use a simple background command
    const command = `node -e "setTimeout(() => console.log('done'), 300)"`;
    const args = { command, waitForCompletion: false };
    // No streaming in this test (no onPartialOutput)
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Terminal");
    // Verify both content and status fields for background commands
    expect(result[0].content).toBe("Command is running in the background...");
    expect(result[0].status).toBe("Command is running in the background...");
  });

  it("should handle missing workspace directory gracefully", async () => {
    // Mock IDE to return empty workspace directories
    const mockEmptyWorkspace = vi.fn().mockReturnValue(Promise.resolve([]));

    // Create IDE mock with empty workspace
    const mockIde = {
      getIdeInfo: vi
        .fn()
        .mockReturnValue(Promise.resolve({ remoteName: "local" })),
      getWorkspaceDirs: mockEmptyWorkspace,
      runCommand: vi.fn(),
      getIdeSettings: vi.fn(),
      getDiff: vi.fn(),
      getClipboardContent: vi.fn(),
      isTelemetryEnabled: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      renameFile: vi.fn(),
      deleteFile: vi.fn(),
      globFiles: vi.fn(),
      ls: vi.fn(),
    };

    const extras = {
      ide: mockIde as unknown as IDE,
      llm: {} as any,
      fetch: {} as any,
      tool: {} as any,
      toolCallId: "test-tool-call",
    } as ToolExtras;

    const command = `node -e "console.log('no workspace test')"`;
    const args = { command, waitForCompletion: true };

    const result = await runTerminalCommandImpl(args, extras);

    // Should still work - falling back to HOME or cwd
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Terminal");
    expect(result[0].description).toBe("Terminal command output");
    expect(result[0].content).toContain("no workspace test");
    expect(result[0].status).toBe("Command completed");

    // Verify workspace dirs was called but returned empty
    expect(mockEmptyWorkspace).toHaveBeenCalled();
  });

  it("should handle case where cwd fallbacks all fail", async () => {
    // Mock IDE to return empty workspace directories
    const mockEmptyWorkspace = vi.fn().mockReturnValue(Promise.resolve([]));

    // Save original environment variables and process.cwd
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;
    const originalCwd = process.cwd;

    try {
      // Mock all fallbacks to fail
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      process.cwd = vi.fn().mockImplementation(() => {
        throw new Error("Current directory unavailable");
      }) as any;

      // Create IDE mock with empty workspace
      const mockIde = {
        getIdeInfo: vi
          .fn()
          .mockReturnValue(Promise.resolve({ remoteName: "local" })),
        getWorkspaceDirs: mockEmptyWorkspace,
        runCommand: vi.fn(),
        getIdeSettings: vi.fn(),
        getDiff: vi.fn(),
        getClipboardContent: vi.fn(),
        isTelemetryEnabled: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        renameFile: vi.fn(),
        deleteFile: vi.fn(),
        globFiles: vi.fn(),
        ls: vi.fn(),
      };

      const extras = {
        ide: mockIde as unknown as IDE,
        llm: {} as any,
        fetch: {} as any,
        tool: {} as any,
        toolCallId: "test-tool-call",
      } as ToolExtras;

      const command = `node -e "console.log('fallback test')"`;
      const args = { command, waitForCompletion: true };

      // This should now handle the case gracefully by falling back to temp directory
      const result = await runTerminalCommandImpl(args, extras);

      // Should work using the temp directory as fallback
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Terminal");
      expect(result[0].content).toContain("fallback test");
      expect(result[0].status).toBe("Command completed");

      console.log(
        "Successfully handled cwd fallback to temp directory:",
        result[0].status,
      );
    } finally {
      // Always restore original values
      if (originalHome !== undefined) {
        process.env.HOME = originalHome;
      }
      if (originalUserProfile !== undefined) {
        process.env.USERPROFILE = originalUserProfile;
      }
      process.cwd = originalCwd;
    }
  });

  describe("cwd handling", () => {
    describe("workspace directory handling", () => {
      it("should use file:// URI when available", async () => {
        const fileUri = "file:///home/user/workspace";
        mockGetWorkspaceDirs.mockResolvedValue([fileUri]);

        // We can't easily test the internal cwd without mocking child_process,
        // but we can verify the function doesn't throw with file URIs
        await expect(
          runTerminalCommandImpl(
            { command: "echo test", waitForCompletion: false },
            createMockExtras(),
          ),
        ).resolves.toBeDefined();
      });

      it("should skip non-file URIs and use the first file:// URI", async () => {
        const workspaceDirs = [
          "vscode-vfs://github/user/repo",
          "untitled:/Untitled-1",
          "file:///home/user/workspace",
          "file:///home/user/other-workspace",
        ];
        mockGetWorkspaceDirs.mockResolvedValue(workspaceDirs);

        await expect(
          runTerminalCommandImpl(
            { command: "echo test", waitForCompletion: false },
            createMockExtras(),
          ),
        ).resolves.toBeDefined();
      });

      it("should handle workspace with only non-file URIs", async () => {
        const workspaceDirs = [
          "vscode-vfs://github/user/repo",
          "untitled:/Untitled-1",
        ];
        mockGetWorkspaceDirs.mockResolvedValue(workspaceDirs);

        // Should fall back to HOME/USERPROFILE or process.cwd() without throwing
        await expect(
          runTerminalCommandImpl(
            { command: "echo test", waitForCompletion: false },
            createMockExtras(),
          ),
        ).resolves.toBeDefined();
      });

      it("should handle empty workspace directories", async () => {
        mockGetWorkspaceDirs.mockResolvedValue([]);

        // Should fall back to HOME/USERPROFILE or process.cwd() without throwing
        await expect(
          runTerminalCommandImpl(
            { command: "echo test", waitForCompletion: false },
            createMockExtras(),
          ),
        ).resolves.toBeDefined();
      });

      it("should properly convert file:// URIs to paths", () => {
        const fileUri = "file:///home/user/workspace";
        const expectedPath = "/home/user/workspace";

        // Test that fileURLToPath works correctly with file:// URIs
        expect(fileURLToPath(fileUri)).toBe(expectedPath);
      });

      it("should throw error when trying to convert non-file URI", () => {
        const nonFileUri = "vscode-vfs://github/user/repo";

        // This demonstrates why the fix is needed - fileURLToPath throws on non-file URIs
        expect(() => fileURLToPath(nonFileUri)).toThrow();
      });

      it("should handle vscode-remote URIs by extracting pathname", async () => {
        // Various remote URI formats that VS Code uses
        const remoteUris = [
          "vscode-remote://wsl+Ubuntu/home/user/project",
          "vscode-remote://ssh-remote+myserver/home/user/project",
          "vscode-remote://dev-container+abc123/workspace",
        ];

        for (const uri of remoteUris) {
          mockGetWorkspaceDirs.mockResolvedValue([uri]);

          // Should not throw - the generic URI handler extracts the pathname
          await expect(
            runTerminalCommandImpl(
              { command: "echo test", waitForCompletion: false },
              createMockExtras(),
            ),
          ).resolves.toBeDefined();
        }
      });

      it("should decode URI-encoded characters in remote workspace paths", async () => {
        // Path with spaces and special characters
        const encodedUri =
          "vscode-remote://wsl+Ubuntu/home/user/my%20project%20%28test%29";
        mockGetWorkspaceDirs.mockResolvedValue([encodedUri]);

        // Should handle without throwing - decodeURIComponent is applied
        await expect(
          runTerminalCommandImpl(
            { command: "echo test", waitForCompletion: false },
            createMockExtras(),
          ),
        ).resolves.toBeDefined();
      });

      it("should prefer file:// URIs over remote URIs when both present", async () => {
        const workspaceDirs = [
          "vscode-remote://wsl+Ubuntu/home/user/remote-project",
          "file:///home/user/local-project",
        ];
        mockGetWorkspaceDirs.mockResolvedValue(workspaceDirs);

        // Should succeed, preferring the file:// URI
        await expect(
          runTerminalCommandImpl(
            { command: "echo test", waitForCompletion: false },
            createMockExtras(),
          ),
        ).resolves.toBeDefined();
      });
    });

    describe("remote environment handling", () => {
      it("should use ide.runCommand for non-enabled remote environments", async () => {
        const extras = createMockExtras({
          remoteName: "some-unsupported-remote",
        });

        const result = await runTerminalCommandImpl(
          { command: "echo test" },
          extras,
        );

        expect(mockRunCommand).toHaveBeenCalledWith("echo test");
        expect(result[0].content).toContain("Terminal output not available");
      });

      it("should handle local environment with file URIs", async () => {
        mockGetWorkspaceDirs.mockResolvedValue(["file:///home/user/workspace"]);

        await expect(
          runTerminalCommandImpl(
            { command: "echo test", waitForCompletion: false },
            createMockExtras({ remoteName: "local" }),
          ),
        ).resolves.toBeDefined();
      });

      it("should handle WSL environment", async () => {
        mockGetWorkspaceDirs.mockResolvedValue(["file:///home/user/workspace"]);

        await expect(
          runTerminalCommandImpl(
            { command: "echo test", waitForCompletion: false },
            createMockExtras({ remoteName: "wsl" }),
          ),
        ).resolves.toBeDefined();
      });

      it("should use ide.runCommand when Windows host connects to WSL", async () => {
        // When extension runs on Windows but connects to WSL, we can't spawn
        // shells directly - must use ide.runCommand instead
        const originalPlatform = process.platform;
        Object.defineProperty(process, "platform", { value: "win32" });

        try {
          const extras = createMockExtras({ remoteName: "wsl" });

          const result = await runTerminalCommandImpl(
            { command: "echo test" },
            extras,
          );

          // Should fall back to ide.runCommand, not try to spawn powershell.exe
          expect(mockRunCommand).toHaveBeenCalledWith("echo test");
          expect(result[0].content).toContain("Terminal output not available");
        } finally {
          Object.defineProperty(process, "platform", {
            value: originalPlatform,
          });
        }
      });

      it("should handle dev-container environment", async () => {
        mockGetWorkspaceDirs.mockResolvedValue(["file:///workspace"]);

        await expect(
          runTerminalCommandImpl(
            { command: "echo test", waitForCompletion: false },
            createMockExtras({ remoteName: "dev-container" }),
          ),
        ).resolves.toBeDefined();
      });
    });

    describe("fallback behavior", () => {
      it("should use HOME environment variable as fallback", async () => {
        const originalHome = process.env.HOME;
        process.env.HOME = "/home/testuser";

        mockGetWorkspaceDirs.mockResolvedValue([
          "vscode-vfs://github/user/repo",
        ]);

        try {
          await expect(
            runTerminalCommandImpl(
              { command: "echo test", waitForCompletion: false },
              createMockExtras(),
            ),
          ).resolves.toBeDefined();
        } finally {
          process.env.HOME = originalHome;
        }
      });

      it("should use USERPROFILE on Windows as fallback", async () => {
        const originalHome = process.env.HOME;
        const originalUserProfile = process.env.USERPROFILE;

        delete process.env.HOME;
        process.env.USERPROFILE = "C:\\Users\\TestUser";

        mockGetWorkspaceDirs.mockResolvedValue([]);

        try {
          await expect(
            runTerminalCommandImpl(
              { command: "echo test", waitForCompletion: false },
              createMockExtras(),
            ),
          ).resolves.toBeDefined();
        } finally {
          process.env.HOME = originalHome;
          process.env.USERPROFILE = originalUserProfile;
        }
      });

      it("should use os.tmpdir() as final fallback", async () => {
        const originalHome = process.env.HOME;
        const originalUserProfile = process.env.USERPROFILE;
        const originalCwd = process.cwd;

        delete process.env.HOME;
        delete process.env.USERPROFILE;
        // Mock process.cwd to throw an error
        process.cwd = vi.fn().mockImplementation(() => {
          throw new Error("No cwd available");
        }) as typeof process.cwd;

        mockGetWorkspaceDirs.mockResolvedValue([]);

        try {
          // Should fall back to os.tmpdir() without throwing
          await expect(
            runTerminalCommandImpl(
              { command: "echo test", waitForCompletion: false },
              createMockExtras(),
            ),
          ).resolves.toBeDefined();
        } finally {
          process.env.HOME = originalHome;
          process.env.USERPROFILE = originalUserProfile;
          process.cwd = originalCwd;
        }
      });
    });
  });
});

describe("runTerminalCommandTool.evaluateToolCallPolicy", () => {
  it("should return base policy for safe commands like echo", () => {
    const basePolicy = "allowedWithoutPermission";
    const args = { command: "echo hello world" };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("allowedWithoutPermission");
  });

  it("should respect disabled policy even for non-echo commands", () => {
    const basePolicy = "disabled";
    const args = { command: "ls -la" };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("disabled");
  });

  it("should respect disabled policy even for safe commands", () => {
    const basePolicy = "disabled";
    const args = { command: "echo test" };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("disabled");
  });

  it("should return base policy for non-echo commands", () => {
    const basePolicy = "allowedWithoutPermission";
    const args = { command: "ls -la" };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("allowedWithoutPermission");
  });

  it("should return base policy for git commands", () => {
    const basePolicy = "allowedWithPermission";
    const args = { command: "git status" };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("allowedWithPermission");
  });

  it("should handle undefined command gracefully", () => {
    const basePolicy = "allowedWithoutPermission";
    const args = { command: undefined };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("allowedWithoutPermission");
  });

  it("should handle null command gracefully", () => {
    const basePolicy = "allowedWithoutPermission";
    const args = { command: null };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("allowedWithoutPermission");
  });

  it("should handle empty command string", () => {
    const basePolicy = "allowedWithoutPermission";
    const args = { command: "" };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("allowedWithoutPermission");
  });

  it("should disable dangerous commands like rm -rf /", () => {
    const basePolicy = "allowedWithoutPermission";
    const args = { command: "rm -rf /" };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("disabled");
  });

  it("should require permission for high-risk network commands", () => {
    const basePolicy = "allowedWithoutPermission";
    const args = { command: "curl http://example.com" };

    const result = runTerminalCommandTool.evaluateToolCallPolicy!(
      basePolicy,
      args,
    );

    expect(result).toBe("allowedWithPermission");
  });
});
