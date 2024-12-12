import URI from "uri-js";
import { fileURLToPath, pathToFileURL } from "url";

export function getFullPath(uri: string): string {
  try {
    return URI.parse(uri).path ?? "";
  } catch (error) {
    console.error(`Invalid URI: ${uri}`, error);
    return "";
  }
}

export function localPathToUri(path: string) {
  const url = pathToFileURL(path);
  return URI.normalize(url.toString());
}

export function pathToUriPathSegment(path: string) {
  // Converts any OS path to cleaned up URI path segment format with no leading/trailing slashes
  // e.g. \path\to\folder\ -> path/to/folder
  //      \this\is\afile.ts -> this/is/afile.ts
  //      is/already/clean -> is/already/clean
  let clean = path.replace(/[\\]/g, "/"); // backslashes -> forward slashes
  clean = clean.replace(/^\//, ""); // remove start slash
  clean = clean.replace(/\/$/, ""); // remove end slash
  return clean;
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

/*
  
*/
export function localPathOrUriToPath(localPathOrUri: string): string {
  try {
    return fileURLToPath(localPathOrUri);
  } catch (e) {
    console.log("Converted url to path");
    return localPathOrUri;
  }
}

/*
  To smooth out the transition from path to URI will use this function to warn when path is used
*/
export function pathOrUriToUri(
  pathOrUri: string,
  workspaceDirUris: string[],
  showTraceOnPath = true,
): string {
  try {
    // URI.parse(pathOrUri);

    return pathOrUri;
  } catch (e) {
    if (showTraceOnPath) {
      console.trace("Received relative path", e);
    }
  }
}

export function splitUriPath(uri: string): string[] {
  let parts = path.includes("/") ? path.split("/") : path.split("\\");
  if (withRoot !== undefined) {
    const rootParts = splitPath(withRoot);
    parts = parts.slice(rootParts.length - 1);
  }
  return parts;
}

export function getLastNUriRelativePathParts(
  workspaceDirs: string[],
  uri: string,
  n: number,
): string {
  const path = getRelativePath(uri, workspaceDirs);
  return getLastNPathParts(path, n);
}

export function getUriPathBasename(uri: string): string {
  return getPath();
}

export function getFileExtensionFromBasename(filename: string) {
  return filename.split(".").pop() ?? "";
}

export function joinPathsToUri(uri: string, ...pathSegments: string[]) {
  const components = URI.parse(uri);
  const segments = pathSegments.map((segment) => pathToUriPathSegment(segment));
  components.path = `${components.path}/${segments.join("/")}`;
  return URI.serialize(components);
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

export function shortestRelativeUriPaths(
  uris: string[],
  workspaceUris: string[],
): string[] {
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
export function isUriWithinDirectory(
  uri: string,
  directoryUri: string,
): boolean {
  const uriPath = getFullPath(uri);
  const directoryPath = getFullPath(directoryUri);

  if (uriPath === directoryPath) {
    return false;
  }
  return uriPath.startsWith(directoryPath);
}

export function getUriFileExtension(uri: string) {
  const baseName = getUriPathBasename(uri);
  return baseName.split(".")[-1] ?? "";
}

const SEP_REGEX = /[\\/]/;

// export function getBasename(filepath: string): string {
//   return filepath.split(SEP_REGEX).pop() ?? "";
// }

export function getLastNPathParts(filepath: string, n: number): string {
  if (n <= 0) {
    return "";
  }
  return filepath.split(SEP_REGEX).slice(-n).join("/");
}

// export function groupByLastNPathParts(
//   filepaths: string[],
//   n: number,
// ): Record<string, string[]> {
//   return filepaths.reduce(
//     (groups, item) => {
//       const lastNParts = getLastNPathParts(item, n);
//       if (!groups[lastNParts]) {
//         groups[lastNParts] = [];
//       }
//       groups[lastNParts].push(item);
//       return groups;
//     },
//     {} as Record<string, string[]>,
//   );
// }

// export function getUniqueFilePath(
//   item: string,
//   itemGroups: Record<string, string[]>,
// ): string {
//   const lastTwoParts = getLastNPathParts(item, 2);
//   const group = itemGroups[lastTwoParts];

//   let n = 2;
//   if (group.length > 1) {
//     while (
//       group.some(
//         (otherItem) =>
//           otherItem !== item &&
//           getLastNPathParts(otherItem, n) === getLastNPathParts(item, n),
//       )
//     ) {
//       n++;
//     }
//   }

//   return getLastNPathParts(item, n);
// }

// export function splitPath(path: string, withRoot?: string): string[] {
//   let parts = path.includes("/") ? path.split("/") : path.split("\\");
//   if (withRoot !== undefined) {
//     const rootParts = splitPath(withRoot);
//     parts = parts.slice(rootParts.length - 1);
//   }
//   return parts;
// }

// export function getRelativePath(
//   filepath: string,
//   workspaceDirs: string[],
// ): string {
//   for (const workspaceDir of workspaceDirs) {
//     const filepathParts = splitPath(filepath);
//     const workspaceDirParts = splitPath(workspaceDir);
//     if (
//       filepathParts.slice(0, workspaceDirParts.length).join("/") ===
//       workspaceDirParts.join("/")
//     ) {
//       return filepathParts.slice(workspaceDirParts.length).join("/");
//     }
//   }
//   return splitPath(filepath).pop() ?? ""; // If the file is not in any of the workspaces, return the plain filename
// }
