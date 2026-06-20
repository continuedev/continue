import { IDE } from "..";

import {
  joinEncodedUriPathSegmentToUri,
  joinPathsToUri,
  pathToUriPathSegment,
} from "./uri";

/*
  Helper function to normalize workspace directory paths to proper file:// URIs.
  This handles cases where workspace directories might be returned as plain file paths
  instead of URIs, which can occur on some IDE extensions like IntelliJ on Linux.

  Examples:
  - Input: "/home/user/project" -> Output: "file:///home/user/project"
  - Input: "file:///home/user/project" -> Output: "file:///home/user/project"
*/
export function normalizeDirUri(dirPath: string): string {
  // If it's already a URI with a scheme, return as-is
  if (dirPath.includes("://")) {
    return dirPath;
  }

  // Convert likely absolute filesystem paths to file:// URIs.
  // Workspace dirs should already be URIs, but this guards against malformed IDE inputs.
  if (dirPath.startsWith("/")) {
    return `file:///${pathToUriPathSegment(dirPath)}`;
  }

  // For Windows paths (C:\ or drive letters)
  if (/^[a-zA-Z]:/.test(dirPath)) {
    const normalized = dirPath.replaceAll("\\", "/");
    return `file:///${pathToUriPathSegment(normalized)}`;
  }

  return dirPath;
}

/*
  This function takes a relative (to workspace) filepath
  And checks each workspace for if it exists or not
  Only returns fully resolved URI if it exists
*/
export async function resolveRelativePathInDir(
  path: string,
  ide: IDE,
  dirUriCandidates?: string[],
): Promise<string | undefined> {
  const dirs = dirUriCandidates ?? (await ide.getWorkspaceDirs());
  for (const dirUri of dirs) {
    // Normalize the directory URI to ensure it's a proper file:// URI
    // This handles cases where workspace directories might be plain file paths
    const normalizedDirUri = normalizeDirUri(dirUri);
    const fullUri = joinPathsToUri(normalizedDirUri, path);
    if (await ide.fileExists(fullUri)) {
      return fullUri;
    }
  }

  return undefined;
}

/*
  Same as above but in this case the relative path does not need to exist (e.g. file to be created, etc)
  Checks closes match with the dirs, path segment by segment
  and based on which workspace has the closest matching path, returns resolved URI
  If no meaninful path match just concatenates to first dir's uri
*/
export async function inferResolvedUriFromRelativePath(
  _relativePath: string,
  ide: IDE,
  dirCandidates?: string[],
): Promise<string> {
  const relativePath = _relativePath.trim().replaceAll("\\", "/");
  const rawDirs = dirCandidates ?? (await ide.getWorkspaceDirs());

  // Normalize all directories to proper file:// URIs
  const dirs = rawDirs.map(normalizeDirUri);

  if (dirs.length === 0) {
    throw new Error("inferResolvedUriFromRelativePath: no dirs provided");
  }

  const segments = pathToUriPathSegment(relativePath).split("/");
  // Generate all possible suffixes from shortest to longest
  const suffixes: string[] = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    suffixes.push(segments.slice(i).join("/"));
  }

  // For each suffix, try to find a unique matching dir/file
  for (const suffix of suffixes) {
    const uris = dirs.map((dir) => ({
      dir,
      partialUri: joinEncodedUriPathSegmentToUri(dir, suffix),
    }));
    const promises = uris.map(async ({ partialUri, dir }) => {
      const exists = await ide.fileExists(partialUri);
      return {
        dir,
        partialUri,
        exists,
      };
    });
    const existenceChecks = await Promise.all(promises);

    const existingUris = existenceChecks.filter(({ exists }) => exists);

    // If exactly one directory matches, use it
    if (existingUris.length === 1) {
      return joinEncodedUriPathSegmentToUri(
        existingUris[0].dir,
        segments.join("/"),
      );
    }
  }

  // Sometimes the model will decide to only output the base name or small number of path parts
  // in which case we shouldn't create a new file if it matches the current file
  const activeFile = await ide.getCurrentFile();
  if (activeFile && activeFile.path.endsWith(relativePath)) {
    return activeFile.path;
  }

  // If no unique match found, use the first directory
  return joinPathsToUri(dirs[0], relativePath);
}
