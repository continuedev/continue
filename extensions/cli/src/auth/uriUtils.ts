/**
 * URI utility functions for auth config
 */

import * as os from "os";
import * as path from "path";

/**
 * Resolves a file path to an absolute path, handling tilde expansion
 */
function resolveFilePath(filePath: string): string {
  // Handle tilde (~) expansion for home directory
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }

  // Resolve relative paths to absolute paths
  return path.resolve(filePath);
}

export function pathToUri(filePath: string): string {
  // Ensure we always create valid file:// URIs with absolute paths
  const absolutePath = resolveFilePath(filePath);
  return `file://${absolutePath}`;
}

export function slugToUri(slug: string): string {
  return `slug://${slug}`;
}

export function uriToPath(uri: string): string | null {
  if (!uri.startsWith("file://")) {
    return null;
  }
  return uri.slice(7);
}

export function uriToSlug(uri: string): string | null {
  if (!uri.startsWith("slug://")) {
    return null;
  }
  return uri.slice(7);
}
