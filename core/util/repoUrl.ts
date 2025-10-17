/**
 * Utility functions for normalizing and handling repository URLs.
 */

/**
 * Normalizes a repository URL to a consistent format.
 *
 * Handles various Git URL formats and converts them to a standard HTTPS GitHub URL:
 * - SSH format: `git@github.com:owner/repo.git` → `https://github.com/owner/repo`
 * - SSH protocol: `ssh://git@github.com/owner/repo.git` → `https://github.com/owner/repo`
 * - Shorthand: `owner/repo` → `https://github.com/owner/repo`
 * - Removes `.git` suffix
 * - Removes trailing slashes
 * - Normalizes to lowercase
 *
 * @param url - The repository URL to normalize
 * @returns The normalized repository URL in lowercase HTTPS format
 *
 * @example
 * ```typescript
 * normalizeRepoUrl("git@github.com:owner/repo.git")
 * // Returns: "https://github.com/owner/repo"
 *
 * normalizeRepoUrl("owner/repo")
 * // Returns: "https://github.com/owner/repo"
 *
 * normalizeRepoUrl("https://github.com/Owner/Repo.git")
 * // Returns: "https://github.com/owner/repo"
 * ```
 */
export function normalizeRepoUrl(url: string): string {
  if (!url) return "";

  let normalized = url.trim();

  // Convert SSH to HTTPS: git@github.com:owner/repo.git -> https://github.com/owner/repo
  if (normalized.startsWith("git@github.com:")) {
    normalized = normalized.replace("git@github.com:", "https://github.com/");
  }

  // Convert SSH protocol to HTTPS: ssh://git@github.com/owner/repo.git -> https://github.com/owner/repo
  // Also handles: ssh://git@github.com:owner/repo.git (less common)
  if (normalized.startsWith("ssh://git@github.com")) {
    normalized = normalized
      .replace("ssh://git@github.com/", "https://github.com/")
      .replace("ssh://git@github.com:", "https://github.com/");
  }

  // Convert shorthand owner/repo to full URL
  if (
    normalized.includes("/") &&
    !/^[a-z]+:\/\//i.test(normalized) &&
    !normalized.startsWith("git@")
  ) {
    normalized = `https://github.com/${normalized}`;
  }

  // Remove trailing slash before removing .git suffix
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // Remove .git suffix
  if (normalized.endsWith(".git")) {
    normalized = normalized.slice(0, -4);
  }

  // Normalize to lowercase
  return normalized.toLowerCase();
}
