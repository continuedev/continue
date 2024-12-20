import { IDE } from "..";
import { joinPathsToUri, pathToUriPathSegment } from "./uri";

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
    const fullUri = joinPathsToUri(dirUri, path);
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
  path: string,
  ide: IDE,
  dirCandidates?: string[],
): Promise<string> {
  const dirs = dirCandidates ?? (await ide.getWorkspaceDirs());
  console.log(path, dirs);
  if (dirs.length === 0) {
    throw new Error("inferResolvedUriFromRelativePath: no dirs provided");
  }
  const segments = pathToUriPathSegment(path).split("/");
  // Generate all possible suffixes from shortest to longest
  const suffixes: string[] = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    suffixes.push(segments.slice(i).join("/"));
  }
  console.log(suffixes);

  // For each suffix, try to find a unique matching directory
  for (const suffix of suffixes) {
    const uris = dirs.map((dir) => ({
      dir,
      partialUri: joinPathsToUri(dir, suffix),
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
      return joinPathsToUri(existingUris[0].dir, segments.join("/"));
    }
  }

  // If no unique match found, use the first directory
  return joinPathsToUri(dirs[0], path);
}

interface ResolveResult {
  resolvedUri: string;
  matchedDir: string;
}
