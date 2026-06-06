export type ExecFn = (
  command: string,
  options: { cwd: string; maxBuffer?: number },
) => Promise<{
  stdout: string;
  stderr?: string;
}>;

const GIT_DIFF_MAX_BUFFER = 10 * 1024 * 1024;

export function splitGitDiff(diffString: string): string[] {
  const fileDiffHeaderRegex = /(?=diff --git a\/.* b\/.*)/;
  const diffs = diffString.split(fileDiffHeaderRegex);

  if (diffs[0]?.trim() === "") {
    diffs.shift();
  }

  return diffs.filter((diff) => diff.trim().length > 0);
}

export async function collectGitDiffsWithCli(
  candidateDirs: string[],
  includeUnstaged: boolean,
  execFn: ExecFn,
): Promise<string[]> {
  const visitedRoots = new Set<string>();
  const diffs: string[] = [];

  for (const candidateDir of candidateDirs) {
    if (!candidateDir) {
      continue;
    }

    let root: string;
    try {
      const { stdout } = await execFn("git rev-parse --show-toplevel", {
        cwd: candidateDir,
        maxBuffer: GIT_DIFF_MAX_BUFFER,
      });
      root = stdout.trim();
    } catch {
      continue;
    }

    if (!root || visitedRoots.has(root)) {
      continue;
    }
    visitedRoots.add(root);

    const commands = includeUnstaged
      ? ["git diff --cached", "git diff"]
      : ["git diff --cached"];

    for (const command of commands) {
      try {
        const { stdout } = await execFn(command, {
          cwd: root,
          maxBuffer: GIT_DIFF_MAX_BUFFER,
        });
        diffs.push(...splitGitDiff(stdout));
      } catch {
        // Skip directories where git diff cannot be retrieved via CLI.
      }
    }
  }

  return diffs;
}
