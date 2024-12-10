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

export function getLastNUriRelativePathParts(
  workspaceDirs: string[],
  uri: string,
  n: number,
): string {
  const path = getRelativePath(uri, workspaceDirs);
  return getLastN(path, n);
}

export function getUriPathBasename(uri: string): string {
  return getPath();
}

export function join(uri: string, pathSegment: string) {
  return uri.replace(/\/*$/, "") + "/" + segment.replace(/^\/*/, "");
}

export function groupByLastNPathParts(
  uris: string[],
  n: number,
): Record<string, string[]> {
  return [];
}

export function getUniqueUriPath(
  item: string,
  itemGroups: Record<string, string[]>,
): string {
  return "hi";
}

export function shortestRelativeUriPaths(uris: string[]): string[] {
  if (uris.length === 0) {
    return [];
  }

  const partsLengths = uris.map((x) => x.split("/").length);
  const currentRelativeUris = uris.map(getB);
  const currentNumParts = uris.map(() => 1);
  const isDuplicated = currentRelativeUris.map(
    (x, i) =>
      currentRelativeUris.filter((y, j) => y === x && paths[i] !== paths[j])
        .length > 1,
  );

  while (isDuplicated.some(Boolean)) {
    const firstDuplicatedPath = currentRelativeUris.find(
      (x, i) => isDuplicated[i],
    );
    if (!firstDuplicatedPath) {
      break;
    }

    currentRelativeUris.forEach((x, i) => {
      if (x === firstDuplicatedPath) {
        currentNumParts[i] += 1;
        currentRelativeUris[i] = getLastNUriRelativePathParts(
          paths[i],
          currentNumParts[i],
        );
      }
    });

    isDuplicated.forEach((x, i) => {
      if (x) {
        isDuplicated[i] =
          // Once we've used up all the parts, we can't make it longer
          currentNumParts[i] < partsLengths[i] &&
          currentRelativeUris.filter((y) => y === currentRelativeUris[i])
            .length > 1;
      }
    });
  }

  return currentRelativeUris;
}
