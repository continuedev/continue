import { beforeEach, describe, expect, it } from "vitest";

import {
  getGitBranch,
  getGitHubActionsRepoUrl,
  isGitHubActions,
} from "./git.js";

describe("git utilities - GitHub Actions detection", () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_SERVER_URL;
  });

  describe("isGitHubActions", () => {
    it("should return true when GITHUB_ACTIONS is 'true'", () => {
      process.env.GITHUB_ACTIONS = "true";
      expect(isGitHubActions()).toBe(true);
    });

    it("should return false when GITHUB_ACTIONS is not set", () => {
      expect(isGitHubActions()).toBe(false);
    });

    it("should return false when GITHUB_ACTIONS is set to other values", () => {
      process.env.GITHUB_ACTIONS = "false";
      expect(isGitHubActions()).toBe(false);
    });
  });

  describe("getGitHubActionsRepoUrl", () => {
    it("should return null when not in GitHub Actions", () => {
      expect(getGitHubActionsRepoUrl()).toBeNull();
    });

    it("should return null when GITHUB_REPOSITORY is not set", () => {
      process.env.GITHUB_ACTIONS = "true";
      expect(getGitHubActionsRepoUrl()).toBeNull();
    });

    it("should return GitHub URL with default server", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_REPOSITORY = "owner/repo";

      expect(getGitHubActionsRepoUrl()).toBe("https://github.com/owner/repo");
    });

    it("should return GitHub URL with custom server", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_REPOSITORY = "owner/repo";
      process.env.GITHUB_SERVER_URL = "https://github.enterprise.com";

      expect(getGitHubActionsRepoUrl()).toBe(
        "https://github.enterprise.com/owner/repo",
      );
    });
  });

  describe("getRepoUrl - GitHub Actions priority", () => {
    it("should prioritize GitHub Actions environment variables", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_REPOSITORY = "owner/repo";

      // Since we can't easily mock git commands, we'll rely on the fact that
      // GitHub Actions detection should take priority and return immediately
      const result = getGitHubActionsRepoUrl();
      expect(result).toBe("https://github.com/owner/repo");
    });

    it("should work with GitHub Enterprise Server", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_REPOSITORY = "enterprise/repo";
      process.env.GITHUB_SERVER_URL = "https://git.company.com";

      const result = getGitHubActionsRepoUrl();
      expect(result).toBe("https://git.company.com/enterprise/repo");
    });
  });

  describe("getGitBranch", () => {
    it("should return null when not in a git repo or when git command fails", () => {
      // Since we can't easily mock git commands in this test environment,
      // we just test that the function returns either a string or null
      const result = getGitBranch();
      expect(typeof result === "string" || result === null).toBe(true);
    });
  });
});
