import { exec, execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

import { logger } from "../../util/logger.js";

const execAsync = promisify(exec);

/**
 * Create a git worktree that mirrors the user's current working tree state.
 * The worktree gets committed + staged + unstaged + untracked changes.
 */
export async function createWorktree(index: number): Promise<string> {
  const tmpDir = os.tmpdir();
  const worktreePath = path.join(tmpDir, `cn-review-${Date.now()}-${index}`);

  // Create the worktree at HEAD (detached)
  await execAsync(`git worktree add "${worktreePath}" HEAD --detach`);

  // Apply uncommitted changes (staged + unstaged) to the worktree
  try {
    const { stdout: diff } = await execAsync("git diff HEAD", {
      maxBuffer: 10 * 1024 * 1024,
    });
    if (diff.trim()) {
      // execAsync (promisified exec) doesn't support `input`, use execSync for apply.
      // This is fine: the apply targets the isolated worktree, so it won't contend.
      execSync(`git -C "${worktreePath}" apply --allow-empty -`, {
        input: diff,
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
  } catch (e) {
    logger.debug("Could not apply uncommitted changes to worktree", {
      error: e,
    });
  }

  // Copy untracked files to the worktree
  try {
    const { stdout: untrackedOutput } = await execAsync(
      "git ls-files --others --exclude-standard",
    );

    if (untrackedOutput.trim()) {
      const untrackedFiles = untrackedOutput.trim().split("\n");
      const cwd = process.cwd();
      for (const file of untrackedFiles) {
        const srcPath = path.join(cwd, file);
        const destPath = path.join(worktreePath, file);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch {
          // Skip files that can't be copied
        }
      }
    }
  } catch (e) {
    logger.debug("Could not copy untracked files to worktree", { error: e });
  }

  // Commit the initial state so captureWorktreeDiff only captures agent changes
  await execAsync(`git -C "${worktreePath}" add -A`);
  await execAsync(
    `git -C "${worktreePath}" commit -m "cn-review: user working tree state (staged + unstaged + untracked)" --allow-empty --no-verify`,
  );

  return worktreePath;
}

/**
 * Capture the diff of changes the agent made in the worktree.
 * Returns a unified diff patch string.
 */
export function captureWorktreeDiff(worktreePath: string): string {
  try {
    // Add all new files so they show up in the diff
    execSync(`git -C "${worktreePath}" add -A`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    return execSync(`git -C "${worktreePath}" diff --cached`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

/**
 * Remove a git worktree.
 */
export async function cleanupWorktree(worktreePath: string): Promise<void> {
  try {
    await execAsync(`git worktree remove "${worktreePath}" --force`);
  } catch (e) {
    logger.debug("Could not remove worktree, attempting manual cleanup", {
      worktreePath,
      error: e,
    });
    // Manual cleanup as fallback
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true });
      await execAsync("git worktree prune");
    } catch {
      // Best effort
    }
  }
}
