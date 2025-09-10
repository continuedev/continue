import { describe, expect, it, vi, beforeEach } from "vitest";

import { getResponsiveRepoText, getRepoInfo } from "./useTUIChatHooks.js";

// Mock the git utilities
vi.mock("../../util/git.js", () => ({
  isGitRepo: vi.fn(() => true),
  getGitRemoteUrl: vi.fn(() => "https://github.com/testuser/testrepo.git"),
  getGitBranch: vi.fn(() => "feature/test-branch"),
}));

describe("Responsive repo text functionality", () => {
  beforeEach(async () => {
    // Reset mocks before each test
    const gitModule = await import("../../util/git.js");
    vi.mocked(gitModule.isGitRepo).mockReturnValue(true);
    vi.mocked(gitModule.getGitRemoteUrl).mockReturnValue(
      "https://github.com/testuser/testrepo.git",
    );
    vi.mocked(gitModule.getGitBranch).mockReturnValue("feature/test-branch");
  });
  describe("getRepoInfo", () => {
    it("should extract repo info correctly", () => {
      const info = getRepoInfo();

      expect(info.repoName).toBe("testuser/testrepo");
      expect(info.branchName).toBe("feature/test-branch");
      expect(info.isGitRepo).toBe(true);
    });

    it("should handle remote URL override", () => {
      const info = getRepoInfo("https://github.com/override/repo.git");

      expect(info.repoName).toBe("override/repo");
      expect(info.branchName).toBe("feature/test-branch");
      expect(info.isGitRepo).toBe(true);
    });
  });

  describe("getResponsiveRepoText", () => {
    it("should return empty string when no width provided", () => {
      const result = getResponsiveRepoText();
      expect(result).toBe("");
    });

    it("should return full text when width allows", () => {
      const result = getResponsiveRepoText(undefined, 100);
      expect(result).toBe("testuser/testrepo ⊦feature/test-branch");
    });

    it("should prefer branch when both fit individually", () => {
      // Full text: "testuser/testrepo ⊦ feature/test-branch" (38 chars)
      // Repo only: "testuser/testrepo" (17 chars)
      // Branch only: "feature/test-branch" (18 chars)
      // With width 20, both repo and branch fit, but we prefer branch
      const result = getResponsiveRepoText(undefined, 20);
      expect(result).toBe("feature/test-branch");
    });

    it("should fallback to repo when branch doesn't fit but repo does", async () => {
      // Use a long branch name
      const gitModule = await import("../../util/git.js");
      vi.mocked(gitModule.getGitBranch).mockReturnValue(
        "very-long-feature-branch-name-that-wont-fit",
      );

      const result = getResponsiveRepoText(undefined, 20);
      // Branch is too long, repo should fit
      expect(result).toBe("testuser/testrepo");
    });

    it("should return branch only when repo doesn't fit but branch does", async () => {
      // When space is very limited, prefer shorter option
      const gitModule = await import("../../util/git.js");
      vi.mocked(gitModule.getGitRemoteUrl).mockReturnValue(
        "https://github.com/very-long-repo-name/testrepo.git",
      );
      vi.mocked(gitModule.getGitBranch).mockReturnValue("main");

      const result = getResponsiveRepoText(undefined, 10);
      // "main" (4 chars) should fit, "very-long-repo-name/testrepo" won't
      expect(result).toBe("main");
    });

    it("should return empty string when nothing fits", () => {
      const result = getResponsiveRepoText(undefined, 5);
      expect(result).toBe("");
    });

    it("should return empty string when width is too small", () => {
      const result = getResponsiveRepoText(undefined, 2);
      expect(result).toBe("");
    });

    it("should handle non-git repos", async () => {
      const gitModule = await import("../../util/git.js");
      vi.mocked(gitModule.isGitRepo).mockReturnValue(false);
      vi.mocked(gitModule.getGitBranch).mockReturnValue(null);

      const result = getResponsiveRepoText(
        "https://github.com/user/repo.git",
        50,
      );
      expect(result).toBe("user/repo");
    });

    it("should return empty string when repo name is too long in non-git scenario", async () => {
      const gitModule = await import("../../util/git.js");
      vi.mocked(gitModule.isGitRepo).mockReturnValue(false);

      const result = getResponsiveRepoText(
        "https://github.com/very-long-user/repo.git",
        8,
      );
      expect(result).toBe("");
    });
  });
});
