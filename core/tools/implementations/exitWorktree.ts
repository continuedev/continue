import { ToolImpl } from ".";
import { getBooleanArg, getStringArg } from "../parseArgs";

/**
 * Fail-closed change detection: returns null when the state cannot be
 * reliably determined (git exits non-zero, lock files, corrupt index).
 * Callers that use this as a safety gate MUST treat null as "unknown,
 * assume unsafe" — a silent 0/0 would let remove destroy real work.
 */
async function countWorktreeChanges(
  worktreePath: string,
  subprocess: (cmd: string, cwd: string) => Promise<[string, string]>,
): Promise<{ changedFiles: number; unpushedCommits: number } | null> {
  // Uncommitted file changes
  const [statusOut, , statusCode] = await subprocess(
    "git status --porcelain",
    worktreePath,
  ).then(([o, e]) => [o, e, 0] as [string, string, number]).catch(() => ["", "", 1] as [string, string, number]);

  if (statusCode !== 0) {
    return null;
  }
  const changedFiles = statusOut
    .split("\n")
    .filter((l) => l.trim() !== "").length;

  // Commits ahead of the upstream/default branch (best-effort)
  let unpushedCommits = 0;
  try {
    const [logOut] = await subprocess(
      "git log --oneline @{u}.. 2>/dev/null || git log --oneline HEAD~100..HEAD 2>/dev/null | head -100",
      worktreePath,
    );
    unpushedCommits = logOut.split("\n").filter((l) => l.trim() !== "").length;
  } catch {
    // Best-effort — if this fails we at least have the file change count.
  }

  return { changedFiles, unpushedCommits };
}

export const exitWorktreeImpl: ToolImpl = async (args, extras) => {
  const worktreePath = getStringArg(args, "worktree_path");
  const action = getStringArg(args, "action") as "keep" | "remove";
  const discardChanges = getBooleanArg(args, "discard_changes", false);

  if (action === "keep") {
    return [
      {
        name: "Worktree Kept",
        description: `Worktree at ${worktreePath} preserved`,
        content: `Worktree at \`${worktreePath}\` has been kept on disk. The branch and all work are preserved for review or further use.`,
      },
    ];
  }

  // action === "remove"
  if (!discardChanges) {
    const changes = await countWorktreeChanges(
      worktreePath,
      extras.ide.subprocess.bind(extras.ide),
    );

    if (changes === null) {
      return [
        {
          name: "Refused: Cannot Verify State",
          description: "Could not determine worktree safety",
          content: `Could not verify the state of the worktree at \`${worktreePath}\`. Refusing to remove without explicit confirmation. Re-invoke with \`discard_changes: true\` to proceed — or use \`action: "keep"\` to preserve the worktree.`,
        },
      ];
    }

    if (changes.changedFiles > 0 || changes.unpushedCommits > 0) {
      const lines: string[] = [];
      if (changes.changedFiles > 0) {
        lines.push(`- ${changes.changedFiles} uncommitted file change(s)`);
      }
      if (changes.unpushedCommits > 0) {
        lines.push(`- ${changes.unpushedCommits} unpushed commit(s)`);
      }
      return [
        {
          name: "Refused: Uncommitted Work",
          description: "Worktree has uncommitted or unpushed changes",
          content: `The worktree at \`${worktreePath}\` has unsaved work:\n${lines.join("\n")}\n\nTo discard and remove anyway, re-invoke with \`discard_changes: true\`. To preserve, use \`action: "keep"\`.`,
        },
      ];
    }
  }

  // Safe to remove (or user explicitly acknowledged discard)
  await extras.ide.subprocess(
    `git worktree remove --force "${worktreePath}"`,
    worktreePath.split("/").slice(0, -2).join("/") || "/",
  );

  return [
    {
      name: "Worktree Removed",
      description: `Worktree at ${worktreePath} deleted`,
      content: `Worktree at \`${worktreePath}\` has been removed${discardChanges ? " (changes discarded)" : ""}.`,
    },
  ];
};
