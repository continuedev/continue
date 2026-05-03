import path from "node:path";
import { ToolImpl } from ".";
import { getStringArg } from "../parseArgs";

const SLUG_RE = /^[a-zA-Z0-9._-]{1,64}$/;

function validateSlug(name: string): void {
  if (!SLUG_RE.test(name)) {
    throw new Error(
      `Invalid worktree name "${name}". Each segment may only contain letters, digits, dots, underscores, and dashes (max 64 chars total).`,
    );
  }
}

function generateSlug(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "-")
    .slice(0, 19);
  return `worktree-${ts}`;
}

export const enterWorktreeImpl: ToolImpl = async (args, extras) => {
  const rawName = typeof args?.name === "string" ? args.name.trim() : "";
  const rawBranch =
    typeof args?.branch === "string" ? args.branch.trim() : "";

  const slug = rawName || generateSlug();
  if (rawName) {
    validateSlug(rawName);
  }

  // Find the canonical git root from any workspace directory.
  const workspaceDirs = await extras.ide.getWorkspaceDirs();
  if (workspaceDirs.length === 0) {
    throw new Error("No workspace directory found.");
  }

  const [gitRootOut] = await extras.ide.subprocess(
    "git rev-parse --show-toplevel",
    workspaceDirs[0],
  );
  const gitRoot = gitRootOut.trim();
  if (!gitRoot) {
    throw new Error("Could not determine git root. Is this a git repository?");
  }

  // Verify we are not already inside a worktree we created (best-effort check
  // via presence of the worktrees directory entry).
  const [listOut] = await extras.ide.subprocess(
    "git worktree list --porcelain",
    gitRoot,
  );
  const worktreePaths = listOut
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length).trim());
  const activeWorktrees = worktreePaths.slice(1); // first entry is always the main worktree
  const cwd = workspaceDirs[0];
  if (activeWorktrees.some((p) => cwd.startsWith(p))) {
    throw new Error(
      `Already inside a worktree at "${cwd}". Exit the current worktree before creating a new one.`,
    );
  }

  // Place new worktrees under <gitRoot>/.worktrees/<slug>
  const worktreePath = path.join(gitRoot, ".worktrees", slug);
  const branchName = rawBranch || slug;

  // Try to create the branch; if it already exists, check it out instead.
  const [, createErr] = await extras.ide.subprocess(
    `git worktree add "${worktreePath}" -b "${branchName}" 2>&1 || git worktree add "${worktreePath}" "${branchName}"`,
    gitRoot,
  );

  // Re-confirm the path was created.
  const [verifyOut] = await extras.ide.subprocess(
    `git worktree list --porcelain`,
    gitRoot,
  );
  const created = verifyOut.includes(worktreePath);

  if (!created) {
    const errDetail = createErr?.trim() ? `: ${createErr.trim()}` : "";
    throw new Error(`Failed to create worktree at "${worktreePath}"${errDetail}`);
  }

  const branchInfo = rawBranch ? ` on branch "${branchName}"` : ` (new branch "${branchName}")`;

  return [
    {
      name: "Worktree Created",
      description: `Git worktree at ${worktreePath}`,
      content: `Worktree created at \`${worktreePath}\`${branchInfo}.\n\nUse this path as the base for all file operations in this task. When done, call ExitWorktree with \`worktree_path: "${worktreePath}"\`.`,
    },
  ];
};
