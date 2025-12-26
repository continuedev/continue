import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";

/**
 * Test suite for workspace directory resolution logic.
 *
 * This tests the URI parsing behavior used in runTerminalCommand.ts
 * to ensure correct handling of various workspace URI formats.
 */

// Replicate the resolution logic for testing
function resolveWorkingDirectory(workspaceDirs: string[]): string {
  // Handle vscode-remote://wsl+distro/path URIs (WSL2 remote workspaces)
  const wslWorkspaceDir = workspaceDirs.find((dir) =>
    dir.startsWith("vscode-remote://wsl"),
  );
  if (wslWorkspaceDir) {
    try {
      const url = new URL(wslWorkspaceDir);
      return decodeURIComponent(url.pathname);
    } catch {
      // Fall through to other handlers
    }
  }

  // Handle file:// URIs (local workspaces)
  const fileWorkspaceDir = workspaceDirs.find((dir) =>
    dir.startsWith("file:/"),
  );
  if (fileWorkspaceDir) {
    try {
      return fileURLToPath(fileWorkspaceDir);
    } catch {
      // Fall through to default handling
    }
  }

  // Default to user's home directory with fallbacks
  try {
    return process.env.HOME || process.env.USERPROFILE || process.cwd();
  } catch {
    return "/tmp";
  }
}

describe("resolveWorkingDirectory", () => {
  describe("WSL remote URIs (vscode-remote://wsl+...)", () => {
    it("should parse basic WSL URI", () => {
      const result = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu/home/user/project",
      ]);
      expect(result).toBe("/home/user/project");
    });

    it("should decode URL-encoded spaces in path", () => {
      const result = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu/home/user/my%20project",
      ]);
      expect(result).toBe("/home/user/my project");
    });

    it("should decode URL-encoded special characters", () => {
      const result = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu/home/user/path%23with%23hashes",
      ]);
      expect(result).toBe("/home/user/path#with#hashes");
    });

    it("should decode URL-encoded unicode characters", () => {
      const result = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu/home/user/%E4%B8%AD%E6%96%87%E8%B7%AF%E5%BE%84",
      ]);
      expect(result).toBe("/home/user/中文路径");
    });

    it("should handle different WSL distro names", () => {
      const ubuntu = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu-22.04/home/user/project",
      ]);
      expect(ubuntu).toBe("/home/user/project");

      const debian = resolveWorkingDirectory([
        "vscode-remote://wsl+Debian/home/user/project",
      ]);
      expect(debian).toBe("/home/user/project");
    });

    it("should handle root path", () => {
      const result = resolveWorkingDirectory(["vscode-remote://wsl+Ubuntu/"]);
      expect(result).toBe("/");
    });

    it("should prioritize WSL URIs over file:// URIs", () => {
      const result = resolveWorkingDirectory([
        "file:///c:/Users/user/project",
        "vscode-remote://wsl+Ubuntu/home/user/project",
      ]);
      expect(result).toBe("/home/user/project");
    });
  });

  describe("file:// URIs (local workspaces)", () => {
    it("should parse basic file:// URI on Unix", () => {
      const result = resolveWorkingDirectory(["file:///home/user/project"]);
      expect(result).toBe("/home/user/project");
    });

    it("should decode URL-encoded spaces in file:// URI", () => {
      const result = resolveWorkingDirectory([
        "file:///home/user/my%20project",
      ]);
      expect(result).toBe("/home/user/my project");
    });

    it("should handle Windows-style file:// URI", () => {
      // fileURLToPath handles Windows paths correctly
      const result = resolveWorkingDirectory(["file:///C:/Users/user/project"]);
      // On Unix, this will be /C:/Users/user/project
      // On Windows, this will be C:\Users\user\project
      expect(result).toMatch(/project$/);
    });
  });

  describe("fallback behavior", () => {
    it("should fall back to HOME when no valid URIs", () => {
      const originalHome = process.env.HOME;
      try {
        process.env.HOME = "/test/home";
        const result = resolveWorkingDirectory([]);
        expect(result).toBe("/test/home");
      } finally {
        process.env.HOME = originalHome;
      }
    });

    it("should handle empty workspace dirs array", () => {
      const result = resolveWorkingDirectory([]);
      // Should return HOME or USERPROFILE or cwd
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle invalid URIs gracefully", () => {
      const result = resolveWorkingDirectory([
        "not-a-valid-uri",
        "also://not/handled",
      ]);
      // Should fall through to HOME fallback
      expect(typeof result).toBe("string");
    });

    it("should handle malformed vscode-remote URI", () => {
      const result = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu", // Missing path
      ]);
      // new URL() should still parse this, pathname would be empty or "/"
      expect(typeof result).toBe("string");
    });
  });

  describe("URL encoding edge cases", () => {
    it("should handle plus signs (not spaces)", () => {
      // In URL encoding, + is literal plus, %2B is encoded plus, %20 is space
      const result = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu/home/user/c%2B%2B-project",
      ]);
      expect(result).toBe("/home/user/c++-project");
    });

    it("should handle percent sign itself", () => {
      const result = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu/home/user/100%25-complete",
      ]);
      expect(result).toBe("/home/user/100%-complete");
    });

    it("should handle mixed encoded and unencoded characters", () => {
      const result = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu/home/user/normal-path/with%20space/more",
      ]);
      expect(result).toBe("/home/user/normal-path/with space/more");
    });
  });

  describe("comparison with fileURLToPath behavior", () => {
    it("should match fileURLToPath decoding for equivalent paths", () => {
      const fileResult = fileURLToPath("file:///home/user/my%20project");
      const wslResult = resolveWorkingDirectory([
        "vscode-remote://wsl+Ubuntu/home/user/my%20project",
      ]);

      // Both should decode %20 to space
      expect(fileResult).toBe("/home/user/my project");
      expect(wslResult).toBe("/home/user/my project");
    });
  });
});
