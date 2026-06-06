import { describe, expect, it, vi } from "vitest";

import { collectGitDiffsWithCli, splitGitDiff } from "./gitDiffFallback";

describe("splitGitDiff", () => {
  it("splits combined git diff output into per-file entries", () => {
    const combined = [
      "diff --git a/a.txt b/a.txt\n+hello",
      "diff --git a/b.txt b/b.txt\n+world",
    ].join("\n");

    expect(splitGitDiff(combined)).toEqual([
      "diff --git a/a.txt b/a.txt\n+hello\n",
      "diff --git a/b.txt b/b.txt\n+world",
    ]);
  });
});

describe("collectGitDiffsWithCli", () => {
  it("falls back to git CLI and returns staged and unstaged diffs", async () => {
    const execFn = vi.fn(async (command: string, options: { cwd: string }) => {
      if (command === "git rev-parse --show-toplevel") {
        return { stdout: "/repo\n" };
      }
      if (command === "git diff --cached") {
        expect(options.cwd).toBe("/repo");
        return { stdout: "diff --git a/staged.ts b/staged.ts\n+staged\n" };
      }
      if (command === "git diff") {
        expect(options.cwd).toBe("/repo");
        return {
          stdout: "diff --git a/unstaged.ts b/unstaged.ts\n+unstaged\n",
        };
      }
      throw new Error("unexpected command: " + command);
    });

    await expect(
      collectGitDiffsWithCli(["/repo", "/repo/subdir"], true, execFn),
    ).resolves.toEqual([
      "diff --git a/staged.ts b/staged.ts\n+staged\n",
      "diff --git a/unstaged.ts b/unstaged.ts\n+unstaged\n",
    ]);

    expect(execFn).toHaveBeenCalledTimes(4);
  });

  it("skips non-git directories and only uses staged diff when requested", async () => {
    const execFn = vi.fn(async (command: string, options: { cwd: string }) => {
      if (
        command === "git rev-parse --show-toplevel" &&
        options.cwd === "/not-a-repo"
      ) {
        throw new Error("fatal: not a git repository");
      }
      if (
        command === "git rev-parse --show-toplevel" &&
        options.cwd === "/repo"
      ) {
        return { stdout: "/repo\n" };
      }
      if (command === "git diff --cached") {
        return { stdout: "diff --git a/file.ts b/file.ts\n+only-staged\n" };
      }
      throw new Error("unexpected command: " + command);
    });

    await expect(
      collectGitDiffsWithCli(["/not-a-repo", "/repo"], false, execFn),
    ).resolves.toEqual(["diff --git a/file.ts b/file.ts\n+only-staged\n"]);

    expect(execFn).toHaveBeenCalledTimes(3);
  });
});
