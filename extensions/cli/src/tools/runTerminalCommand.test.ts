import {
  isRunningInWsl,
  runTerminalCommandTool,
} from "./runTerminalCommand.js";

describe("runTerminalCommandTool", () => {
  const isWindows = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";

  describe("commands that leave a background process", () => {
    // The shell exits right away but `sleep` keeps the output pipe open; the
    // tool used to wait for the pipe to close, i.e. for the timeout.
    it.skipIf(process.platform === "win32")(
      "returns when the shell exits, without waiting for the background child",
      async () => {
        const started = Date.now();
        const result = await runTerminalCommandTool.run({
          command: "sleep 30 & echo started",
        });
        expect(result).toContain("started");
        expect(Date.now() - started).toBeLessThan(10_000);
      },
      20_000,
    );
  });

  describe("basic platform-specific terminal execution", () => {
    it("should execute a simple echo command", async () => {
      let command: string;
      let expectedOutput: string;

      if (isWindows) {
        command = 'Write-Output "hello world"';
        expectedOutput = "hello world";
      } else {
        command = 'echo "hello world"';
        expectedOutput = "hello world";
      }

      const result = await runTerminalCommandTool.run({ command });
      expect(result.trim()).toBe(expectedOutput);
    });

    it("should get current directory", async () => {
      let command: string;

      if (isWindows) {
        command = "Get-Location | Select-Object -ExpandProperty Path";
      } else {
        command = "pwd";
      }

      const result = await runTerminalCommandTool.run({ command });

      if (isWindows) {
        // Windows paths like C:\path\to\dir
        expect(result.trim()).toMatch(/^[A-Za-z]:\\.*/);
      } else {
        // Unix paths like /path/to/dir
        expect(result.trim()).toMatch(/^\/.*$/);
      }
    });

    it("should list directory contents", async () => {
      let command: string;

      if (isWindows) {
        command = "Get-ChildItem | Select-Object -ExpandProperty Name";
      } else {
        command = "ls";
      }

      const result = await runTerminalCommandTool.run({ command });
      // Should return some directory content (not empty)
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle command that produces version info", async () => {
      // Node.js should be available on all platforms in CI
      const command = "node --version";
      const result = await runTerminalCommandTool.run({ command });

      // Should contain version number (starts with v)
      expect(result.trim()).toMatch(/^v\d+\.\d+\.\d+/);
    });
  });

  describe("basic error handling", () => {
    it("should handle non-existent commands", async () => {
      const command = "definitely-not-a-real-command-xyz123";

      await expect(runTerminalCommandTool.run({ command })).rejects.toMatch(
        /Error \(exit code|Command timed out|not found|not recognized/,
      );
    });
  });

  describe("platform-specific features", () => {
    if (isWindows) {
      it("should work with Windows commands", async () => {
        const result = await runTerminalCommandTool.run({
          command: "Write-Output $env:OS",
        });
        expect(result.trim()).toBe("Windows_NT");
      });
    }

    if (isMac) {
      it("should work with macOS commands", async () => {
        const result = await runTerminalCommandTool.run({
          command: "uname -s",
        });
        expect(result.trim()).toBe("Darwin");
      });
    }

    if (isLinux) {
      it("should work with Linux commands", async () => {
        const result = await runTerminalCommandTool.run({
          command: "uname -s",
        });
        expect(result.trim()).toBe("Linux");
      });
    }
  });

  describe("WSL detection", () => {
    it("should cache the WSL detection result", () => {
      const firstResult = isRunningInWsl();
      const secondResult = isRunningInWsl();
      expect(firstResult).toBe(secondResult);
    });

    if (!isLinux) {
      it("should return false on non-Linux platforms", () => {
        expect(isRunningInWsl()).toBe(false);
      });
    }
  });
});
