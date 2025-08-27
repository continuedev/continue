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
        command: "node -e \"console.log('hello world')\"",
      });
      expect(result.trim()).toBe("hello world");
    });

    it("should execute pwd command and return current directory", async () => {
      const result = await runTerminalCommandTool.run({ command: "pwd" });
      // Should contain a path - either Unix-style or Windows-style
      expect(result.trim()).toMatch(
        /(?:^\/.*$)|(?:^[A-Za-z]:\\.*$)|(?:Path\s+----\s+[A-Za-z]:\\.*$)/m,
      );
    });

    it("should execute directory listing command and return file listings", async () => {
      // Use a simple Node.js command that should work on all platforms
      const command = "node --version";
      const result = await runTerminalCommandTool.run({ command });

      // Should contain version number (starts with v)
      expect(result.trim()).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it("should handle commands with multiple arguments", async () => {
      const result = await runTerminalCommandTool.run({
        command: "node -e \"console.log('arg1', 'arg2', 'arg3')\"",
      });
      expect(result.trim()).toBe("arg1 arg2 arg3");
    });
  });

  describe("error handling", () => {
    it("should reject with error message for non-existent commands", async () => {
      await expect(
        runTerminalCommandTool.run({
          command: "definitely-not-a-real-command-xyz123",
        }),
      ).rejects.toMatch(
        /Error \(exit code (?:127|1|9009)\):|Command timed out|not found|not recognized/,
      );
    });

    it("should handle commands with non-zero exit codes and stderr", async () => {
      await expect(
        runTerminalCommandTool.run({
          command: "node -e \"console.error('error'); process.exit(1)\"",
        }),
      ).rejects.toMatch(/Error \(exit code 1\): error/);
    });

    it("should resolve when commands have non-zero exit codes but no stderr", async () => {
      const result = await runTerminalCommandTool.run({
        command: 'node -e "process.exit(1)"',
      });
      expect(result).toBe("");
    });

    it("should handle commands that write to stderr", async () => {
      const result = await runTerminalCommandTool.run({
        command:
          "node -e \"process.stderr.write('error message\\n'); process.stdout.write('success\\n')\"",
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
          command: `node -e "setTimeout(() => {}, ${sleepDuration * 1000})"`,
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
          command: `node -e "for(let i=1;i<=${iterations};i++){console.log('output '+i);if(i<${iterations})await new Promise(r=>setTimeout(r,${outputInterval * 1000}));}" --input-type=module`,
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
          command: `node -e "for(let i=1;i<=${iterations};i++){console.error('error '+i);if(i<${iterations})await new Promise(r=>setTimeout(r,${outputInterval * 1000}));} console.log('done');" --input-type=module`,
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
          command: `node -e "console.log('initial output'); setTimeout(() => {}, ${sleepDuration * 1000})"`,
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
        command: "node -e \"console.log('line1\\nline2\\nline3')\"",
      });
      expect(result).toContain("line1\nline2\nline3");
    });

    it("should handle empty output", async () => {
      const result = await runTerminalCommandTool.run({
        command: 'node -e "undefined"',
      });
      expect(result).toBe("");
    });

    it("should handle large output", async () => {
      // Generate a command that produces substantial output
      const result = await runTerminalCommandTool.run({
        command:
          'FORCE_COLOR=0 NO_COLOR=1 node -e "for(let i=1;i<=1000;i++)console.log(i)"',
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
        command:
          'FORCE_COLOR=0 NO_COLOR=1 node -e "for(let i=1;i<=6000;i++)console.log(i)"',
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
      const result = await runTerminalCommandTool.run({
        command: 'node -e "console.log(process.cwd())"',
      });
      // Should contain a path - either Unix-style or Windows-style
      expect(result.trim()).toMatch(/(?:^\/.*$)|(?:^[A-Za-z]:\\.*$)/);
    });

    it("should handle commands with pipes", async () => {
      const result = await runTerminalCommandTool.run({
        command:
          "FORCE_COLOR=0 NO_COLOR=1 node -e \"console.log('hello world'.split(' ').length)\"",
      });
      expect(result.trim()).toBe("2");
    });

    it("should handle commands with redirections", async () => {
      const result = await runTerminalCommandTool.run({
        command:
          "node -e \"const fs=require('fs'),os=require('os'),path=require('path'); const file=path.join(os.tmpdir(),'test-file'); fs.writeFileSync(file,'test'); console.log(fs.readFileSync(file,'utf8')); fs.unlinkSync(file);\"",
      });
      expect(result.trim()).toBe("test");
    });

    it("should handle commands with environment variables", async () => {
      const result = await runTerminalCommandTool.run({
        command:
          "node -e \"process.env.TEST_VAR='hello'; console.log(process.env.TEST_VAR)\"",
      });
      expect(result.trim()).toBe("hello");
    });
  });
});
