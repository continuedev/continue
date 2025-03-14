import ignore from "ignore";
import { IDE } from "..";
import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILETYPES,
} from "../indexing/ignore";
import { walkDir } from "../indexing/walkDir";
import { getGlobalAssistantsPath } from "../util/paths";
import { localPathToUri } from "../util/pathToUri";
import { joinPathsToUri } from "../util/uri";

export const ASSISTANTS_FOLDER = ".continue/assistants";

export function isLocalAssistantFile(uri: string): boolean {
  if (!uri.endsWith(".yaml") && !uri.endsWith(".yml")) {
    return false;
  }

  const normalizedUri = uri.replace(/\\/g, "/");
  return normalizedUri.includes(`/${ASSISTANTS_FOLDER}/`);
}

export async function getAssistantFilesFromDir(
  ide: IDE,
  dir: string,
): Promise<{ path: string; content: string }[]> {
  try {
    const exists = await ide.fileExists(dir);

    if (!exists) {
      return [];
    }

    const overrideDefaultIgnores = ignore()
      .add(DEFAULT_IGNORE_FILETYPES.filter((t) => t !== "config.yaml"))
      .add(DEFAULT_IGNORE_DIRS);

    const uris = await walkDir(dir, ide, {
      overrideDefaultIgnores,
      source: "get assistant files",
    });
    const assistantFilePaths = uris.filter(
      (p) => p.endsWith(".yaml") || p.endsWith(".yml"),
    );
    const results = assistantFilePaths.map(async (uri) => {
      const content = await ide.readFile(uri); // make a try catch
      return { path: uri, content };
    });
    return Promise.all(results);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getAllAssistantFiles(
  ide: IDE,
): Promise<{ path: string; content: string }[]> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  let assistantFiles: { path: string; content: string }[] = [];

  let dirsToCheck = [ASSISTANTS_FOLDER];
  const fullDirs = workspaceDirs
    .map((dir) => dirsToCheck.map((d) => joinPathsToUri(dir, d)))
    .flat();

  fullDirs.push(localPathToUri(getGlobalAssistantsPath()));

  assistantFiles = (
    await Promise.all(fullDirs.map((dir) => getAssistantFilesFromDir(ide, dir)))
  ).flat();

  return await Promise.all(
    assistantFiles.map(async (file) => {
      const content = await ide.readFile(file.path);
      return { path: file.path, content };
    }),
  );
}
