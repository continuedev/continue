import * as nodeUtil from "util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as gitUtil from "../util/git.js";

// Create mock exec with promisify.custom support inside the factory
vi.mock("child_process", () => {
  const execMockFn: any = vi.fn();
  (execMockFn as any)[(nodeUtil as any).promisify.custom] = (cmd: string) =>
    new Promise((resolve, reject) => {
      execMockFn(cmd, (err: any, stdout: any, stderr: any) => {
        if (err) reject(err);
        else resolve({ stdout, stderr });
      });
    });
  return { exec: execMockFn };
});

// Import after mocking to get the mocked version
const childProcess = await import("child_process");
const execMock = vi.mocked(childProcess.exec);

// Mock logger
vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
const { createPullRequest } = await import("./pr.js");

describe("pr endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("should fail if not in a git repository", async () => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(false);

      const result = await createPullRequest({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not in a git repository");
    });

    it("should fail if current branch cannot be determined", async () => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(true);
      vi.spyOn(gitUtil, "getGitBranch").mockReturnValue(null);

      const result = await createPullRequest({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not determine current branch");
    });

    it("should fail if on main branch", async () => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(true);
      vi.spyOn(gitUtil, "getGitBranch").mockReturnValue("main");

      const result = await createPullRequest({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("You're currently on the main branch");
    });

    it("should fail if on master branch", async () => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(true);
      vi.spyOn(gitUtil, "getGitBranch").mockReturnValue("master");

      const result = await createPullRequest({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("You're currently on the master branch");
    });

    it("should fail if no remote URL found", async () => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(true);
      vi.spyOn(gitUtil, "getGitBranch").mockReturnValue("feature-branch");
      vi.spyOn(gitUtil, "getGitRemoteUrl").mockReturnValue(null);

      const result = await createPullRequest({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not find git remote URL");
    });

    it("should fail if remote is not a GitHub repository", async () => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(true);
      vi.spyOn(gitUtil, "getGitBranch").mockReturnValue("feature-branch");
      vi.spyOn(gitUtil, "getGitRemoteUrl").mockReturnValue(
        "https://gitlab.com/owner/repo.git",
      );

      const result = await createPullRequest({});

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "doesn't appear to be a GitHub repository",
      );
    });

    it("should fail if GitHub CLI is not installed", async () => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(true);
      vi.spyOn(gitUtil, "getGitBranch").mockReturnValue("feature-branch");
      vi.spyOn(gitUtil, "getGitRemoteUrl").mockReturnValue(
        "https://github.com/owner/repo.git",
      );

      // Mock exec to fail for gh --version
      execMock.mockImplementation((cmd: string, callback: any) => {
        callback(new Error("Command not found"), "", "");
        return {} as any;
      });

      const result = await createPullRequest({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("GitHub CLI (gh) is not installed");
    });
  });

  describe("GitHub URL parsing", () => {
    it("should handle HTTPS GitHub URLs", async () => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(true);
      vi.spyOn(gitUtil, "getGitBranch").mockReturnValue("feature-branch");
      vi.spyOn(gitUtil, "getGitRemoteUrl").mockReturnValue(
        "https://github.com/owner/repo.git",
      );

      // Mock exec to handle different commands
      execMock.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes("gh --version")) {
          callback(null, "gh version 2.0.0", "");
        } else if (cmd.includes("gh pr create")) {
          callback(
            null,
            "https://github.com/owner/repo/pull/123\nPR created successfully",
            "",
          );
        } else if (cmd.includes("git log")) {
          callback(null, "- feat: add new feature", "");
        }
        return {} as any;
      });

      const result = await createPullRequest({});

      expect(result.success).toBe(true);
      expect(result.message).toContain("Pull request created successfully");
    });

    it("should handle SSH GitHub URLs", async () => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(true);
      vi.spyOn(gitUtil, "getGitBranch").mockReturnValue("feature-branch");
      vi.spyOn(gitUtil, "getGitRemoteUrl").mockReturnValue(
        "git@github.com:owner/repo.git",
      );

      // Mock exec to handle different commands
      execMock.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes("gh --version")) {
          callback(null, "gh version 2.0.0", "");
        } else if (cmd.includes("gh pr create")) {
          callback(
            null,
            "https://github.com/owner/repo/pull/456\nPR created successfully",
            "",
          );
        } else if (cmd.includes("git log")) {
          callback(null, "- feat: add new feature", "");
        }
        return {} as any;
      });

      const result = await createPullRequest({});

      expect(result.success).toBe(true);
      expect(result.message).toContain("Pull request created successfully");
    });
  });

  describe("PR creation", () => {
    beforeEach(() => {
      vi.spyOn(gitUtil, "isGitRepo").mockReturnValue(true);
      vi.spyOn(gitUtil, "getGitBranch").mockReturnValue("feature/new-endpoint");
      vi.spyOn(gitUtil, "getGitRemoteUrl").mockReturnValue(
        "https://github.com/owner/repo.git",
      );
    });

    it("should create a PR with custom title and body", async () => {
      let ghCommand = "";
      execMock.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes("gh --version")) {
          callback(null, "gh version 2.0.0", "");
        } else if (cmd.includes("gh pr create")) {
          ghCommand = cmd;
          callback(
            null,
            "https://github.com/owner/repo/pull/1\nPR created successfully",
            "",
          );
        } else if (cmd.includes("git log")) {
          callback(null, "- feat: add new feature", "");
        }
        return {} as any;
      });

      const result = await createPullRequest({
        title: "Custom Title",
        body: "Custom Body",
      });

      expect(result.success).toBe(true);
      expect(result.prUrl).toContain("github.com/owner/repo/pull");
      expect(ghCommand).toContain("--title");
      expect(ghCommand).toContain("Custom Title");
      expect(ghCommand).toContain("--body");
      expect(ghCommand).toContain("Custom Body");
    });

    it("should create a draft PR when draft option is true", async () => {
      let ghCommand = "";
      execMock.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes("gh --version")) {
          callback(null, "gh version 2.0.0", "");
        } else if (cmd.includes("gh pr create")) {
          ghCommand = cmd;
          callback(
            null,
            "https://github.com/owner/repo/pull/2\nPR created successfully",
            "",
          );
        } else if (cmd.includes("git log")) {
          callback(null, "- feat: add new feature", "");
        }
        return {} as any;
      });

      const result = await createPullRequest({ draft: true });

      expect(result.success).toBe(true);
      expect(ghCommand).toContain("--draft");
    });

    it("should use custom base branch", async () => {
      let ghCommand = "";
      execMock.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes("gh --version")) {
          callback(null, "gh version 2.0.0", "");
        } else if (cmd.includes("gh pr create")) {
          ghCommand = cmd;
          callback(
            null,
            "https://github.com/owner/repo/pull/3\nPR created successfully",
            "",
          );
        } else if (cmd.includes("git log")) {
          callback(null, "- feat: add new feature", "");
        }
        return {} as any;
      });

      const result = await createPullRequest({ base: "develop" });

      expect(result.success).toBe(true);
      expect(ghCommand).toContain("--base");
      expect(ghCommand).toContain("develop");
    });

    it("should open in browser when web option is true", async () => {
      let ghCommand = "";
      execMock.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes("gh --version")) {
          callback(null, "gh version 2.0.0", "");
        } else if (cmd.includes("gh pr create")) {
          ghCommand = cmd;
          callback(
            null,
            "https://github.com/owner/repo/pull/4\nPR created successfully",
            "",
          );
        } else if (cmd.includes("git log")) {
          callback(null, "- feat: add new feature", "");
        }
        return {} as any;
      });

      const result = await createPullRequest({ web: true });

      expect(result.success).toBe(true);
      expect(ghCommand).toContain("--web");
    });

    it("should generate title from branch name", async () => {
      let ghCommand = "";
      execMock.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes("gh --version")) {
          callback(null, "gh version 2.0.0", "");
        } else if (cmd.includes("gh pr create")) {
          ghCommand = cmd;
          callback(
            null,
            "https://github.com/owner/repo/pull/5\nPR created successfully",
            "",
          );
        } else if (cmd.includes("git log")) {
          callback(null, "- feat: add new feature", "");
        }
        return {} as any;
      });

      const result = await createPullRequest({});

      expect(result.success).toBe(true);
      // Should convert "feature/new-endpoint" to "New Endpoint"
      expect(ghCommand).toContain("--title");
      expect(ghCommand).toContain("New Endpoint");
    });
  });
});
