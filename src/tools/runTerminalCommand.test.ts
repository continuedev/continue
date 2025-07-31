import { runTerminalCommandTool } from "./runTerminalCommand.js";

describe("runTerminalCommandTool", () => {
  describe("basic command execution", () => {
    it("should execute simple echo command and return stdout", async () => {
      const result = await runTerminalCommandTool.run({ command: "echo 'hello world'" });
      expect(result.trim()).toBe("hello world");
    });

    it("should execute pwd command and return current directory", async () => {
      const result = await runTerminalCommandTool.run({ command: "pwd" });
      expect(result.trim()).toMatch(/^\/.*$/); // Should be an absolute path
    });

    it("should execute ls command and return file listings", async () => {
      const result = await runTerminalCommandTool.run({ command: "ls -la ." });
      expect(result).toContain(".");
      expect(result).toContain("..");
    });

    it("should handle commands with multiple arguments", async () => {
      const result = await runTerminalCommandTool.run({ command: "echo 'arg1' 'arg2' 'arg3'" });
      expect(result.trim()).toBe("arg1 arg2 arg3");
    });
  });

  describe("error handling", () => {
    it("should reject with error message for non-existent commands", async () => {
      await expect(runTerminalCommandTool.run({ command: "nonexistentcommand12345" }))
        .rejects.toMatch(/Error \(exit code 127\):/);
    });

    it("should handle commands with non-zero exit codes and stderr", async () => {
      await expect(runTerminalCommandTool.run({ command: "sh -c 'echo error >&2; exit 1'" }))
        .rejects.toMatch(/Error \(exit code 1\): error/);
    });

    it("should resolve when commands have non-zero exit codes but no stderr", async () => {
      const result = await runTerminalCommandTool.run({ command: "sh -c 'exit 1'" });
      expect(result).toBe("");
    });

    it("should handle commands that write to stderr", async () => {
      const result = await runTerminalCommandTool.run({ command: "sh -c 'echo \"error message\" >&2; echo \"success\"'" });
      expect(result).toContain("success");
      expect(result).toContain("Stderr: error message");
    });
  });

  describe("timeout functionality", () => {
    it("should timeout commands that produce no output for 30+ seconds", async () => {
      // Create a command that sleeps for 35 seconds without producing output
      const startTime = Date.now();
      const result = await runTerminalCommandTool.run({ command: "sleep 35" });
      const endTime = Date.now();
      
      // Should timeout in roughly 30 seconds, not 35
      expect(endTime - startTime).toBeLessThan(32000);
      expect(endTime - startTime).toBeGreaterThan(29000);
      expect(result).toContain("[Command timed out after 30 seconds of no output]");
    }, 35000); // Set Jest timeout to 35 seconds for this test

    it("should not timeout commands that continuously produce output", async () => {
      // Create a command that produces output every second for 5 seconds
      const startTime = Date.now();
      const result = await runTerminalCommandTool.run({ 
        command: "for i in 1 2 3 4 5; do echo \"output $i\"; sleep 1; done" 
      });
      const endTime = Date.now();
      
      // Should complete normally in about 5 seconds
      expect(endTime - startTime).toBeLessThan(10000);
      expect(result).toContain("output 1");
      expect(result).toContain("output 5");
      expect(result).not.toContain("[Command timed out");
    }, 15000); // Set Jest timeout to 15 seconds for this test

    it("should reset timeout when command produces stderr output", async () => {
      // Create a command that produces stderr output periodically
      const startTime = Date.now();
      const result = await runTerminalCommandTool.run({ 
        command: "for i in 1 2 3; do echo \"error $i\" >&2; sleep 1; done; echo 'done'" 
      });
      const endTime = Date.now();
      
      // Should complete normally in about 3 seconds
      expect(endTime - startTime).toBeLessThan(8000);
      expect(result).toContain("done");
      expect(result).toContain("Stderr: error 1");
      expect(result).not.toContain("[Command timed out");
    }, 12000); // Set Jest timeout to 12 seconds for this test

    it("should include partial output when timing out", async () => {
      // Create a command that produces some output then stops
      const result = await runTerminalCommandTool.run({ 
        command: "echo 'initial output'; sleep 35" 
      });
      
      expect(result).toContain("initial output");
      expect(result).toContain("[Command timed out after 30 seconds of no output]");
    }, 35000); // Set Jest timeout to 35 seconds for this test
  });

  describe("output handling", () => {
    it("should preserve line breaks in output", async () => {
      const result = await runTerminalCommandTool.run({ 
        command: "printf 'line1\\nline2\\nline3'" 
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
        command: "seq 1 1000" 
      });
      expect(result).toContain("1\n");
      expect(result).toContain("1000");
      // Count lines to ensure all output is captured
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(1000);
    });
  });

  describe("command types", () => {
    it("should handle shell built-ins", async () => {
      const result = await runTerminalCommandTool.run({ command: "echo $PWD" });
      expect(result.trim()).toMatch(/^\/.*$/);
    });

    it("should handle commands with pipes", async () => {
      const result = await runTerminalCommandTool.run({ 
        command: "echo 'hello world' | wc -w" 
      });
      expect(result.trim()).toBe("2");
    });

    it("should handle commands with redirections", async () => {
      const result = await runTerminalCommandTool.run({ 
        command: "echo 'test' > /tmp/test-file && cat /tmp/test-file && rm /tmp/test-file" 
      });
      expect(result.trim()).toBe("test");
    });

    it("should handle commands with environment variables", async () => {
      const result = await runTerminalCommandTool.run({ 
        command: "TEST_VAR='hello' sh -c 'echo $TEST_VAR'" 
      });
      expect(result.trim()).toBe("hello");
    });
  });
});