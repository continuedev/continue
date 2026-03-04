import path from "node:path";
import { isSecurityConcern } from "../../../../core/indexing/ignore";
import { shouldExclude as defaultShouldExclude } from "./exclusionUtils";
import { runGit as defaultRunGit, type RunGitResult } from "./gitCliService";

export type CommitMessageChangeMode = "staged" | "unstaged" | "selected";

interface ParsedCandidate {
  status: string;
  filePath: string;
}

interface SelectedCandidate extends ParsedCandidate {
  absPath: string;
  isSecuritySensitive: boolean;
}

export interface CommitMessageChange {
  status: string;
  filePath: string;
  absPath: string;
  diff: string;
  staged?: boolean;
}

export interface CollectCommitMessageChangesResult {
  mode: CommitMessageChangeMode;
  changes: CommitMessageChange[];
  diffs: string[];
  branch: string;
  recentCommits?: string;
  selectedFilesCount?: number;
  listFailure?: {
    command: string;
    status: number;
    stderr: string;
  };
}

export interface CollectCommitMessageChangesOptions {
  gitExecutable: string;
  cwd: string;
  runGit?: (gitExe: string, cwd: string, args: string[]) => RunGitResult;
  shouldExclude?: (diffOrPath: string) => boolean;
  selectedFiles?: string[];
}

function parseStagedNameStatus(stdout: string): ParsedCandidate[] {
  return stdout.split(/\r?\n/).flatMap((line) => {
    if (!line) {
      return [];
    }

    const tabIndex = line.indexOf("\t");
    if (tabIndex < 0) {
      return [];
    }

    const status = line.slice(0, tabIndex).trim();
    const filePath = line.slice(tabIndex + 1).trim();

    if (!status || !filePath) {
      return [];
    }

    return [{ status, filePath }];
  });
}

function parseUnstagedPorcelain(stdout: string): ParsedCandidate[] {
  return stdout.split(/\r?\n/).flatMap((line) => {
    if (!line) {
      return [];
    }

    const x = line[0] ?? " ";
    const y = line[1] ?? " ";
    let status = "";

    if (x === "?" && y === "?") {
      status = "?";
    } else if (y !== " ") {
      status = y;
    } else if (x !== " ") {
      status = x;
    } else {
      return [];
    }

    const filePath = line.substring(2).trim();
    if (!filePath) {
      return [];
    }

    return [{ status, filePath }];
  });
}

function isCommandSuccessful(result: RunGitResult): boolean {
  return result.status === 0;
}

function getGitFailureDetail(result: RunGitResult): string {
  const stderr = result.stderr.trim();
  if (stderr.length > 0) {
    return stderr;
  }

  return `exit code ${result.status}`;
}

