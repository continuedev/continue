import { execSync } from "child_process";

import { logger } from "../../util/logger.js";

const MAX_DIFF_SIZE = 50 * 1024; // 50KB

export interface DiffContext {
  baseBranch: string;
  diff: string;
  changedFiles: string[];
  stat: string;
  truncated: boolean;
}

/**
 * Auto-detect the default branch (main/master) for the current repo.
 */
function detectDefaultBranch(): string {
  try {
    const ref = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    // refs/remotes/origin/main -> main
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    // Fallback: check if main or master exists
    try {
      execSync("git rev-parse --verify main", {
        stdio: ["pipe", "pipe", "pipe"],
      });
      return "main";
    } catch {
      try {
        execSync("git rev-parse --verify master", {
          stdio: ["pipe", "pipe", "pipe"],
        });
        return "master";
      } catch {
        return "main"; // Default fallback
      }
    }
  }
}

/**
 * Compute the diff context for the current working tree against a base branch.
 * Includes both committed changes on the branch AND uncommitted changes.
 */
export function computeDiffContext(baseBranch?: string): DiffContext {
  const base = baseBranch || detectDefaultBranch();

  // Get the merge-base to handle diverged branches
  let mergeBase: string;
  try {
    mergeBase = execSync(`git merge-base ${base} HEAD`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    logger.warn(
      `Could not find merge-base with ${base}, falling back to direct diff`,
    );
    mergeBase = base;
  }

  // Get diff of committed changes + working tree changes against the base
  let diff: string;
  let truncated = false;
  try {
    // Use diff against merge-base to include all branch changes + working tree
    diff = execSync(`git diff ${mergeBase}`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    diff = "";
  }

  if (diff.length > MAX_DIFF_SIZE) {
    diff = diff.slice(0, MAX_DIFF_SIZE);
    truncated = true;
  }

  // Get changed file list
  let changedFiles: string[] = [];
  try {
    const fileList = execSync(`git diff --name-only ${mergeBase}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    changedFiles = fileList ? fileList.split("\n") : [];
  } catch {
    changedFiles = [];
  }

  // Get diff stat
  let stat = "";
  try {
    stat = execSync(`git diff --stat ${mergeBase}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    stat = "";
  }

  return {
    baseBranch: base,
    diff,
    changedFiles,
    stat,
    truncated,
  };
}
