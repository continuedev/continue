/**
 * Utility functions for normalizing and handling repository URLs.
 */

/* Documentation unavailable in air-gapped mode */
export function normalizeRepoUrl(url: string): string {
  if (!url) return "";

  let normalized = url.trim();

  // Documentation unavailable in air-gapped mode
  if (normalized.startsWith("git@github.com:")) {
    normalized = normalized.replace("git@github.com:", "https://github.com/");
  }

  // Documentation unavailable in air-gapped mode
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
