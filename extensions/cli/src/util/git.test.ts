import { execSync } from "child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getGitBranch,
  getGitHubActionsRepoUrl,
  getGitRemoteUrl,
  getRepoUrl,
  isContinueRemoteAgent,
  isGitHubActions,
  isGitRepo,
} from "./git.js";

// Mock child_process
vi.mock("child_process", () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
}));

// Mock util.promisify to handle exec mocking
vi.mock("util", async (importOriginal) => {
  const actual = await importOriginal<typeof import("util")>();
  return {
    ...actual,
    promisify: (fn: any) => {
      // Return a mock function that we can control
      return vi.fn();
    },
  };
});

describe("git utilities", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getGitRemoteUrl", () => {
    it("should return remote URL for default origin remote", () => {
      const mockUrl = "git@github.com:continuedev/continue.git";
      vi.mocked(execSync).mockReturnValue(mockUrl + "\n");

      const result = getGitRemoteUrl();

      expect(result).toBe(mockUrl);
      expect(execSync).toHaveBeenCalledWith(
        "git remote get-url origin",
        expect.objectContaining({
          encoding: "utf-8",
          stdio: "pipe",
        }),
      );
    });

    it("should return remote URL for custom remote name", () => {
      const mockUrl = "https://github.com/user/repo.git";
      vi.mocked(execSync).mockReturnValue(mockUrl + "\n");

      const result = getGitRemoteUrl("upstream");

      expect(result).toBe(mockUrl);
      expect(execSync).toHaveBeenCalledWith(
        "git remote get-url upstream",
        expect.any(Object),
      );
    });

    it("should trim whitespace from URL", () => {
      const mockUrl = "  https://github.com/user/repo.git  \n\n";
      vi.mocked(execSync).mockReturnValue(mockUrl);

      const result = getGitRemoteUrl();

      expect(result).toBe("https://github.com/user/repo.git");
    });

    it("should return null when remote does not exist", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("fatal: No such remote 'origin'");
      });

      const result = getGitRemoteUrl();

      expect(result).toBeNull();
    });

    it("should return null when not in a git repository", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("fatal: not a git repository");
      });

      const result = getGitRemoteUrl();

      expect(result).toBeNull();
    });

    it("should handle HTTPS URLs", () => {
      const mockUrl = "https://github.com/continuedev/continue.git";
      vi.mocked(execSync).mockReturnValue(mockUrl);

      const result = getGitRemoteUrl();

      expect(result).toBe(mockUrl);
    });

    it("should handle SSH URLs", () => {
      const mockUrl = "git@gitlab.com:user/project.git";
      vi.mocked(execSync).mockReturnValue(mockUrl);

      const result = getGitRemoteUrl();

      expect(result).toBe(mockUrl);
    });

    it("should handle GitHub Enterprise URLs", () => {
      const mockUrl = "https://github.enterprise.com/org/repo.git";
      vi.mocked(execSync).mockReturnValue(mockUrl);

      const result = getGitRemoteUrl();

      expect(result).toBe(mockUrl);
    });
  });

  describe("getGitBranch", () => {
    it("should return current branch name", () => {
      vi.mocked(execSync).mockReturnValue("main\n");

      const result = getGitBranch();

      expect(result).toBe("main");
      expect(execSync).toHaveBeenCalledWith(
        "git branch --show-current",
        expect.objectContaining({
          encoding: "utf-8",
          stdio: "pipe",
        }),
      );
    });

    it("should return branch name with special characters", () => {
      vi.mocked(execSync).mockReturnValue("feature/add-new-feature\n");

      const result = getGitBranch();

      expect(result).toBe("feature/add-new-feature");
    });

    it("should return null when in detached HEAD state", () => {
      vi.mocked(execSync).mockReturnValue("\n");

      const result = getGitBranch();

      expect(result).toBeNull();
    });

    it("should return null when not in a git repository", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("fatal: not a git repository");
      });

      const result = getGitBranch();

      expect(result).toBeNull();
    });

    it("should handle branch names with numbers", () => {
      vi.mocked(execSync).mockReturnValue("release-v2.0.1\n");

      const result = getGitBranch();

      expect(result).toBe("release-v2.0.1");
    });

    it("should handle branch names with underscores and dashes", () => {
      vi.mocked(execSync).mockReturnValue("feature_test-branch_123\n");

      const result = getGitBranch();

      expect(result).toBe("feature_test-branch_123");
    });
  });

  describe("isGitRepo", () => {
    it("should return true when inside a git repository", () => {
      vi.mocked(execSync).mockReturnValue("true\n");

      const result = isGitRepo();

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        "git rev-parse --is-inside-work-tree",
        expect.objectContaining({
          stdio: "ignore",
        }),
      );
    });

    it("should return false when not in a git repository", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("fatal: not a git repository");
      });

      const result = isGitRepo();

      expect(result).toBe(false);
    });

    it("should return false when git command fails", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("command not found: git");
      });

      const result = isGitRepo();

      expect(result).toBe(false);
    });
  });

  describe("isGitHubActions", () => {
    it("should return true when GITHUB_ACTIONS env var is 'true'", () => {
      process.env.GITHUB_ACTIONS = "true";

      const result = isGitHubActions();

      expect(result).toBe(true);
    });

    it("should return false when GITHUB_ACTIONS env var is not set", () => {
      delete process.env.GITHUB_ACTIONS;

      const result = isGitHubActions();

      expect(result).toBe(false);
    });

    it("should return false when GITHUB_ACTIONS env var is 'false'", () => {
      process.env.GITHUB_ACTIONS = "false";

      const result = isGitHubActions();

      expect(result).toBe(false);
    });

    it("should return false when GITHUB_ACTIONS env var is empty string", () => {
      process.env.GITHUB_ACTIONS = "";

      const result = isGitHubActions();

      expect(result).toBe(false);
    });
  });

  describe("isContinueRemoteAgent", () => {
    it("should return true when CONTINUE_REMOTE env var is 'true'", () => {
      process.env.CONTINUE_REMOTE = "true";

      const result = isContinueRemoteAgent();

      expect(result).toBe(true);
    });

    it("should return false when CONTINUE_REMOTE env var is not set", () => {
      delete process.env.CONTINUE_REMOTE;

      const result = isContinueRemoteAgent();

      expect(result).toBe(false);
    });

    it("should return false when CONTINUE_REMOTE env var is 'false'", () => {
      process.env.CONTINUE_REMOTE = "false";

      const result = isContinueRemoteAgent();

      expect(result).toBe(false);
    });
  });

  describe("getGitHubActionsRepoUrl", () => {
    it("should return repo URL from GitHub Actions environment", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_REPOSITORY = "continuedev/continue";
      process.env.GITHUB_SERVER_URL = "https://github.com";

      const result = getGitHubActionsRepoUrl();

      expect(result).toBe("https://github.com/continuedev/continue");
    });

    it("should use default server URL when not specified", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_REPOSITORY = "user/repo";
      delete process.env.GITHUB_SERVER_URL;

      const result = getGitHubActionsRepoUrl();

      expect(result).toBe("https://github.com/user/repo");
    });

    it("should return null when not in GitHub Actions", () => {
      delete process.env.GITHUB_ACTIONS;
      process.env.GITHUB_REPOSITORY = "user/repo";

      const result = getGitHubActionsRepoUrl();

      expect(result).toBeNull();
    });

    it("should return null when GITHUB_REPOSITORY is not set", () => {
      process.env.GITHUB_ACTIONS = "true";
      delete process.env.GITHUB_REPOSITORY;

      const result = getGitHubActionsRepoUrl();

      expect(result).toBeNull();
    });

    it("should handle GitHub Enterprise server URL", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_REPOSITORY = "enterprise/repo";
      process.env.GITHUB_SERVER_URL = "https://github.enterprise.com";

      const result = getGitHubActionsRepoUrl();

      expect(result).toBe("https://github.enterprise.com/enterprise/repo");
    });

    it("should handle repository with special characters in name", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_REPOSITORY = "org-name/repo.with-special_chars";
      process.env.GITHUB_SERVER_URL = "https://github.com";

      const result = getGitHubActionsRepoUrl();

      expect(result).toBe(
        "https://github.com/org-name/repo.with-special_chars",
      );
    });
  });

  describe("getRepoUrl", () => {
    it("should prioritize GitHub Actions environment", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_REPOSITORY = "continuedev/continue";
      process.env.GITHUB_SERVER_URL = "https://github.com";

      vi.mocked(execSync).mockReturnValue("true\n");

      const result = getRepoUrl();

      expect(result).toBe("https://github.com/continuedev/continue");
    });

    it("should use git remote URL when not in GitHub Actions", () => {
      delete process.env.GITHUB_ACTIONS;

      const mockUrl = "https://github.com/user/repo.git";
      vi.mocked(execSync).mockImplementation((command: any) => {
        if (command === "git rev-parse --is-inside-work-tree") {
          return "true\n";
        }
        if (command.startsWith("git remote get-url")) {
          return mockUrl;
        }
        return "";
      });

      const result = getRepoUrl();

      expect(result).toBe("https://github.com/user/repo");
    });

    it("should strip .git extension from remote URL", () => {
      delete process.env.GITHUB_ACTIONS;

      vi.mocked(execSync).mockImplementation((command: any) => {
        if (command === "git rev-parse --is-inside-work-tree") {
          return "true\n";
        }
        if (command.startsWith("git remote get-url")) {
          return "git@github.com:user/repo.git\n";
        }
        return "";
      });

      const result = getRepoUrl();

      expect(result).toBe("git@github.com:user/repo");
    });

    it("should not strip .git if not at end of URL", () => {
      delete process.env.GITHUB_ACTIONS;

      vi.mocked(execSync).mockImplementation((command: any) => {
        if (command === "git rev-parse --is-inside-work-tree") {
          return "true\n";
        }
        if (command.startsWith("git remote get-url")) {
          return "https://github.com/user/repo.github.io\n";
        }
        return "";
      });

      const result = getRepoUrl();

      expect(result).toBe("https://github.com/user/repo.github.io");
    });

    it("should return cwd when not in git repository", () => {
      delete process.env.GITHUB_ACTIONS;

      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("not a git repository");
      });

      const result = getRepoUrl();

      expect(result).toBe(process.cwd());
    });

    it("should return cwd when git remote not found", () => {
      delete process.env.GITHUB_ACTIONS;

      vi.mocked(execSync).mockImplementation((command: any) => {
        if (command === "git rev-parse --is-inside-work-tree") {
          return "true\n";
        }
        if (command.startsWith("git remote get-url")) {
          throw new Error("No such remote");
        }
        return "";
      });

      const result = getRepoUrl();

      expect(result).toBe(process.cwd());
    });
  });

  // Note: getGitDiffSnapshot tests are omitted due to complexity of mocking promisify
  // The function is tested indirectly through integration tests and updateAgentMetadata tests
});
