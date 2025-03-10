import { IDE } from "..";
import { walkDir } from "../indexing/walkDir";
import { getGlobalAssistantsPath } from "../util/paths";
import { localPathToUri } from "../util/pathToUri";
import { joinPathsToUri } from "../util/uri";
export const SYSTEM_PROMPT_DOT_FILE = ".continuerules";

export async function getSystemPromptDotFile(ide: IDE): Promise<string | null> {
  const dirs = await ide.getWorkspaceDirs();

  let prompts: string[] = [];
  for (const dir of dirs) {
    const dotFile = joinPathsToUri(dir, SYSTEM_PROMPT_DOT_FILE);
    if (await ide.fileExists(dotFile)) {
      try {
        const content = await ide.readFile(dotFile);
        prompts.push(content);
      } catch (e) {
        // ignore if file doesn't exist
      }
    }
  }

  if (!prompts.length) {
    return null;
  }

  return prompts.join("\n\n");
}

export const ASSISTANTS_FOLDER = ".continue/assistants";

export async function getAssistantFilesFromDir(
  ide: IDE,
  dir: string,
): Promise<{ path: string; content: string }[]> {
  try {
    const exists = await ide.fileExists(localPathToUri(dir));

    if (!exists) {
      return [];
    }

    const uris = await walkDir(dir, ide);
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

  fullDirs.push(getGlobalAssistantsPath());

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
