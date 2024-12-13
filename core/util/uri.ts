import URI from "uri-js";
import { fileURLToPath, pathToFileURL } from "url";

// Converts a local path to a file:// URI
export function localPathToUri(path: string) {
  const url = pathToFileURL(path);
  return URI.normalize(url.toString());
}

export function localPathOrUriToPath(localPathOrUri: string): string {
  try {
    return fileURLToPath(localPathOrUri);
  } catch (e) {
    console.log("Received local filepath", localPathOrUri);

    return localPathOrUri;
  }
}

/** Converts any OS path to cleaned up URI path segment format with no leading/trailing slashes
   e.g. \path\to\folder\ -> path/to/folder
        \this\is\afile.ts -> this/is/afile.ts
        is/already/clean -> is/already/clean
  **/
export function pathToUriPathSegment(path: string) {
  let clean = path.replace(/[\\]/g, "/"); // backslashes -> forward slashes
  clean = clean.replace(/^\//, ""); // remove start slash
  clean = clean.replace(/\/$/, ""); // remove end slash
  return encodeURIComponent(clean);
}

export function findUriInDirs(
  uri: string,
  dirUriCandidates: string[],
): {
  relativePathOrBasename: string;
  foundInDir: string | null;
} {
  const uriComps = URI.parse(uri);
  if (!uriComps.scheme) {
    throw new Error(`Invalid uri: ${uri}`);
  }
  for (const dir of dirUriCandidates) {
    const dirComps = URI.parse(dir);

    if (!dirComps.scheme) {
      throw new Error(`Invalid uri: ${dir}`);
    }

    if (uriComps.scheme !== dirComps.scheme) {
      continue;
    }
    if (uriComps.path === dirComps.path) {
      continue;
    }
    // Can't just use starts with because e.g.
    // file:///folder/file is not within file:///fold
    return uriComps.path.startsWith(dirComps.path);
  }
  return {
    relativePathOrBasename: getUriPathBasename(uri),
    foundInDir: null,
  };
}

/*
  To smooth out the transition from path to URI will use this function to warn when path is used
  This will NOT work consistently with full OS paths like c:\blah\blah or ~/Users/etc
*/
export function relativePathOrUriToUri(
  relativePathOrUri: string,
  defaultDirUri: string,
): string {
  const out = URI.parse(relativePathOrUri);
  if (out.scheme) {
    return relativePathOrUri;
  }
  console.trace("Received path with no scheme");
  return joinPathsToUri(defaultDirUri, out.path ?? "");
}

/*
  Returns just the file or folder name of a URI
*/
export function getUriPathBasename(uri: string): string {
  return URI.parse(uri).path?.split("/")?.pop() || "";
}

/*
  Returns the file extension of a URI
*/
export function getUriFileExtension(uri: string) {
  const baseName = getUriPathBasename(uri);
  return baseName.split(".")[-1] ?? "";
}

export function getFileExtensionFromBasename(filename: string) {
  return filename.split(".").pop() ?? "";
}

export function getLastNUriRelativePathParts(
  dirUriCandidates: string[],
  uri: string,
  n: number,
): string {
  const { relativePathOrBasename } = findUriInDirs(uri, dirUriCandidates);
  return getLastNPathParts(relativePathOrBasename, n);
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
  dirUriCandidates: string[],
): string[] {
  if (uris.length === 0) {
    return [];
  }
  const relativeUris;

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

// export function getBasename(filepath: string): string {
//   return filepath.split(SEP_REGEX).pop() ?? "";
// }

export function getLastNPathParts(filepath: string, n: number): string {
  if (n <= 0) {
    return "";
  }
  return filepath.split(/[\\/]/).slice(-n).join("/");
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
