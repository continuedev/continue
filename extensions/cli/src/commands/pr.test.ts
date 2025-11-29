import * as nodeUtil from "util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as gitUtil from "../util/git.js";

// Create mock execFile with promisify.custom support inside the factory
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();

  const execFileMockFn: any = vi.fn();
  // Add promisify.custom to handle promisify(execFile)
  (execFileMockFn as any)[(nodeUtil as any).promisify.custom] = (
    file: string,
    args?: string[],
    options?: any,
  ) =>
    new Promise((resolve, reject) => {
      // Call the mock with all arguments
      execFileMockFn(
        file,
        args,
        options,
        (err: any, stdout: any, stderr: any) => {
          if (err) reject(err);
          else resolve({ stdout, stderr });
        },
      );
    });
  return {
    ...actual,
    execFile: execFileMockFn,
  };
});

// Import after mocking to get the mocked version
const childProcess = await import("child_process");
const execFileMock = vi.mocked(childProcess.execFile);

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
    execFileMock.mockClear();
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

      // Mock execFile to fail for gh --version
      execFileMock.mockImplementation(
        (file: any, args: any, options: any, callback: any) => {
          callback(new Error("Command not found"), "", "");
          return {} as any;
        },
      );

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

      // Mock execFile to handle different commands
      execFileMock.mockImplementation(
        (file: any, args: any, options: any, callback: any) => {
          if (file === "gh" && args?.[0] === "--version") {
            callback(null, "gh version 2.0.0", "");
          } else if (file === "gh" && args?.[0] === "pr") {
            callback(
              null,
              "https://github.com/owner/repo/pull/123\nPR created successfully",
              "",
            );
          } else if (file === "git" && args?.[0] === "log") {
            callback(null, "- feat: add new feature", "");
          }
          return {} as any;
        },
      );

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

      // Mock execFile to handle different commands
      execFileMock.mockImplementation(
        (file: any, args: any, options: any, callback: any) => {
          if (file === "gh" && args?.[0] === "--version") {
            callback(null, "gh version 2.0.0", "");
          } else if (file === "gh" && args?.[0] === "pr") {
            callback(
              null,
              "https://github.com/owner/repo/pull/456\nPR created successfully",
              "",
            );
          } else if (file === "git" && args?.[0] === "log") {
            callback(null, "- feat: add new feature", "");
          }
          return {} as any;
        },
      );

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
      let ghArgs: string[] = [];
      execFileMock.mockImplementation(
        (file: any, args: any, options: any, callback: any) => {
          if (file === "gh" && args?.[0] === "--version") {
            callback(null, "gh version 2.0.0", "");
          } else if (file === "gh" && args?.[0] === "pr") {
            ghArgs = args;
            callback(
              null,
              "https://github.com/owner/repo/pull/1\nPR created successfully",
              "",
            );
          } else if (file === "git" && args?.[0] === "log") {
            callback(null, "- feat: add new feature", "");
          }
          return {} as any;
        },
      );

      const result = await createPullRequest({
        title: "Custom Title",
        body: "Custom Body",
      });

      expect(result.success).toBe(true);
      expect(result.prUrl).toContain("github.com/owner/repo/pull");
      expect(ghArgs).toContain("--title");
      expect(ghArgs).toContain("Custom Title");
      expect(ghArgs).toContain("--body");
      expect(ghArgs).toContain("Custom Body");
    });

    it("should create a draft PR when draft option is true", async () => {
      let ghArgs: string[] = [];
      execFileMock.mockImplementation(
        (file: any, args: any, options: any, callback: any) => {
          if (file === "gh" && args?.[0] === "--version") {
            callback(null, "gh version 2.0.0", "");
          } else if (file === "gh" && args?.[0] === "pr") {
            ghArgs = args;
            callback(
              null,
              "https://github.com/owner/repo/pull/2\nPR created successfully",
              "",
            );
          } else if (file === "git" && args?.[0] === "log") {
            callback(null, "- feat: add new feature", "");
          }
          return {} as any;
        },
      );

      const result = await createPullRequest({ draft: true });

      expect(result.success).toBe(true);
      expect(ghArgs).toContain("--draft");
    });

    it("should use custom base branch", async () => {
      let ghArgs: string[] = [];
      execFileMock.mockImplementation(
        (file: any, args: any, options: any, callback: any) => {
          if (file === "gh" && args?.[0] === "--version") {
            callback(null, "gh version 2.0.0", "");
          } else if (file === "gh" && args?.[0] === "pr") {
            ghArgs = args;
            callback(
              null,
              "https://github.com/owner/repo/pull/3\nPR created successfully",
              "",
            );
          } else if (file === "git" && args?.[0] === "log") {
            callback(null, "- feat: add new feature", "");
          }
          return {} as any;
        },
      );

      const result = await createPullRequest({ base: "develop" });

      expect(result.success).toBe(true);
      expect(ghArgs).toContain("--base");
      expect(ghArgs).toContain("develop");
    });

    it("should open in browser when web option is true", async () => {
      let ghArgs: string[] = [];
      execFileMock.mockImplementation(
        (file: any, args: any, options: any, callback: any) => {
          if (file === "gh" && args?.[0] === "--version") {
            callback(null, "gh version 2.0.0", "");
          } else if (file === "gh" && args?.[0] === "pr") {
            ghArgs = args;
            callback(
              null,
              "https://github.com/owner/repo/pull/4\nPR created successfully",
              "",
            );
          } else if (file === "git" && args?.[0] === "log") {
            callback(null, "- feat: add new feature", "");
          }
          return {} as any;
        },
      );

      const result = await createPullRequest({ web: true });

      expect(result.success).toBe(true);
      expect(ghArgs).toContain("--web");
    });

    it("should generate title from branch name", async () => {
      let ghArgs: string[] = [];
      execFileMock.mockImplementation(
        (file: any, args: any, options: any, callback: any) => {
          if (file === "gh" && args?.[0] === "--version") {
            callback(null, "gh version 2.0.0", "");
          } else if (file === "gh" && args?.[0] === "pr") {
            ghArgs = args;
            callback(
              null,
              "https://github.com/owner/repo/pull/5\nPR created successfully",
              "",
            );
          } else if (file === "git" && args?.[0] === "log") {
            callback(null, "- feat: add new feature", "");
          }
          return {} as any;
        },
      );

      const result = await createPullRequest({});

      expect(result.success).toBe(true);
      // Should convert "feature/new-endpoint" to "New Endpoint"
      expect(ghArgs).toContain("--title");
      expect(ghArgs).toContain("New Endpoint");
    });
  });
});
