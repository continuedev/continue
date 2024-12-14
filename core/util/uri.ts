import * as URI from "uri-js";

/** Converts any OS path to cleaned up URI path segment format with no leading/trailing slashes
   e.g. \path\to\folder\ -> path/to/folder
        \this\is\afile.ts -> this/is/afile.ts
        is/already/clean -> is/already/clean
  **/
export function pathToUriPathSegment(path: string) {
  let clean = path.replace(/[\\]/g, "/"); // backslashes -> forward slashes
  clean = clean.replace(/^\//, ""); // remove start slash
  clean = clean.replace(/\/$/, ""); // remove end slash
  return clean
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function findUriInDirs(
  uri: string,
  dirUriCandidates: string[],
): {
  uri: string;
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
    // Can't just use startsWith because e.g.
    // file:///folder/file is not within file:///fold

    // At this point we break the path up and check if each dir path part matches
    const dirPathParts = (dirComps.path ?? "")
      .replace(/^\//, "")
      .split("/")
      .map((part) => encodeURIComponent(part));
    const uriPathParts = (uriComps.path ?? "")
      .replace(/^\//, "")
      .split("/")
      .map((part) => encodeURIComponent(part));

    if (uriPathParts.length < dirPathParts.length) {
      continue;
    }
    let allDirPartsMatch = true;
    for (let i = 0; i < dirPathParts.length; i++) {
      if (dirPathParts[i] !== uriPathParts[i]) {
        allDirPartsMatch = false;
      }
    }
    if (allDirPartsMatch) {
      const relativePath = uriPathParts.slice(dirPathParts.length).join("/");
      return {
        uri,
        relativePathOrBasename: relativePath,
        foundInDir: dir,
      };
    }
  }
  // Not found
  console.trace("Directory not found for uri", uri, dirUriCandidates);
  return {
    uri,
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
  return (baseName.split(".")[-1] ?? "").toLowerCase();
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

export function getShortestUniqueRelativeUriPaths(
  uris: string[],
  dirUriCandidates: string[],
): {
  uri: string;
  uniquePath: string;
}[] {
  // Split all URIs into segments and count occurrences of each suffix combination
  const segmentCombinationsMap = new Map<string, number>();
  const segmentsInfo = uris.map((uri) => {
    const { relativePathOrBasename } = findUriInDirs(uri, dirUriCandidates);
    const segments = relativePathOrBasename.split("/");
    const suffixes: string[] = [];

    // Generate all possible suffix combinations
    for (let i = segments.length - 1; i >= 0; i--) {
      const suffix = segments.slice(i).join("/");
      suffixes.unshift(suffix);

      // Count occurrences of each suffix
      segmentCombinationsMap.set(
        suffix,
        (segmentCombinationsMap.get(suffix) || 0) + 1,
      );
    }

    return { uri, segments, suffixes, relativePathOrBasename };
  });

  // Find shortest unique path for each URI
  return segmentsInfo.map(({ uri, suffixes, relativePathOrBasename }) => {
    // Find the first (shortest) unique suffix
    const uniquePath =
      suffixes.find((suffix) => segmentCombinationsMap.get(suffix) === 1) ??
      relativePathOrBasename; // case where not unique - perhaps basename

    return { uri, uniquePath };
  });
}

// Only used when working with system paths and relative paths
// Since doesn't account for URI segements before workspace
export function getLastNPathParts(filepath: string, n: number): string {
  if (n <= 0) {
    return "";
  }
  return filepath.split(/[\\/]/).slice(-n).join("/");
}
