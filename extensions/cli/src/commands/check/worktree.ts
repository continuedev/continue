import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { logger } from "../../util/logger.js";

/**
 * Create a git worktree that mirrors the user's current working tree state.
 * The worktree gets committed + staged + unstaged + untracked changes.
 */
export async function createWorktree(index: number): Promise<string> {
  const tmpDir = os.tmpdir();
  const worktreePath = path.join(tmpDir, `cn-check-${Date.now()}-${index}`);

  // Create the worktree at HEAD (detached)
  execSync(`git worktree add "${worktreePath}" HEAD --detach`, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Apply uncommitted changes (staged + unstaged) to the worktree
  try {
    const diff = execSync("git diff HEAD", {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (diff.trim()) {
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
    const untrackedOutput = execSync(
      "git ls-files --others --exclude-standard",
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();

    if (untrackedOutput) {
      const untrackedFiles = untrackedOutput.split("\n");
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
    execSync(`git worktree remove "${worktreePath}" --force`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    logger.debug("Could not remove worktree, attempting manual cleanup", {
      worktreePath,
      error: e,
    });
    // Manual cleanup as fallback
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true });
      // Prune the worktree entry
      execSync("git worktree prune", {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Best effort
    }
  }
}
