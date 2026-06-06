import { IDE } from "..";

import {
  findUriInDirs,
  joinEncodedUriPathSegmentToUri,
  joinPathsToUri,
  pathToUriPathSegment,
} from "./uri";

async function getWorkspaceDirsPrioritizedByCurrentFile(
  ide: IDE,
  dirs: string[],
): Promise<string[]> {
  const activeFile = await getCurrentFileIfSupported(ide);
  if (!activeFile) {
    return dirs;
  }

  const { foundInDir } = findUriInDirs(activeFile.path, dirs);
  if (!foundInDir) {
    return dirs;
  }

  return [foundInDir, ...dirs.filter((dir) => dir !== foundInDir)];
}

async function getCurrentFileIfSupported(ide: IDE) {
  const getCurrentFile = (ide as Partial<Pick<IDE, "getCurrentFile">>)
    .getCurrentFile;
  if (typeof getCurrentFile !== "function") {
    return undefined;
  }

  return getCurrentFile.call(ide);
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
  const dirs = await getWorkspaceDirsPrioritizedByCurrentFile(
    ide,
    dirUriCandidates ?? (await ide.getWorkspaceDirs()),
  );
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
  _relativePath: string,
  ide: IDE,
  dirCandidates?: string[],
): Promise<string> {
  const relativePath = _relativePath.trim().replaceAll("\\", "/");
  const dirs = await getWorkspaceDirsPrioritizedByCurrentFile(
    ide,
    dirCandidates ?? (await ide.getWorkspaceDirs()),
  );

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
  const activeFile = await getCurrentFileIfSupported(ide);
  if (activeFile && activeFile.path.endsWith(relativePath)) {
    return activeFile.path;
  }

  // If no unique match found, prefer the current file's workspace before falling back.
  return joinPathsToUri(dirs[0], relativePath);
}
