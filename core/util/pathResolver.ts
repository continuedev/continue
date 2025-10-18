import * as os from "os";
import * as path from "path";
import { IDE } from "..";
import { resolveRelativePathInDir } from "./ideUtils";
import { localPathToUri } from "./pathToUri";

export interface ResolvedPath {
  uri: string;
  displayPath: string;
  isAbsolute: boolean;
  isWithinWorkspace: boolean;
}

/**
 * Checks if a path is within any of the workspace directories
 */
async function isPathWithinWorkspace(
  ide: IDE,
  absolutePath: string
): Promise<boolean> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  const normalizedPath = path.normalize(absolutePath).toLowerCase();

  for (const dir of workspaceDirs) {
    const normalizedDir = path.normalize(dir).toLowerCase();
    if (normalizedPath.startsWith(normalizedDir)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves user-provided paths that may be:
 * - Relative to workspace directories
 * - Absolute paths (Unix/Windows)
 * - Tilde paths (~/ or ~username/)
 * - File URIs (file://)
 *
 * Returns both the URI and a normalized display path.
 */
export async function resolveInputPath(
  ide: IDE,
  inputPath: string,
): Promise<ResolvedPath | null> {
  // Trim whitespace
  const trimmedPath = inputPath.trim();

  // Check for file:// URI
  if (trimmedPath.startsWith("file://")) {
    const uri = trimmedPath;
    // Extract path from URI for display
    const displayPath = decodeURIComponent(uri.slice(7));
    const isWithinWorkspace = await isPathWithinWorkspace(ide, displayPath);
    return {
      uri,
      displayPath,
      isAbsolute: true,
      isWithinWorkspace,
    };
  }

  // Expand tilde paths
  let expandedPath = trimmedPath;
  if (trimmedPath.startsWith("~/")) {
    expandedPath = path.join(os.homedir(), trimmedPath.slice(2));
  } else if (trimmedPath === "~") {
    expandedPath = os.homedir();
  } else if (trimmedPath.startsWith("~") && trimmedPath.includes("/")) {
    // Handle ~username/ format (Unix-like systems)
    // For now, we'll just return null as this requires more complex parsing
    // and platform-specific handling
    return null;
  }

  // Check if it's an absolute path
  const isAbsolute =
    path.isAbsolute(expandedPath) ||
    // Windows network paths
    expandedPath.startsWith("\\\\") ||
    // Windows drive letters (C:, D:, etc.)
    /^[a-zA-Z]:/.test(expandedPath);

  if (isAbsolute) {
    // For Windows network paths, handle specially
    if (expandedPath.startsWith("\\\\")) {
      const networkPath = expandedPath.replace(/\\/g, "/");
      const uri = "file:" + networkPath; // file://server/share format
      const isWithinWorkspace = await isPathWithinWorkspace(ide, expandedPath);
      return {
        uri,
        displayPath: expandedPath,
        isAbsolute: true,
        isWithinWorkspace,
      };
    }
    // Convert absolute path to URI
    const uri = localPathToUri(expandedPath);
    const isWithinWorkspace = await isPathWithinWorkspace(ide, expandedPath);
    return {
      uri,
      displayPath: expandedPath,
      isAbsolute: true,
      isWithinWorkspace,
    };
  }

  // Fall back to relative path resolution within workspace
  const workspaceUri = await resolveRelativePathInDir(expandedPath, ide);
  if (workspaceUri) {
    // Relative paths resolved within workspace are always within workspace
    return {
      uri: workspaceUri,
      displayPath: expandedPath,
      isAbsolute: false,
      isWithinWorkspace: true,
    };
  }

  return null;
}

/**
 * Normalizes a path for display purposes.
 * Contracts home directory to ~ on Unix-like systems.
 */
export function normalizeDisplayPath(fullPath: string): string {
  const home = os.homedir();
  if (fullPath.startsWith(home)) {
    return "~" + fullPath.slice(home.length);
  }
  return fullPath;
}
