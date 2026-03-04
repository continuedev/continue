import { spawnSync } from "node:child_process";
import type * as vscode from "vscode";
import type { GitExtension } from "../otherExtensions/git";

export interface RunGitResult {
  stdout: string;
  stderr: string;
  status: number;
}

export function resolveGitExecutable(
  gitExtension: vscode.Extension<GitExtension>,
): string {
  const gitPath = gitExtension.exports.getAPI(1).git.path;
  return gitPath.trim().length > 0 ? gitPath : "git";
}

export function runGit(
  gitExe: string,
  cwd: string,
  args: string[],
): RunGitResult {
  const result = spawnSync(gitExe, args, {
    cwd,
    encoding: "utf8",
  });

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Git executable "${gitExe}" was not found. Install Git or configure VS Code setting "git.path".`,
      );
    }
    throw result.error;
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: typeof result.status === "number" ? result.status : -1,
  };
}
