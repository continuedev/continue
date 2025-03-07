import ignore from "ignore";
import type { FileType, IDE } from "../";
import { findUriInDirs, getUriPathBasename } from "../util/uri";
import { defaultIgnoreFileAndDir, getGlobalContinueIgArray } from "./ignore";
import { getIgnoreContext } from "./walkDir";

/*
    Process:
    1. Check global/default ignores
    2. Walk UP tree from file, checking ignores at each level

    TODO there might be issues with symlinks here
*/
export async function shouldIgnore(
  fileUri: string,
  ide: IDE,
  rootDirCandidates?: string[],
): Promise<boolean> {
  const rootDirUris = rootDirCandidates ?? (await ide.getWorkspaceDirs());
  const { foundInDir: rootDir, uri } = findUriInDirs(fileUri, rootDirUris);

  if (!rootDir) {
    return true;
  }

  const defaultAndGlobalIgnores = ignore()
    .add(defaultIgnoreFileAndDir)
    .add(getGlobalContinueIgArray());

  let currentDir = uri;
  let directParent = true;
  let fileType = 1 as FileType.File as FileType;
  while (currentDir !== rootDir) {
    // Go to parent dir of file
    const splitUri = currentDir.split("/");
    splitUri.pop();
    currentDir = splitUri.join("/");

    // Get all files in the dir
    const dirEntries = await ide.listDir(currentDir);

    // Check if the file is a symbolic link, ignore if so
    if (directParent) {
      directParent = false;
      const baseName = getUriPathBasename(fileUri);
      const entry = dirEntries.find(([name, _]) => name === baseName);
      if (entry) {
        fileType = entry[1];
        if (fileType === (64 as FileType.SymbolicLink)) {
          return true;
        }
      }
    }

    const ignoreContext = await getIgnoreContext(
      currentDir,
      dirEntries,
      ide,
      defaultAndGlobalIgnores,
    );

    let relativePath = uri.substring(currentDir.length + 1);
    if (fileType === (2 as FileType.Directory)) {
      relativePath += "/";
    }

    if (ignoreContext.ignores(relativePath)) {
      return true;
    }
  }

  return false;
}
