import {
  isRunningInWsl,
  runTerminalCommandTool,
} from "./runTerminalCommand.js";

describe("runTerminalCommandTool", () => {
  const isWindows = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";
  const originalMaxOutputBytes = process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_BYTES;
  const originalMaxOutputChars = process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_CHARS;
  const originalMaxOutputLines = process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_LINES;

  afterEach(() => {
    restoreEnv("CONTINUE_CLI_BASH_MAX_OUTPUT_BYTES", originalMaxOutputBytes);
    restoreEnv("CONTINUE_CLI_BASH_MAX_OUTPUT_CHARS", originalMaxOutputChars);
    restoreEnv("CONTINUE_CLI_BASH_MAX_OUTPUT_LINES", originalMaxOutputLines);
  });

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  function setTerminalOutputLimit(maxBytes: number) {
    process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_BYTES = String(maxBytes);
    process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_LINES = "1000000";
  }

  function nodeCommand(script: string): string {
    return `node -e "${script}"`;
  }

  function outputByteLength(output: string): number {
    return Buffer.byteLength(output, "utf8");
  }

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

  describe("output truncation", () => {
    it("should return small output unchanged", async () => {
      setTerminalOutputLimit(512);

      const result = await runTerminalCommandTool.run({
        command: nodeCommand("process.stdout.write('small output')"),
      });

      expect(result).toBe("small output");
    });

    it("should truncate large stdout to a bounded head and tail with an elision marker", async () => {
      const maxBytes = 512;
      setTerminalOutputLimit(maxBytes);

      const result = await runTerminalCommandTool.run({
        command: nodeCommand(
          "process.stdout.write('HEAD-' + 'A'.repeat(100000) + '-TAIL')",
        ),
      });

      expect(outputByteLength(result)).toBeLessThanOrEqual(maxBytes);
      expect(result).toContain("HEAD-");
      expect(result).toContain("-TAIL");
      expect(result).toContain("terminal_output_truncated");
      expect(result).toMatch(/omitted_bytes=\d+/);
      expect(result).toContain("bytes dropped");
    });

    it("should not truncate output exactly at the byte limit", async () => {
      const maxBytes = 256;
      setTerminalOutputLimit(maxBytes);

      const result = await runTerminalCommandTool.run({
        command: nodeCommand(`process.stdout.write('B'.repeat(${maxBytes}))`),
      });

      expect(outputByteLength(result)).toBe(maxBytes);
      expect(result).not.toContain("terminal_output_truncated");
    });

    it("should truncate output one byte over the byte limit", async () => {
      const maxBytes = 256;
      setTerminalOutputLimit(maxBytes);

      const result = await runTerminalCommandTool.run({
        command: nodeCommand(
          `process.stdout.write('C'.repeat(${maxBytes + 1}))`,
        ),
      });

      expect(outputByteLength(result)).toBeLessThanOrEqual(maxBytes);
      expect(result).toContain("terminal_output_truncated");
      expect(result).toMatch(/omitted_bytes=\d+/);
    });

    it("should cap failing command stderr before rejecting", async () => {
      const maxBytes = 512;
      setTerminalOutputLimit(maxBytes);

      try {
        await runTerminalCommandTool.run({
          command: nodeCommand(
            "process.stderr.write('ERR-' + 'E'.repeat(100000) + '-FAIL_TAIL'); process.exit(2)",
          ),
        });
        throw new Error("Expected command to fail");
      } catch (error) {
        const result = String(error);
        expect(outputByteLength(result)).toBeLessThanOrEqual(maxBytes);
        expect(result).toContain("Error (exit code 2):");
        expect(result).toContain("ERR-");
        expect(result).toContain("-FAIL_TAIL");
        expect(result).toContain("terminal_output_truncated");
        expect(result).toMatch(/omitted_bytes=\d+/);
      }
    });

    it("should cap assembled stdout and stderr output", async () => {
      const maxBytes = 512;
      setTerminalOutputLimit(maxBytes);

      const result = await runTerminalCommandTool.run({
        command: nodeCommand(
          "process.stdout.write('OUT-' + 'O'.repeat(100000)); process.stderr.write('ERR-' + 'E'.repeat(100000) + '-TAIL')",
        ),
      });

      expect(outputByteLength(result)).toBeLessThanOrEqual(maxBytes);
      expect(result).toContain("OUT-");
      expect(result).toContain("-TAIL");
      expect(result).toContain("terminal_output_truncated");
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
