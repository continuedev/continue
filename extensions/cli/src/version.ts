import node_machine_id from "node-machine-id";

import { isAuthenticatedConfig, loadAuthConfig } from "./auth/workos.js";
import { logger } from "./util/logger.js";

export function getVersion(): string {
  return "unknown";
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
  // AIR-GAPPED: disable version checks entirely
  return Promise.resolve("unknown");
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
