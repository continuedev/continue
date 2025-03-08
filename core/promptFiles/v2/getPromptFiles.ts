import { IDE } from "../..";
import { walkDir } from "../../indexing/walkDir";
import { readAllGlobalPromptFiles } from "../../util/paths";
import { joinPathsToUri } from "../../util/uri";
import { DEFAULT_PROMPTS_FOLDER_V1 } from "../v1";

export const DEFAULT_PROMPTS_FOLDER_V2 = ".continue/prompts";
export async function getPromptFilesFromDir(
  ide: IDE,
  dir: string,
): Promise<{ path: string; content: string }[]> {
  try {
    const exists = await ide.fileExists(dir);

    if (!exists) {
      return [];
    }

    const uris = await walkDir(dir, ide);
    const promptFilePaths = uris.filter((p) => p.endsWith(".prompt"));
    const results = promptFilePaths.map(async (uri) => {
      const content = await ide.readFile(uri); // make a try catch
      return { path: uri, content };
    });
    return Promise.all(results);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getAllPromptFiles(
  ide: IDE,
  overridePromptFolder?: string,
  checkV1DefaultFolder: boolean = false,
): Promise<{ path: string; content: string }[]> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  let promptFiles: { path: string; content: string }[] = [];

  let dirsToCheck = [DEFAULT_PROMPTS_FOLDER_V2];
  if (checkV1DefaultFolder) {
    dirsToCheck.push(DEFAULT_PROMPTS_FOLDER_V1);
  }
  if (overridePromptFolder) {
    dirsToCheck = [overridePromptFolder];
  }

  const fullDirs = workspaceDirs
    .map((dir) => dirsToCheck.map((d) => joinPathsToUri(dir, d)))
    .flat();

  promptFiles = (
    await Promise.all(fullDirs.map((dir) => getPromptFilesFromDir(ide, dir)))
  ).flat();

  // Also read from ~/.continue/.prompts
  promptFiles.push(...readAllGlobalPromptFiles());

  return await Promise.all(
    promptFiles.map(async (file) => {
      const content = await ide.readFile(file.path);
      return { path: file.path, content };
    }),
  );
}
