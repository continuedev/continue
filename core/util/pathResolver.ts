import { fileURLToPath, pathToFileURL } from "node:url";
import * as path from "path";
import untildify from "untildify";
import { IDE } from "..";
import { resolveRelativePathInDir } from "./ideUtils";
import { findUriInDirs } from "./uri";

export interface ResolvedPath {
  uri: string;
  displayPath: string;
  isAbsolute: boolean;
  isWithinWorkspace: boolean;
}

/**
 * Checks if a URI is within any of the workspace directories
 * Also verifies the file actually exists, matching the behavior of resolveRelativePathInDir
 */
async function isUriWithinWorkspace(ide: IDE, uri: string): Promise<boolean> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  const { foundInDir } = findUriInDirs(uri, workspaceDirs);

  // Check both: within workspace path AND file exists
  if (foundInDir !== null) {
    return await ide.fileExists(uri);
  }

  return false;
}

export async function resolveInputPath(
  ide: IDE,
  inputPath: string,
): Promise<ResolvedPath | null> {
  const trimmedPath = inputPath.trim();

  // Handle file:// URIs
  if (trimmedPath.startsWith("file://")) {
    const displayPath = fileURLToPath(trimmedPath);
    const isWithinWorkspace = await isUriWithinWorkspace(ide, trimmedPath);
    return {
      uri: trimmedPath,
      displayPath,
      isAbsolute: true,
      isWithinWorkspace,
    };
  }

  // Expand tilde paths (handles ~/ and ~username/)
  const expandedPath = untildify(trimmedPath);

  // Check if it's an absolute path (including Windows paths)
  const isAbsolute =
    path.isAbsolute(expandedPath) ||
    // Windows network paths
    expandedPath.startsWith("\\\\") ||
    // Windows drive letters
    /^[a-zA-Z]:/.test(expandedPath);

  if (isAbsolute) {
    // Convert to file:// URI format
    const uri = pathToFileURL(expandedPath).href;
    const isWithinWorkspace = await isUriWithinWorkspace(ide, uri);
    return {
      uri,
      displayPath: expandedPath,
      isAbsolute: true,
      isWithinWorkspace,
    };
  }

  // Handle relative paths...
  const workspaceUri = await resolveRelativePathInDir(expandedPath, ide);
  if (workspaceUri) {
    return {
      uri: workspaceUri,
      displayPath: expandedPath,
      isAbsolute: false,
      isWithinWorkspace: true,
    };
  }

  return null;
}
