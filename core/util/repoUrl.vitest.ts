import { describe, expect, it } from "vitest";
import { normalizeRepoUrl } from "./repoUrl";

describe("normalizeRepoUrl", () => {
  describe("SSH format conversion", () => {
    it("should convert SSH format to HTTPS", () => {
      expect(normalizeRepoUrl("git@github.com:owner/repo.git")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should convert SSH format without .git suffix", () => {
      expect(normalizeRepoUrl("git@github.com:owner/repo")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should convert SSH format with uppercase to lowercase", () => {
      expect(normalizeRepoUrl("git@github.com:Owner/Repo.git")).toBe(
        "https://github.com/owner/repo",
      );
    });
  });

  describe("SSH protocol conversion", () => {
    it("should convert ssh:// protocol with slash separator", () => {
      expect(normalizeRepoUrl("ssh://git@github.com/owner/repo.git")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should convert ssh:// protocol with colon separator (less common)", () => {
      expect(normalizeRepoUrl("ssh://git@github.com:owner/repo.git")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should convert ssh:// protocol without .git suffix", () => {
      expect(normalizeRepoUrl("ssh://git@github.com/owner/repo")).toBe(
        "https://github.com/owner/repo",
      );
    });
  });

  describe("shorthand format conversion", () => {
    it("should convert owner/repo to full HTTPS URL", () => {
      expect(normalizeRepoUrl("owner/repo")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should convert shorthand with uppercase to lowercase", () => {
      expect(normalizeRepoUrl("Owner/Repo")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should handle shorthand with hyphens and underscores", () => {
      expect(normalizeRepoUrl("owner-name/repo_name")).toBe(
        "https://github.com/owner-name/repo_name",
      );
    });
  });

  describe(".git suffix removal", () => {
    it("should remove .git suffix from HTTPS URLs", () => {
      expect(normalizeRepoUrl("https://github.com/owner/repo.git")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should handle multiple transformations with .git removal", () => {
      expect(normalizeRepoUrl("git@github.com:owner/repo.git")).toBe(
        "https://github.com/owner/repo",
      );
    });
  });

  describe("trailing slash removal", () => {
    it("should remove trailing slash from URLs", () => {
      expect(normalizeRepoUrl("https://github.com/owner/repo/")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should handle both .git and trailing slash", () => {
      expect(normalizeRepoUrl("https://github.com/owner/repo.git/")).toBe(
        "https://github.com/owner/repo",
      );
    });
  });

  describe("case normalization", () => {
    it("should convert mixed case HTTPS URLs to lowercase", () => {
      expect(normalizeRepoUrl("https://github.com/Owner/Repo")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should convert all uppercase to lowercase", () => {
      expect(normalizeRepoUrl("HTTPS://GITHUB.COM/OWNER/REPO")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should handle mixed case in shorthand format", () => {
      expect(normalizeRepoUrl("ContinueDev/Continue")).toBe(
        "https://github.com/continuedev/continue",
      );
    });
  });

  describe("already normalized URLs", () => {
    it("should handle already normalized HTTPS URLs", () => {
      expect(normalizeRepoUrl("https://github.com/owner/repo")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should only lowercase already normalized URLs", () => {
      expect(normalizeRepoUrl("https://github.com/Owner/Repo")).toBe(
        "https://github.com/owner/repo",
      );
    });
  });

  describe("edge cases", () => {
    it("should return empty string for empty input", () => {
      expect(normalizeRepoUrl("")).toBe("");
    });

    it("should handle whitespace-only input", () => {
      expect(normalizeRepoUrl("   ")).toBe("");
    });

    it("should trim whitespace from input", () => {
      expect(normalizeRepoUrl("  owner/repo  ")).toBe(
        "https://github.com/owner/repo",
      );
    });

    it("should not modify non-GitHub git URLs", () => {
      // This function is GitHub-specific, other URLs just get lowercased
      expect(normalizeRepoUrl("https://gitlab.com/owner/repo")).toBe(
        "https://gitlab.com/owner/repo",
      );
    });

    it("should not convert non-GitHub SSH URLs to GitHub", () => {
      // Regression test: SSH URLs with protocols should not be treated as shorthands
      expect(normalizeRepoUrl("ssh://git@gitlab.com/owner/repo.git")).toBe(
        "ssh://git@gitlab.com/owner/repo",
      );
    });

    it("should handle URLs with port numbers", () => {
      expect(normalizeRepoUrl("https://github.com:443/owner/repo")).toBe(
        "https://github.com:443/owner/repo",
      );
    });

    it("should handle complex repository names", () => {
      expect(normalizeRepoUrl("owner/repo-with-dashes-123")).toBe(
        "https://github.com/owner/repo-with-dashes-123",
      );
    });

    it("should normalize shorthand with query parameters containing ://", () => {
      // Regression test: :// in query params should not prevent normalization
      expect(normalizeRepoUrl("owner/repo?redirect=https://example.com")).toBe(
        "https://github.com/owner/repo?redirect=https://example.com",
      );
    });

    it("should normalize shorthand with fragment containing ://", () => {
      expect(normalizeRepoUrl("owner/repo#section=https://example.com")).toBe(
        "https://github.com/owner/repo#section=https://example.com",
      );
    });
  });

  describe("real-world examples", () => {
    it("should normalize Continue's repository from SSH", () => {
      expect(normalizeRepoUrl("git@github.com:continuedev/continue.git")).toBe(
        "https://github.com/continuedev/continue",
      );
    });

    it("should normalize Continue's repository from shorthand", () => {
      expect(normalizeRepoUrl("continuedev/continue")).toBe(
        "https://github.com/continuedev/continue",
      );
    });

    it("should normalize Continue's repository from HTTPS", () => {
      expect(
        normalizeRepoUrl("https://github.com/continuedev/continue.git"),
      ).toBe("https://github.com/continuedev/continue");
    });

    it("should match repositories regardless of input format", () => {
      const formats = [
        "git@github.com:continuedev/continue.git",
        "continuedev/continue",
        "https://github.com/continuedev/continue",
        "https://github.com/continuedev/continue.git",
        "ssh://git@github.com/continuedev/continue.git",
        "ContinueDev/Continue",
      ];

      const expected = "https://github.com/continuedev/continue";
      formats.forEach((format) => {
        expect(normalizeRepoUrl(format)).toBe(expected);
      });
    });
  });
});
