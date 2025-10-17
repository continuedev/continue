import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Resolves user-provided paths for CLI context.
 * Handles absolute paths, tilde paths, and relative paths.
 */
export function resolveInputPath(inputPath: string): string | null {
  // Trim whitespace
  const trimmedPath = inputPath.trim();

  // Expand tilde paths
  let expandedPath = trimmedPath;
  if (trimmedPath.startsWith("~/") || trimmedPath.startsWith("~\\")) {
    expandedPath = path.join(os.homedir(), trimmedPath.slice(2));
  } else if (trimmedPath === "~") {
    expandedPath = os.homedir();
  } else if (trimmedPath.startsWith("./")) {
    // Keep relative paths starting with ./ as is (relative to cwd)z
    expandedPath = trimmedPath;
  }

  // Resolve the path (handles both absolute and relative paths)
  const resolvedPath = path.resolve(expandedPath);

  // Check if the path exists
  if (fs.existsSync(resolvedPath)) {
    return resolvedPath;
  }

  return null;
}
