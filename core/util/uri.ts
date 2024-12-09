import URI from "uri-js";

export function getFullPath(uri: string): string {
  try {
    return URI.parse(uri).path ?? "";
  } catch (error) {
    console.error(`Invalid URI: ${uri}`, error);
    return "";
  }
}

// Whenever working with partial URIs
// Should always first get the path relative to the workspaces
// If a matching workspace is not found, ONLY the file name should be used
export function getRelativePath(
  fileUri: string,
  workspaceUris: string[],
): string {
  const fullPath = getFullPath(fileUri);
}

export function getLastNPathParts(path: string, n: number): string {
  if (n < 1) {
    return "";
  }
  const pathParts = path.split("/").filter(Boolean);
  if (pathParts.length <= n) {
    return path;
  }
  return pathParts.slice(-n).join("/");
}

export function getLastNUriRelativePathParts(
  workspaceDirs: string[],
  uri: string,
  n: number,
): string {
  const path = getRelativePath(uri, workspaceDirs);
  return getLastNPathParts(path, n);
}

export function getFileName(uri: string): string {
  return getPath();
}

export function join(uri: string, pathSegment: string) {
  return uri.replace(/\/*$/, "") + "/" + segment.replace(/^\/*/, "");
}
