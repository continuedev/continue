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

export const ASSISTANTS = "assistants";
export const ASSISTANTS_FOLDER = `.continue/${ASSISTANTS}`;

export function isLocalAssistantFile(uri: string): boolean {
  if (!uri.endsWith(".yaml") && !uri.endsWith(".yml")) {
    return false;
  }

  const normalizedUri = uri.replace(/\\/g, "/");
  return normalizedUri.includes(`/${ASSISTANTS_FOLDER}/`);
}

export async function listYamlFilesInDir(
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

export interface LoadAssistantFilesOptions {
  includeGlobal: boolean;
  includeWorkspace: boolean;
}

export function getDotContinueSubDirs(
  ide: IDE,
  options: LoadAssistantFilesOptions,
  workspaceDirs: string[],
  subDirName: string,
): string[] {
  let fullDirs: string[] = [];

  // Workspace .continue/assistants
  if (options.includeWorkspace) {
    fullDirs = workspaceDirs.map((dir) =>
      joinPathsToUri(dir, ".continue", subDirName),
    );
  }

  // ~/.continue/assistants
  if (options.includeGlobal) {
    fullDirs.push(localPathToUri(getGlobalAssistantsPath()));
  }

  return fullDirs;
}

/**
 * This method searches in both ~/.continue and workspace .continue
 * for all YAML files in the specified subdirctory, for example .continue/assistants or .continue/prompts
 */
export async function getAllDotContinueYamlFiles(
  ide: IDE,
  options: LoadAssistantFilesOptions,
  subDirName: string,
): Promise<{ path: string; content: string }[]> {
  const workspaceDirs = await ide.getWorkspaceDirs();

  // Get all directories to check for assistant files
  const fullDirs = getDotContinueSubDirs(
    ide,
    options,
    workspaceDirs,
    subDirName,
  );

  // Get all assistant files from the directories
  const assistantFiles = (
    await Promise.all(fullDirs.map((dir) => listYamlFilesInDir(ide, dir)))
  ).flat();

  return await Promise.all(
    assistantFiles.map(async (file) => {
      const content = await ide.readFile(file.path);
      return { path: file.path, content };
    }),
  );
}
