import { runTerminalCommandTool } from "./runTerminalCommand.js";

describe("runTerminalCommandTool", () => {
  const TEST_TIMEOUT_MS = 1000; // 1 second for tests

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.TEST_TERMINAL_TIMEOUT = String(TEST_TIMEOUT_MS);
  });

  afterAll(() => {
    delete process.env.TEST_TERMINAL_TIMEOUT;
  });
  describe("basic command execution", () => {
    it("should execute simple echo command and return stdout", async () => {
      const result = await runTerminalCommandTool.run({
        command: "echo 'hello world'",
      });
      expect(result.trim()).toBe("hello world");
    });

    it("should execute pwd command and return current directory", async () => {
      const result = await runTerminalCommandTool.run({ command: "pwd" });
      expect(result.trim()).toMatch(/^\/.*$/); // Should be an absolute path
    });

    it("should execute directory listing command and return file listings", async () => {
      // Use a cross-platform command that works on both Unix and Windows
      const command = process.platform === "win32" ? "dir" : "ls -la .";
      const result = await runTerminalCommandTool.run({ command });

      // On Windows, look for <DIR> entries, on Unix look for . and ..
      if (process.platform === "win32") {
        expect(result).toContain(".");
      } else {
        expect(result).toContain(".");
        expect(result).toContain("..");
      }
    });

    it("should handle commands with multiple arguments", async () => {
      const result = await runTerminalCommandTool.run({
        command: "echo 'arg1' 'arg2' 'arg3'",
      });
      expect(result.trim()).toBe("arg1 arg2 arg3");
    });
  });

  describe("error handling", () => {
    it("should reject with error message for non-existent commands", async () => {
      await expect(
        runTerminalCommandTool.run({ command: "nonexistentcommand12345" }),
      ).rejects.toMatch(/Error \(exit code 127\):/);
    });

    it("should handle commands with non-zero exit codes and stderr", async () => {
      await expect(
        runTerminalCommandTool.run({
          command: "sh -c 'echo error >&2; exit 1'",
        }),
      ).rejects.toMatch(/Error \(exit code 1\): error/);
    });

    it("should resolve when commands have non-zero exit codes but no stderr", async () => {
      const result = await runTerminalCommandTool.run({
        command: "sh -c 'exit 1'",
      });
      expect(result).toBe("");
    });

    it("should handle commands that write to stderr", async () => {
      const result = await runTerminalCommandTool.run({
        command: 'sh -c \'echo "error message" >&2; echo "success"\'',
      });
      expect(result).toContain("success");
      expect(result).toContain("Stderr: error message");
    });
  });

  describe("timeout functionality", () => {
    it(
      "should timeout commands that produce no output for configured duration",
      async () => {
        // Create a command that sleeps longer than the timeout
        const sleepDuration = TEST_TIMEOUT_MS / 1000 + 0.5; // Sleep 0.5s longer than timeout
        const startTime = Date.now();
        const result = await runTerminalCommandTool.run({
          command: `sleep ${sleepDuration}`,
        });
        const endTime = Date.now();
        const elapsed = endTime - startTime;

        // Should timeout within a reasonable margin of the configured timeout
        expect(elapsed).toBeLessThan(TEST_TIMEOUT_MS + 200); // Allow 200ms margin
        expect(elapsed).toBeGreaterThan(TEST_TIMEOUT_MS - 100); // Allow 100ms margin
        expect(result).toContain(
          `[Command timed out after ${TEST_TIMEOUT_MS / 1000} seconds of no output]`,
        );
      },
      TEST_TIMEOUT_MS + 2000,
    ); // Set test timeout with buffer

    it(
      "should not timeout commands that continuously produce output",
      async () => {
        // Create a command that produces output at intervals shorter than timeout
        const outputInterval = TEST_TIMEOUT_MS / 1000 / 3; // Output 3 times within timeout period
        const iterations = 3;
        const startTime = Date.now();
        const result = await runTerminalCommandTool.run({
          command: `for i in $(seq 1 ${iterations}); do echo "output $i"; sleep ${outputInterval}; done`,
        });
        const endTime = Date.now();

        // Should complete normally
        expect(endTime - startTime).toBeLessThan(TEST_TIMEOUT_MS * 2);
        expect(result).toContain("output 1");
        expect(result).toContain(`output ${iterations}`);
        expect(result).not.toContain("[Command timed out");
      },
      TEST_TIMEOUT_MS * 3,
    ); // Set test timeout with buffer

    it(
      "should reset timeout when command produces stderr output",
      async () => {
        // Create a command that produces stderr output periodically
        const outputInterval = TEST_TIMEOUT_MS / 1000 / 3; // Output 3 times within timeout period
        const iterations = 3;
        const startTime = Date.now();
        const result = await runTerminalCommandTool.run({
          command: `for i in $(seq 1 ${iterations}); do echo "error $i" >&2; sleep ${outputInterval}; done; echo 'done'`,
        });
        const endTime = Date.now();

        // Should complete normally
        expect(endTime - startTime).toBeLessThan(TEST_TIMEOUT_MS * 2);
        expect(result).toContain("done");
        expect(result).toContain("Stderr: error 1");
        expect(result).not.toContain("[Command timed out");
      },
      TEST_TIMEOUT_MS * 3,
    ); // Set test timeout with buffer

    it(
      "should include partial output when timing out",
      async () => {
        // Create a command that produces some output then stops
        const sleepDuration = TEST_TIMEOUT_MS / 1000 + 0.5; // Sleep longer than timeout
        const result = await runTerminalCommandTool.run({
          command: `echo 'initial output'; sleep ${sleepDuration}`,
        });

        expect(result).toContain("initial output");
        expect(result).toContain(
          `[Command timed out after ${TEST_TIMEOUT_MS / 1000} seconds of no output]`,
        );
      },
      TEST_TIMEOUT_MS + 2000,
    ); // Set test timeout with buffer
  });

  describe("output handling", () => {
    it("should preserve line breaks in output", async () => {
      const result = await runTerminalCommandTool.run({
        command: "printf 'line1\\nline2\\nline3'",
      });
      expect(result).toContain("line1\nline2\nline3");
    });

    it("should handle empty output", async () => {
      const result = await runTerminalCommandTool.run({ command: "true" });
      expect(result).toBe("");
    });

    it("should handle large output", async () => {
      // Generate a command that produces substantial output
      const result = await runTerminalCommandTool.run({
        command: "seq 1 1000",
      });
      expect(result).toContain("1\n");
      expect(result).toContain("1000");
      // Count lines to ensure all output is captured
      const lines = result.trim().split("\n");
      expect(lines).toHaveLength(1000);
    });

    it("should truncate output when it exceeds 5000 lines", async () => {
      // Generate a command that produces more than 5000 lines
      const result = await runTerminalCommandTool.run({
        command: "seq 1 6000",
      });

      // Should contain the truncation message
      expect(result).toContain(
        "[Output truncated to first 5000 lines of 6001 total]",
      );

      // Should contain first line
      expect(result).toContain("1\n");

      // Should contain line 5000 but not line 6000
      expect(result).toContain("5000");
      expect(result).not.toContain("6000");

      // Count lines in the result - should be 5000 content lines + 2 truncation message lines
      const lines = result.split("\n");
      expect(lines).toHaveLength(5002); // 5000 content lines + empty line + truncation message
    });
  });

  describe("command types", () => {
    it("should handle shell built-ins", async () => {
      const result = await runTerminalCommandTool.run({ command: "echo $PWD" });
      expect(result.trim()).toMatch(/^\/.*$/);
    });

    it("should handle commands with pipes", async () => {
      const result = await runTerminalCommandTool.run({
        command: "echo 'hello world' | wc -w",
      });
      expect(result.trim()).toBe("2");
    });

    it("should handle commands with redirections", async () => {
      const result = await runTerminalCommandTool.run({
        command:
          "echo 'test' > /tmp/test-file && cat /tmp/test-file && rm /tmp/test-file",
      });
      expect(result.trim()).toBe("test");
    });

    it("should handle commands with environment variables", async () => {
      const result = await runTerminalCommandTool.run({
        command: "TEST_VAR='hello' sh -c 'echo $TEST_VAR'",
      });
      expect(result.trim()).toBe("hello");
    });
  });
});
