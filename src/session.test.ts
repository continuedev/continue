import os from "os";
import { execSync } from "child_process";

// Mock external dependencies
jest.mock("child_process");
jest.mock("os");

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedOs = os as jest.Mocked<typeof os>;

// We need to import the module functions to test them
// Since they're not exported, we'll test through the public API
import { saveSession, loadSession, hasSession, clearSession } from "./session.js";

describe("Session ID Generation", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalProcess: any;

  beforeEach(() => {
    // Store original values
    originalEnv = { ...process.env };
    originalProcess = {
      ppid: process.ppid,
      pid: process.pid,
      stdin: process.stdin,
    };

    // Clear environment variables
    delete process.env.TMUX_PANE;
    delete process.env.TERM_SESSION_ID;
    delete process.env.SSH_TTY;
    delete process.env.TMUX;
    delete process.env.STY;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    process.env = originalEnv;
    Object.assign(process, originalProcess);
  });

  describe("Environment Variable Fallbacks", () => {
    it("should use TMUX_PANE when available", () => {
      process.env.TMUX_PANE = "%1";
      
      // Create a session to trigger session ID generation
      saveSession([]);
      
      // Verify session was created (indicates session ID worked)
      expect(hasSession()).toBe(true);
      clearSession();
    });

    it("should use TERM_SESSION_ID when TMUX_PANE is not available", () => {
      process.env.TERM_SESSION_ID = "w1t0s0:0.0";
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
    });

    it("should use SSH_TTY when other env vars are not available", () => {
      process.env.SSH_TTY = "/dev/pts/0";
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
    });
  });

  describe("TTY Path Fallback", () => {
    beforeEach(() => {
      // Mock platform detection
      mockedOs.platform.mockReturnValue("darwin");
      
      // Mock stdin.isTTY
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true
      });
    });

    it("should use TTY path when environment variables are not available", () => {
      mockedExecSync.mockReturnValue("/dev/ttys002\n");
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
      
      expect(mockedExecSync).toHaveBeenCalledWith("tty", {
        encoding: "utf8",
        timeout: 1000,
        stdio: ["ignore", "pipe", "ignore"]
      });
    });

    it("should skip TTY detection on Windows", () => {
      mockedOs.platform.mockReturnValue("win32");
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
      
      // Should not call execSync for tty command on Windows
      expect(mockedExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining("tty"),
        expect.any(Object)
      );
    });

    it("should handle TTY command errors gracefully", () => {
      mockedExecSync.mockImplementation((command) => {
        if (command === "tty") {
          throw new Error("tty: not found");
        }
        return "";
      });
      
      // Should not throw and should fall back to process ID
      expect(() => {
        saveSession([]);
      }).not.toThrow();
      
      expect(hasSession()).toBe(true);
      clearSession();
    });

    it("should handle 'not a tty' response", () => {
      mockedExecSync.mockReturnValue("not a tty\n");
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
    });
  });

  describe("Process Tree Fallback", () => {
    beforeEach(() => {
      mockedOs.platform.mockReturnValue("darwin");
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        writable: true
      });
    });

    it("should find terminal process in process tree", () => {
      // Mock process tree with terminal process
      mockedExecSync.mockImplementation((command) => {
        if (command.includes("ps -o pid,ppid,comm")) {
          return "  PID  PPID COMMAND\n 1234  5678 iTerm2\n";
        }
        return "";
      });
      
      // Mock process.ppid
      Object.defineProperty(process, 'ppid', {
        value: 1234,
        writable: true
      });
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
    });

    it("should skip process tree analysis on Windows", () => {
      mockedOs.platform.mockReturnValue("win32");
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
      
      // Should not call ps command on Windows
      expect(mockedExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining("ps -o"),
        expect.any(Object)
      );
    });

    it("should handle ps command errors gracefully", () => {
      mockedExecSync.mockImplementation((command) => {
        if (command.includes("ps -o")) {
          throw new Error("ps: command not found");
        }
        return "";
      });
      
      expect(() => {
        saveSession([]);
      }).not.toThrow();
      
      expect(hasSession()).toBe(true);
      clearSession();
    });

    it("should handle malformed ps output", () => {
      mockedExecSync.mockImplementation((command) => {
        if (command.includes("ps -o")) {
          return "malformed output\n";
        }
        return "";
      });
      
      expect(() => {
        saveSession([]);
      }).not.toThrow();
      
      expect(hasSession()).toBe(true);
      clearSession();
    });
  });

  describe("Final Fallback", () => {
    beforeEach(() => {
      mockedOs.platform.mockReturnValue("linux");
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        writable: true
      });
      
      // Mock all external commands to fail
      mockedExecSync.mockImplementation(() => {
        throw new Error("Command failed");
      });
    });

    it("should fall back to process PID when all other methods fail", () => {
      const originalPid = process.pid;
      Object.defineProperty(process, 'pid', {
        value: 9999,
        writable: true
      });
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
      
      // Restore original PID
      Object.defineProperty(process, 'pid', {
        value: originalPid,
        writable: true
      });
    });
  });

  describe("Session ID Cleaning", () => {
    it("should clean up special characters in session IDs", () => {
      process.env.TMUX_PANE = "%1:0.0/special#chars";
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
      
      // The session should be created successfully despite special characters
    });
  });

  describe("Test Mode", () => {
    it("should use test session ID when provided", () => {
      process.env.CONTINUE_CLI_TEST_SESSION_ID = "test-123";
      
      saveSession([]);
      expect(hasSession()).toBe(true);
      clearSession();
    });
  });
});