export function collectCommitMessageChanges(
  options: CollectCommitMessageChangesOptions,
): CollectCommitMessageChangesResult {
  const runGit = options.runGit ?? defaultRunGit;
  const shouldExclude = options.shouldExclude ?? defaultShouldExclude;

  const selectedFiles = (options.selectedFiles ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const classifyCandidates = (
    candidates: ParsedCandidate[],
  ): SelectedCandidate[] =>
    candidates.flatMap(({ status, filePath }) => {
      const absPath = path.join(options.cwd, filePath);
      const securitySensitive = isSecurityConcern(absPath);
      const excluded = shouldExclude(filePath);

      if (excluded && !securitySensitive) {
        return [];
      }

      return [
        {
          status,
          filePath,
          absPath,
          isSecuritySensitive: securitySensitive,
        },
      ];
    });

  if (selectedFiles.length > 0) {
    const selectedCandidates = classifyCandidates(
      selectedFiles.map((filePath) => ({ status: "M", filePath })),
    );

    const changes = selectedCandidates.map(
      ({ status, filePath, absPath, isSecuritySensitive }) => {
        if (isSecuritySensitive) {
          return {
            status,
            filePath,
            absPath,
            diff: `Security-sensitive file redacted: ${absPath}`,
            staged: undefined,
          };
        }

        try {
          let derivedStatus = status;
          const statusResult = runGit(options.gitExecutable, options.cwd, [
            "status",
            "--porcelain",
            "--",
            absPath,
          ]);
          const statusOutput = isCommandSuccessful(statusResult)
            ? statusResult.stdout
            : "";
          const statusLine = statusOutput.split(/\r?\n/).find(Boolean) ?? "";

          if (statusLine.trimStart().startsWith("??")) {
            return {
              status: "?",
              filePath,
              absPath,
              diff: `New untracked file: ${absPath}`,
              staged: false,
            };
          }

          const x = statusLine[0] ?? " ";
          const y = statusLine[1] ?? " ";
          if (y !== " ") {
            derivedStatus = y;
          } else if (x !== " ") {
            derivedStatus = x;
          }

          const cachedNumstat = runGit(options.gitExecutable, options.cwd, [
            "diff",
            "--cached",
            "--numstat",
            "--",
            absPath,
          ]);

          const hasCachedDiff =
            isCommandSuccessful(cachedNumstat) &&
            cachedNumstat.stdout.trim().length > 0;

          if (hasCachedDiff) {
            if (cachedNumstat.stdout.includes("-\t-\t")) {
              return {
                status: derivedStatus,
                filePath,
                absPath,
                diff: `Binary file ${absPath} has been staged`,
                staged: true,
              };
            }

            const patch = runGit(options.gitExecutable, options.cwd, [
              "diff",
              "--cached",
              "--",
              absPath,
            ]);

            if (!isCommandSuccessful(patch)) {
              throw new Error(patch.stderr || "diff failed");
            }

            return {
              status: derivedStatus,
              filePath,
              absPath,
              diff: patch.stdout,
              staged: true,
            };
          }

          const numstat = runGit(options.gitExecutable, options.cwd, [
            "diff",
            "--numstat",
            "--",
            absPath,
          ]);

          if (!isCommandSuccessful(numstat)) {
            throw new Error(numstat.stderr || "diff failed");
          }

          if (numstat.stdout.includes("-\t-\t")) {
            return {
              status: derivedStatus,
              filePath,
              absPath,
              diff: `Binary file ${absPath} has been modified`,
              staged: false,
            };
          }

          const patch = runGit(options.gitExecutable, options.cwd, [
            "diff",
            "--",
            absPath,
          ]);

          if (!isCommandSuccessful(patch)) {
            throw new Error(patch.stderr || "diff failed");
          }

          return {
            status: derivedStatus,
            filePath,
            absPath,
            diff: patch.stdout,
            staged: false,
          };
        } catch {
          return {
            status,
            filePath,
            absPath,
            diff: `File ${absPath} - diff unavailable`,
            staged: undefined,
          };
        }
      },
    );

    const { branch, recentCommits } = collectRepositoryContext(options, runGit);

    return {
      mode: "selected",
      changes,
      diffs: changes.map((change) => change.diff),
      branch,
      recentCommits,
      selectedFilesCount: selectedFiles.length,
    };
  }

  const stagedListResult = runGit(options.gitExecutable, options.cwd, [
    "diff",
    "--name-status",
    "--cached",
  ]);

  const stagedListFailure: CollectCommitMessageChangesResult["listFailure"] =
    isCommandSuccessful(stagedListResult)
      ? undefined
      : {
          command: "git diff --name-status --cached",
          status: stagedListResult.status,
          stderr: getGitFailureDetail(stagedListResult),
        };

  const stagedCandidates = isCommandSuccessful(stagedListResult)
    ? classifyCandidates(parseStagedNameStatus(stagedListResult.stdout))
    : [];

  const mode: CommitMessageChangeMode =
    stagedCandidates.length > 0 ? "staged" : "unstaged";

  let unstagedCandidates: SelectedCandidate[] = [];
  let unstagedListFailure: CollectCommitMessageChangesResult["listFailure"];

  if (mode === "unstaged") {
    const unstagedListResult = runGit(options.gitExecutable, options.cwd, [
      "status",
      "--porcelain",
    ]);

    if (!isCommandSuccessful(unstagedListResult)) {
      unstagedListFailure = {
        command: "git status --porcelain",
        status: unstagedListResult.status,
        stderr: getGitFailureDetail(unstagedListResult),
      };
    } else {
      unstagedCandidates = classifyCandidates(
        parseUnstagedPorcelain(unstagedListResult.stdout),
      );
    }
  }

  if (unstagedListFailure) {
    const { branch, recentCommits } = collectRepositoryContext(options, runGit);
    return {
      mode,
      changes: [],
      diffs: [],
      branch,
      recentCommits,
      listFailure: unstagedListFailure,
    };
  }

  const finalCandidates =
    mode === "staged" ? stagedCandidates : unstagedCandidates;

  if (finalCandidates.length === 0 && stagedListFailure) {
    const { branch, recentCommits } = collectRepositoryContext(options, runGit);
    return {
      mode,
      changes: [],
      diffs: [],
      branch,
      recentCommits,
      listFailure: stagedListFailure,
    };
  }

  const changes = finalCandidates.map(
    ({ status, filePath, absPath, isSecuritySensitive }) => {
      if (isSecuritySensitive) {
        return {
          status,
          filePath,
          absPath,
          diff: `Security-sensitive file redacted: ${absPath}`,
          staged: mode === "staged" ? true : false,
        };
      }

      try {
        if (mode === "staged") {
          const numstat = runGit(options.gitExecutable, options.cwd, [
            "diff",
            "--cached",
            "--numstat",
            "--",
            absPath,
          ]);
          if (!isCommandSuccessful(numstat)) {
            throw new Error(numstat.stderr || "diff failed");
          }

          if (numstat.stdout.includes("-\t-\t")) {
            return {
              status,
              filePath,
              absPath,
              diff: `Binary file ${absPath} has been staged`,
              staged: true,
            };
          }

          const patch = runGit(options.gitExecutable, options.cwd, [
            "diff",
            "--cached",
            "--",
            absPath,
          ]);
          if (!isCommandSuccessful(patch)) {
            throw new Error(patch.stderr || "diff failed");
          }

          return {
            status,
            filePath,
            absPath,
            diff: patch.stdout,
            staged: true,
          };
        }

        if (status === "?") {
          return {
            status,
            filePath,
            absPath,
            diff: `New untracked file: ${absPath}`,
            staged: false,
          };
        }

        const numstat = runGit(options.gitExecutable, options.cwd, [
          "diff",
          "--numstat",
          "--",
          absPath,
        ]);
        if (!isCommandSuccessful(numstat)) {
          throw new Error(numstat.stderr || "diff failed");
        }

        if (numstat.stdout.includes("-\t-\t")) {
          return {
            status,
            filePath,
            absPath,
            diff: `Binary file ${absPath} has been modified`,
            staged: false,
          };
        }

        const patch = runGit(options.gitExecutable, options.cwd, [
          "diff",
          "--",
          absPath,
        ]);
        if (!isCommandSuccessful(patch)) {
          throw new Error(patch.stderr || "diff failed");
        }

        return {
          status,
          filePath,
          absPath,
          diff: patch.stdout,
          staged: false,
        };
      } catch {
        return {
          status,
          filePath,
          absPath,
          diff: `File ${absPath} - diff unavailable`,
          staged: undefined,
        };
      }
    },
  );

  const { branch, recentCommits } = collectRepositoryContext(options, runGit);

  return {
    mode,
    changes,
    diffs: changes.map((change) => change.diff),
    branch,
    recentCommits,
  };
}

function collectRepositoryContext(
  options: Pick<CollectCommitMessageChangesOptions, "gitExecutable" | "cwd">,
  runGit: (gitExe: string, cwd: string, args: string[]) => RunGitResult,
): { branch: string; recentCommits?: string } {
  let branch = "";
  try {
    const branchResult = runGit(options.gitExecutable, options.cwd, [
      "branch",
      "--show-current",
    ]);
    if (branchResult.status === 0) {
      branch = branchResult.stdout.trim();
    }
  } catch {
    branch = "";
  }

  let recentCommits: string | undefined;
  try {
    const logResult = runGit(options.gitExecutable, options.cwd, [
      "log",
      "--oneline",
      "-5",
    ]);
    if (logResult.status === 0) {
      const trimmedLog = logResult.stdout.trim();
      if (trimmedLog.length > 0) {
        recentCommits = trimmedLog;
      }
    }
  } catch {
    recentCommits = undefined;
  }

  return { branch, recentCommits };
}
