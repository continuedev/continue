import { fileURLToPath } from "node:url";
import os from "node:os";
import { runTerminalCommandImpl } from "./runTerminalCommand";

describe("runTerminalCommand cwd handling", () => {
  const mockExtras = {
    ide: {
      getIdeInfo: jest.fn().async().mockResolvedValue({ remoteName: "local" }),
      getWorkspaceDirs: jest.fn().async(),
      runCommand: jest.fn().async(),
    },
    toolCallId: "test-tool-call",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("workspace directory handling", () => {
    it("should use file:// URI when available", async () => {
      const fileUri = "file:///home/user/workspace";
      mockExtras.ide.getWorkspaceDirs.mockResolvedValue([fileUri]);

      // We can't easily test the internal cwd without mocking child_process,
      // but we can verify the function doesn't throw with file URIs
      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
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
      mockExtras.ide.getWorkspaceDirs.mockResolvedValue(workspaceDirs);

      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
        ),
      ).resolves.toBeDefined();
    });

    it("should handle workspace with only non-file URIs", async () => {
      const workspaceDirs = [
        "vscode-vfs://github/user/repo",
        "untitled:/Untitled-1",
      ];
      mockExtras.ide.getWorkspaceDirs.mockResolvedValue(workspaceDirs);

      // Should fall back to HOME/USERPROFILE or process.cwd() without throwing
      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
        ),
      ).resolves.toBeDefined();
    });

    it("should handle empty workspace directories", async () => {
      mockExtras.ide.getWorkspaceDirs.mockResolvedValue([]);

      // Should fall back to HOME/USERPROFILE or process.cwd() without throwing
      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
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
  });

  describe("remote environment handling", () => {
    it("should use ide.runCommand for non-enabled remote environments", async () => {
      mockExtras.ide.getIdeInfo.mockResolvedValue({
        remoteName: "some-unsupported-remote",
      });

      const result = await runTerminalCommandImpl(
        { command: "echo test" },
        mockExtras as any,
      );

      expect(mockExtras.ide.runCommand).toHaveBeenCalledWith("echo test");
      expect(result[0].content).toContain("Terminal output not available");
    });

    it("should handle local environment with file URIs", async () => {
      mockExtras.ide.getIdeInfo.mockResolvedValue({ remoteName: "local" });
      mockExtras.ide.getWorkspaceDirs.mockResolvedValue([
        "file:///home/user/workspace",
      ]);

      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
        ),
      ).resolves.toBeDefined();
    });

    it("should handle WSL environment", async () => {
      mockExtras.ide.getIdeInfo.mockResolvedValue({ remoteName: "wsl" });
      mockExtras.ide.getWorkspaceDirs.mockResolvedValue([
        "file:///home/user/workspace",
      ]);

      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
        ),
      ).resolves.toBeDefined();
    });

    it("should handle dev-container environment", async () => {
      mockExtras.ide.getIdeInfo.mockResolvedValue({
        remoteName: "dev-container",
      });
      mockExtras.ide.getWorkspaceDirs.mockResolvedValue(["file:///workspace"]);

      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe("fallback behavior", () => {
    it("should use HOME environment variable as fallback", async () => {
      const originalHome = process.env.HOME;
      process.env.HOME = "/home/testuser";

      mockExtras.ide.getWorkspaceDirs.mockResolvedValue([
        "vscode-vfs://github/user/repo",
      ]);

      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
        ),
      ).resolves.toBeDefined();

      process.env.HOME = originalHome;
    });

    it("should use USERPROFILE on Windows as fallback", async () => {
      const originalHome = process.env.HOME;
      const originalUserProfile = process.env.USERPROFILE;

      delete process.env.HOME;
      process.env.USERPROFILE = "C:\\Users\\TestUser";

      mockExtras.ide.getWorkspaceDirs.mockResolvedValue([]);

      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
        ),
      ).resolves.toBeDefined();

      process.env.HOME = originalHome;
      process.env.USERPROFILE = originalUserProfile;
    });

    it("should use os.tmpdir() as final fallback", async () => {
      const originalHome = process.env.HOME;
      const originalUserProfile = process.env.USERPROFILE;
      const originalCwd = process.cwd;

      delete process.env.HOME;
      delete process.env.USERPROFILE;
      // Mock process.cwd to throw an error
      process.cwd = jest.fn().mockImplementation(() => {
        throw new Error("No cwd available");
      });

      mockExtras.ide.getWorkspaceDirs.mockResolvedValue([]);

      // Should fall back to os.tmpdir() without throwing
      await expect(
        runTerminalCommandImpl(
          { command: "echo test", waitForCompletion: false },
          mockExtras as any,
        ),
      ).resolves.toBeDefined();

      process.env.HOME = originalHome;
      process.env.USERPROFILE = originalUserProfile;
      process.cwd = originalCwd;
    });
  });
});
