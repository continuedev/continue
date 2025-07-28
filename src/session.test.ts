import { saveSession, hasSession, clearSession } from "./session.js";

describe("Session Management", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    
    // Clear session-related environment variables
    delete process.env.TMUX_PANE;
    delete process.env.TERM_SESSION_ID;
    delete process.env.SSH_TTY;
    delete process.env.TMUX;
    delete process.env.STY;
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up any test sessions
    try {
      clearSession();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Environment Variable Session IDs", () => {
    it("should create unique sessions for different TMUX_PANE values", () => {
      // Test first session
      process.env.TMUX_PANE = "%1";
      saveSession([{ role: "user", content: "test1" }]);
      expect(hasSession()).toBe(true);
      clearSession();

      // Test second session with different TMUX_PANE
      process.env.TMUX_PANE = "%2";
      saveSession([{ role: "user", content: "test2" }]);
      expect(hasSession()).toBe(true);
      clearSession();
    });

    it("should use TERM_SESSION_ID when TMUX_PANE is not available", () => {
      process.env.TERM_SESSION_ID = "w1t0s0:0.0";
      
      saveSession([{ role: "user", content: "test" }]);
      expect(hasSession()).toBe(true);
      clearSession();
    });

    it("should use SSH_TTY when other env vars are not available", () => {
      process.env.SSH_TTY = "/dev/pts/0";
      
      saveSession([{ role: "user", content: "test" }]);
      expect(hasSession()).toBe(true);
      clearSession();
    });

    it("should clean special characters from session IDs", () => {
      process.env.TMUX_PANE = "%1:0.0/special#chars@test!";
      
      // Should not throw error despite special characters
      expect(() => {
        saveSession([{ role: "user", content: "test" }]);
      }).not.toThrow();
      
      expect(hasSession()).toBe(true);
      clearSession();
    });
  });

  describe("Test Mode", () => {
    it("should use test session ID when provided", () => {
      process.env.CONTINUE_CLI_TEST_SESSION_ID = "test-123";
      
      saveSession([{ role: "user", content: "test" }]);
      expect(hasSession()).toBe(true);
      clearSession();
    });
  });

  describe("Fallback Mechanisms", () => {
    it("should create a session even when no environment variables are available", () => {
      // No environment variables set
      
      // Should fall back to TTY path, process tree, or PID
      expect(() => {
        saveSession([{ role: "user", content: "fallback test" }]);
      }).not.toThrow();
      
      expect(hasSession()).toBe(true);
      clearSession();
    });

    it("should handle session persistence correctly", () => {
      process.env.TMUX_PANE = "%test";
      
      const testHistory = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" }
      ];
      
      // Save session
      saveSession(testHistory);
      expect(hasSession()).toBe(true);
      
      // Clear and verify it's gone
      clearSession();
      expect(hasSession()).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle filesystem errors gracefully", () => {
      // Try to save to invalid session ID that might cause filesystem issues
      process.env.CONTINUE_CLI_TEST_SESSION_ID = "test-with-various-chars";
      
      expect(() => {
        saveSession([{ role: "user", content: "test" }]);
      }).not.toThrow();
      
      clearSession();
    });
  });
});