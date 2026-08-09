import { exec, execSync } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const LARGE_STDIO_BUFFER_BYTES = 10 * 1024 * 1024; // bump buffer for large git output

/**
 * Get the git remote URL for the current repository
 * @param remote The remote name (defaults to 'origin')
 * @returns The remote URL or null if not found
 */
export function getGitRemoteUrl(remote: string = "origin"): string | null {
  try {
    const result = execSync(`git remote get-url ${remote}`, {
      encoding: "utf-8",
      cwd: process.cwd(),
      stdio: "pipe",
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Get the current git branch name
 * @returns The current branch name or null if not found
 */
export function getGitBranch(): string | null {
  try {
    const result = execSync("git branch --show-current", {
      encoding: "utf-8",
      cwd: process.cwd(),
      stdio: "pipe",
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Check if current directory is a git repository
 */
export function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      stdio: "ignore",
      cwd: process.cwd(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if running in GitHub Actions
 */
export function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS === "true";
}

/**
 * Check if running in Continue remote agents
 */
export function isContinueRemoteAgent(): boolean {
  return process.env.CONTINUE_REMOTE === "true";
}

/**
 * Get repository URL from GitHub Actions environment variables
 * @returns GitHub repository URL or null if not available
 */
export function getGitHubActionsRepoUrl(): string | null {
  if (!isGitHubActions()) {
    return null;
  }

  // GITHUB_REPOSITORY is in format "owner/repo"
  const githubRepository = process.env.GITHUB_REPOSITORY;
  if (!githubRepository) {
    return null;
  }

  // GITHUB_SERVER_URL defaults to https://github.com but can be different for GitHub Enterprise
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";

  return `${serverUrl}/${githubRepository}`;
}

/**
 * Get the current repository URL with enhanced detection for CI environments
 * Priority order:
 * 1. GitHub Actions environment variables (if running in GitHub Actions)
 * 2. Git remote URL (if in a git repository)
 * 3. Current working directory (fallback)
 * @returns Repository URL or local path
 */
export function getRepoUrl(): string {
  // First, check if we're in GitHub Actions and can get repo URL from env vars
  const githubActionsUrl = getGitHubActionsRepoUrl();
  if (githubActionsUrl) {
    return githubActionsUrl;
  }

  // Then check if we're in a git repository
  if (!isGitRepo()) {
    return process.cwd();
  }

  // Try to get the remote URL from git
  const remoteUrl = getGitRemoteUrl();
  const url = remoteUrl || process.cwd();
  return url.endsWith(".git") ? url.slice(0, -4) : url;
}

export interface GitDiffSnapshot {
  diff: string;
  repoFound: boolean;
}

function isExecError(
  error: unknown,
): error is { code?: number; stdout?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    ("code" in error || "stdout" in error)
  );
}

export async function getGitDiffSnapshot(): Promise<GitDiffSnapshot> {
  try {
    await execAsync("git rev-parse --git-dir", {
      maxBuffer: LARGE_STDIO_BUFFER_BYTES,
    });
  } catch (error) {
    if (isExecError(error) && error.code === 128) {
      return { diff: "", repoFound: false };
    }
    throw error;
  }

  try {
    const { stdout } = await execAsync("git diff main", {
      maxBuffer: LARGE_STDIO_BUFFER_BYTES,
    });
    return { diff: stdout, repoFound: true };
  } catch (error) {
    if (isExecError(error)) {
      if (error.code === 1 && error.stdout) {
        return { diff: error.stdout, repoFound: true };
      }

      if (error.code === 128) {
        return { diff: "", repoFound: false };
      }
    }
    throw error;
  }
}
