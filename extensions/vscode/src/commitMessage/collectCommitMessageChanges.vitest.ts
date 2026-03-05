import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { collectCommitMessageChanges } from "./collectCommitMessageChanges";

type RunGitResult = { stdout: string; stderr: string; status: number };
type RunGit = (gitExe: string, cwd: string, args: string[]) => RunGitResult;

function successful(stdout: string): RunGitResult {
  return { stdout, stderr: "", status: 0 };
}

describe("collectCommitMessageChanges", () => {
  it("falls back to unstaged when staged list command fails", () => {
    const repoRoot = path.join(path.sep, "repo");
    const runGit: RunGit = vi.fn((gitExe, cwd, args) => {
      expect(gitExe).toBe("git");
      expect(cwd).toBe(repoRoot);

      const key = args.join("\u0000");
      if (key === ["diff", "--name-status", "--cached"].join("\u0000")) {
        return {
          stdout: "",
          stderr: "fatal: bad revision",
          status: 1,
        };
      }

      if (key === ["status", "--porcelain"].join("\u0000")) {
        return successful("");
      }

      if (key === ["branch", "--show-current"].join("\u0000")) {
        return successful("");
      }

      if (key === ["log", "--oneline", "-5"].join("\u0000")) {
        return { stdout: "", stderr: "", status: 1 };
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    });

    const result = collectCommitMessageChanges({
      gitExecutable: "git",
      cwd: repoRoot,
      runGit,
    });

    expect(result.mode).toBe("unstaged");
    expect(result.changes).toHaveLength(0);
    expect(result.listFailure?.command).toBe("git diff --name-status --cached");
    expect(result.listFailure?.stderr).toContain("fatal: bad revision");
    expect(runGit).toHaveBeenCalledWith("git", repoRoot, [
      "status",
      "--porcelain",
    ]);
  });

  it("returns empty changes with listFailure when unstaged list command fails", () => {
    const repoRoot = path.join(path.sep, "repo");
    const runGit: RunGit = vi.fn((gitExe, cwd, args) => {
      expect(gitExe).toBe("git");
      expect(cwd).toBe(repoRoot);

      const key = args.join("\u0000");
      if (key === ["diff", "--name-status", "--cached"].join("\u0000")) {
        return successful("");
      }
      if (key === ["status", "--porcelain"].join("\u0000")) {
        return {
          stdout: "",
          stderr: "fatal: not a git repository",
          status: 128,
        };
      }

      if (key === ["branch", "--show-current"].join("\u0000")) {
        return successful("");
      }

      if (key === ["log", "--oneline", "-5"].join("\u0000")) {
        return { stdout: "", stderr: "", status: 1 };
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    });

    const result = collectCommitMessageChanges({
      gitExecutable: "git",
      cwd: repoRoot,
      runGit,
    });

    expect(result.mode).toBe("unstaged");
    expect(result.changes).toHaveLength(0);
    expect(result.listFailure?.command).toBe("git status --porcelain");
    expect(result.listFailure?.stderr).toContain("fatal: not a git repository");
  });

  it("uses staged changes first and does not call git status when staged list is non-empty", () => {
    const repoRoot = path.join(path.sep, "repo");
    const stagedPath = "src/app.ts";
    const stagedAbsPath = path.join(repoRoot, stagedPath);

    const runGit: RunGit = vi.fn((gitExe, cwd, args) => {
      expect(gitExe).toBe("git");
      expect(cwd).toBe(repoRoot);

      const key = args.join("\u0000");
      if (key === ["diff", "--name-status", "--cached"].join("\u0000")) {
        return successful(`M\t${stagedPath}\n`);
      }
      if (
        key ===
        ["diff", "--cached", "--numstat", "--", stagedAbsPath].join("\u0000")
      ) {
        return successful(`1\t0\t${stagedPath}\n`);
      }
      if (key === ["diff", "--cached", "--", stagedAbsPath].join("\u0000")) {
        return successful(
          "diff --git a/src/app.ts b/src/app.ts\n+console.log('x')\n",
        );
      }
      if (key === ["branch", "--show-current"].join("\u0000")) {
        return successful("main\n");
      }
      if (key === ["log", "--oneline", "-5"].join("\u0000")) {
        return successful("aaaa111 first\n");
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    });

    const shouldExclude = vi.fn(() => false);
    const result = collectCommitMessageChanges({
      gitExecutable: "git",
      cwd: repoRoot,
      runGit,
      shouldExclude,
    });

    expect(result.mode).toBe("staged");
    expect(result.branch).toBe("main");
    expect(result.recentCommits).toContain("aaaa111 first");
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].absPath).toBe(stagedAbsPath);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]).toContain("diff --git a/src/app.ts b/src/app.ts");
    expect(shouldExclude).toHaveBeenCalledWith(stagedPath);
    expect(runGit).not.toHaveBeenCalledWith("git", repoRoot, [
      "status",
      "--porcelain",
    ]);
  });

  it("uses selectedFiles when provided and does not list repo changes", () => {
    const repoRoot = path.join(path.sep, "repo");
    const selectedPath = "src/selected.ts";
    const excludedPath = "pnpm-lock.yaml";
    const selectedAbsPath = path.join(repoRoot, selectedPath);

    const runGit: RunGit = vi.fn((gitExe, cwd, args) => {
      expect(gitExe).toBe("git");
      expect(cwd).toBe(repoRoot);

      const key = args.join("\u0000");
      if (key === ["diff", "--name-status", "--cached"].join("\u0000")) {
        throw new Error(
          "Should not list staged changes when selectedFiles are provided",
        );
      }
      if (key === ["status", "--porcelain"].join("\u0000")) {
        throw new Error(
          "Should not list unstaged changes when selectedFiles are provided",
        );
      }

      if (
        key === ["status", "--porcelain", "--", selectedAbsPath].join("\u0000")
      ) {
        return successful(` M ${selectedPath}\n`);
      }

      if (
        key ===
        ["diff", "--cached", "--numstat", "--", selectedAbsPath].join("\u0000")
      ) {
        return successful("");
      }
      if (key === ["diff", "--numstat", "--", selectedAbsPath].join("\u0000")) {
        return successful(`1\t0\t${selectedPath}\n`);
      }
      if (key === ["diff", "--", selectedAbsPath].join("\u0000")) {
        return successful(
          "diff --git a/src/selected.ts b/src/selected.ts\n+console.log('selected')\n",
        );
      }

      if (key === ["branch", "--show-current"].join("\u0000")) {
        return successful("main\n");
      }
      if (key === ["log", "--oneline", "-5"].join("\u0000")) {
        return successful("aaaa111 first\n");
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    });

    const shouldExclude = vi.fn((candidatePath: string) =>
      candidatePath === excludedPath ? true : false,
    );

    const result = collectCommitMessageChanges({
      gitExecutable: "git",
      cwd: repoRoot,
      runGit,
      shouldExclude,
      selectedFiles: [selectedPath, excludedPath],
    });

    expect(result.mode).toBe("selected");
    expect(result.selectedFilesCount).toBe(2);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].filePath).toBe(selectedPath);
    expect(result.changes[0].absPath).toBe(selectedAbsPath);
    expect(result.diffs[0]).toContain("diff --git a/src/selected.ts");
    expect(shouldExclude).toHaveBeenCalledWith(selectedPath);
    expect(shouldExclude).toHaveBeenCalledWith(excludedPath);
  });

  it("does not special-case staged rename/copy name-status output", () => {
    const repoRoot = path.join(path.sep, "repo");
    const oldPath = "src/old-name.ts";
    const newPath = "src/new-name.ts";
    const rawPath = `${oldPath}\t${newPath}`;
    const rawAbsPath = path.join(repoRoot, rawPath);

    const runGit: RunGit = vi.fn((gitExe, cwd, args) => {
      expect(gitExe).toBe("git");
      expect(cwd).toBe(repoRoot);

      const key = args.join("\u0000");
      if (key === ["diff", "--name-status", "--cached"].join("\u0000")) {
        return successful(`R100\t${oldPath}\t${newPath}\n`);
      }

      if (
        key ===
        ["diff", "--cached", "--numstat", "--", rawAbsPath].join("\u0000")
      ) {
        return {
          stdout: "",
          stderr: "fatal: pathspec did not match",
          status: 1,
        };
      }

      if (key === ["branch", "--show-current"].join("\u0000")) {
        return successful("main\n");
      }
      if (key === ["log", "--oneline", "-5"].join("\u0000")) {
        return successful("dddd444 fourth\n");
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    });

    const shouldExclude = vi.fn(() => false);
    const result = collectCommitMessageChanges({
      gitExecutable: "git",
      cwd: repoRoot,
      runGit,
      shouldExclude,
    });

    expect(result.mode).toBe("staged");
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].filePath).toBe(rawPath);
    expect(result.changes[0].absPath).toBe(rawAbsPath);
    expect(result.diffs[0]).toContain(`File ${rawAbsPath} - diff unavailable`);
    expect(shouldExclude).toHaveBeenCalledWith(rawPath);
    expect(runGit).not.toHaveBeenCalledWith("git", repoRoot, [
      "status",
      "--porcelain",
    ]);
  });

  it("falls back to unstaged status when staged changes are empty after exclusions", () => {
    const repoRoot = path.join(path.sep, "repo");
    const excludedPath = "pnpm-lock.yaml";
    const modifiedPath = "src/edited.png";
    const untrackedPath = "src/new-file.ts";
    const modifiedAbsPath = path.join(repoRoot, modifiedPath);
    const untrackedAbsPath = path.join(repoRoot, untrackedPath);

    const runGit: RunGit = vi.fn((gitExe, cwd, args) => {
      expect(gitExe).toBe("git");
      expect(cwd).toBe(repoRoot);

      const key = args.join("\u0000");
      if (key === ["diff", "--name-status", "--cached"].join("\u0000")) {
        return successful(`M\t${excludedPath}\n`);
      }
      if (key === ["status", "--porcelain"].join("\u0000")) {
        return successful(` M ${modifiedPath}\n?? ${untrackedPath}\n`);
      }
      if (key === ["diff", "--numstat", "--", modifiedAbsPath].join("\u0000")) {
        return successful(`-\t-\t${modifiedPath}\n`);
      }
      if (key === ["branch", "--show-current"].join("\u0000")) {
        return successful("feature/x\n");
      }
      if (key === ["log", "--oneline", "-5"].join("\u0000")) {
        return successful("bbbb222 second\n");
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    });

    const shouldExclude = vi.fn((candidatePath: string) =>
      candidatePath === excludedPath ? true : false,
    );

    const result = collectCommitMessageChanges({
      gitExecutable: "git",
      cwd: repoRoot,
      runGit,
      shouldExclude,
    });

    expect(result.mode).toBe("unstaged");
    expect(runGit).toHaveBeenCalledWith("git", repoRoot, [
      "status",
      "--porcelain",
    ]);
    expect(result.diffs).toContain(
      `Binary file ${modifiedAbsPath} has been modified`,
    );
    expect(result.diffs).toContain(`New untracked file: ${untrackedAbsPath}`);
    expect(runGit).not.toHaveBeenCalledWith("git", repoRoot, [
      "diff",
      "--",
      untrackedAbsPath,
    ]);
  });

  it("does not special-case rename arrows in porcelain output", () => {
    const repoRoot = path.join(path.sep, "repo");
    const oldPath = "src/old.ts";
    const newPath = "src/new.ts";
    const rawPath = `${oldPath} -> ${newPath}`;
    const rawAbsPath = path.join(repoRoot, rawPath);

    const runGit: RunGit = vi.fn((gitExe, cwd, args) => {
      expect(gitExe).toBe("git");
      expect(cwd).toBe(repoRoot);

      const key = args.join("\u0000");
      if (key === ["diff", "--name-status", "--cached"].join("\u0000")) {
        return successful("");
      }
      if (key === ["status", "--porcelain"].join("\u0000")) {
        return successful(`R  ${oldPath} -> ${newPath}\n`);
      }

      if (key === ["diff", "--numstat", "--", rawAbsPath].join("\u0000")) {
        return {
          stdout: "",
          stderr: "fatal: pathspec did not match",
          status: 1,
        };
      }

      if (key === ["branch", "--show-current"].join("\u0000")) {
        return successful("feature/rename\n");
      }
      if (key === ["log", "--oneline", "-5"].join("\u0000")) {
        return successful("eeee555 fifth\n");
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    });

    const shouldExclude = vi.fn(() => false);
    const result = collectCommitMessageChanges({
      gitExecutable: "git",
      cwd: repoRoot,
      runGit,
      shouldExclude,
    });

    expect(result.mode).toBe("unstaged");
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].filePath).toBe(rawPath);
    expect(result.changes[0].absPath).toBe(rawAbsPath);
    expect(result.diffs[0]).toContain(`File ${rawAbsPath} - diff unavailable`);
    expect(shouldExclude).toHaveBeenCalledWith(rawPath);
  });

  it("does not decode quoted porcelain paths", () => {
    const repoRoot = path.join(path.sep, "repo");
    const rawQuotedPath = '"src/has space.ts"';
    const rawQuotedAbsPath = path.join(repoRoot, rawQuotedPath);

    const runGit: RunGit = vi.fn((gitExe, cwd, args) => {
      expect(gitExe).toBe("git");
      expect(cwd).toBe(repoRoot);

      const key = args.join("\u0000");
      if (key === ["diff", "--name-status", "--cached"].join("\u0000")) {
        return successful("");
      }
      if (key === ["status", "--porcelain"].join("\u0000")) {
        return successful(` M ${rawQuotedPath}\n`);
      }

      if (
        key === ["diff", "--numstat", "--", rawQuotedAbsPath].join("\u0000")
      ) {
        return {
          stdout: "",
          stderr: "fatal: pathspec did not match",
          status: 1,
        };
      }
      if (key === ["branch", "--show-current"].join("\u0000")) {
        return successful("feature/quoted\n");
      }
      if (key === ["log", "--oneline", "-5"].join("\u0000")) {
        return successful("gggg777 seventh\n");
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    });

    const shouldExclude = vi.fn(() => false);
    const result = collectCommitMessageChanges({
      gitExecutable: "git",
      cwd: repoRoot,
      runGit,
      shouldExclude,
    });

    expect(result.mode).toBe("unstaged");
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].filePath).toBe(rawQuotedPath);
    expect(result.changes[0].absPath).toBe(rawQuotedAbsPath);
    expect(result.diffs[0]).toContain(
      `File ${rawQuotedAbsPath} - diff unavailable`,
    );
    expect(shouldExclude).toHaveBeenCalledWith(rawQuotedPath);
  });

  it("lists security-sensitive files as redacted placeholders without requesting diffs", () => {
    const repoRoot = path.join(path.sep, "repo");
    const sensitivePath = ".aws/credentials";
    const sensitiveAbsPath = path.join(repoRoot, sensitivePath);

    const runGit: RunGit = vi.fn((gitExe, cwd, args) => {
      expect(gitExe).toBe("git");
      expect(cwd).toBe(repoRoot);

      const key = args.join("\u0000");
      if (key === ["diff", "--name-status", "--cached"].join("\u0000")) {
        return successful(`M\t${sensitivePath}\n`);
      }
      if (key === ["branch", "--show-current"].join("\u0000")) {
        return successful("main\n");
      }
      if (key === ["log", "--oneline", "-5"].join("\u0000")) {
        return successful("cccc333 third\n");
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    });

    const shouldExclude = vi.fn((candidatePath: string) =>
      candidatePath === sensitivePath ? true : false,
    );

    const result = collectCommitMessageChanges({
      gitExecutable: "git",
      cwd: repoRoot,
      runGit,
      shouldExclude,
    });

    expect(result.mode).toBe("staged");
    expect(result.diffs).toContain(
      `Security-sensitive file redacted: ${sensitiveAbsPath}`,
    );
    expect(runGit).not.toHaveBeenCalledWith("git", repoRoot, [
      "diff",
      "--cached",
      "--numstat",
      "--",
      sensitiveAbsPath,
    ]);
    expect(runGit).not.toHaveBeenCalledWith("git", repoRoot, [
      "diff",
      "--cached",
      "--",
      sensitiveAbsPath,
    ]);
  });
});
