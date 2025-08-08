import { execSync } from "child_process";

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
 * Get the current repository URL, falling back to local path if not a git repo
 * @returns Git remote URL or local path
 */
export function getRepoUrl(): string {
  if (!isGitRepo()) {
    return process.cwd();
  }

  const remoteUrl = getGitRemoteUrl();
  return remoteUrl || process.cwd();
}
