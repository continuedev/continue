import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import node_machine_id from "node-machine-id";

import { isAuthenticatedConfig, loadAuthConfig } from "./auth/workos.js";
import { logger } from "./util/logger.js";

export function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, "../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return packageJson.version;
  } catch {
    console.warn("Warning: Could not read version from package.json");
    return "unknown";
  }
}

function getEventUserId(): string {
  const authConfig = loadAuthConfig();

  if (isAuthenticatedConfig(authConfig)) {
    return authConfig.userId;
  }

  // Fall back to unique machine id if not signed in
  return node_machine_id.machineIdSync();
}

// Singleton to cache the latest version result
let latestVersionCache: Promise<string | null> | null = null;

export async function getLatestVersion(
  signal?: AbortSignal,
): Promise<string | null> {
  // Return cached promise if it exists
  if (latestVersionCache) {
    return latestVersionCache;
  }

  // Create and cache the promise
  latestVersionCache = (async () => {
    try {
      const id = getEventUserId();
      const response = await fetch(
        `https://api.continue.dev/cn/info?id=${encodeURIComponent(id)}`,
        { signal },
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.version;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Request was aborted, don't log
        return null;
      }
      logger?.debug(
        "Warning: Could not fetch latest version from api.continue.dev",
      );
      return null;
    }
  })();

  return latestVersionCache;
}

getLatestVersion()
  .then((version) => {
    if (version) {
      logger?.info(`Latest version: ${version}`);
    }
  })
  .catch((error) => {
    logger?.debug(
      `Warning: Could not fetch latest version from api.continue.dev: ${error}`,
    );
  });

export function compareVersions(
  current: string,
  latest: string,
): "newer" | "same" | "older" {
  if (current === "unknown" || latest === "unknown") {
    return "same";
  }

  // Simple semantic version comparison
  const parseVersion = (version: string) => {
    const parts = version
      .replace(/^v/, "")
      .split(".")
      .map((part) => parseInt(part, 10));
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
  };

  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);

  if (currentParts.major > latestParts.major) return "newer";
  if (currentParts.major < latestParts.major) return "older";
  if (currentParts.minor > latestParts.minor) return "newer";
  if (currentParts.minor < latestParts.minor) return "older";
  if (currentParts.patch > latestParts.patch) return "newer";
  if (currentParts.patch < latestParts.patch) return "older";

  return "same";
}
