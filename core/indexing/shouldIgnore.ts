import ignore from "ignore";
import type { FileType, IDE } from "../";
import { findUriInDirs } from "../util/uri";
import {
  DEFAULT_IGNORE,
  getGlobalContinueIgArray,
  gitIgArrayFromFile,
} from "./ignore";

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
  const {
    foundInDir: rootDir,
    uri,
    relativePathOrBasename,
  } = findUriInDirs(fileUri, rootDirUris);
  if (!rootDir) {
    throw new Error("Should ignore: file uri not found in root dirs");
  }

  // Global/default ignores
  const globalPatterns = getGlobalContinueIgArray();
  const rootIgnoreContext = ignore().add(globalPatterns).add(DEFAULT_IGNORE);
  if (rootIgnoreContext.ignores(relativePathOrBasename)) {
    return true;
  }

  let currentDir = uri;
  while (currentDir !== rootDir) {
    // Go to parent dir of file
    const splitUri = currentDir.split("/");
    splitUri.pop();
    currentDir = splitUri.join("/");

    // Get all files in the dir
    const dirEntries = await ide.listDir(currentDir);
    const dirFiles = dirEntries
      .filter(([_, entryType]) => entryType === (1 as FileType.File))
      .map(([name, _]) => name);

    // Find ignore files and get ignore arrays from their contexts
    const gitIgnoreFile = dirFiles.find((name) => name === ".gitignore");
    const continueIgnoreFile = dirFiles.find(
      (name) => name === ".continueignore",
    );

    const getGitIgnorePatterns = async () => {
      if (gitIgnoreFile) {
        const contents = await ide.readFile(`${currentDir}/.gitignore`);
        return gitIgArrayFromFile(contents);
      }
      return [];
    };
    const getContinueIgnorePatterns = async () => {
      if (continueIgnoreFile) {
        const contents = await ide.readFile(`${currentDir}/.continueignore`);
        return gitIgArrayFromFile(contents);
      }
      return [];
    };

    const ignoreArrays = await Promise.all([
      getGitIgnorePatterns(),
      getContinueIgnorePatterns(),
    ]);
    const ignoreContext = ignore().add(ignoreArrays[0]).add(ignoreArrays[1]);

    const relativePath = uri.substring(currentDir.length + 1);
    if (ignoreContext.ignores(relativePath)) {
      return true;
    }
  }

  return false;
}
