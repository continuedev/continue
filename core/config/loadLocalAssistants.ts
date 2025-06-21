import ignore from "ignore";
import * as URI from "uri-js";
import { IDE } from "..";
import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILETYPES,
} from "../indexing/ignore";
import { walkDir } from "../indexing/walkDir";
import { getGlobalFolderWithName } from "../util/paths";
import { localPathToUri } from "../util/pathToUri";
import { joinPathsToUri } from "../util/uri";

export const ASSISTANTS = "assistants";
export const ASSISTANTS_FOLDER = `.continue/${ASSISTANTS}`;

export function isLocalDefinitionFile(uri: string): boolean {
  if (!uri.endsWith(".yaml") && !uri.endsWith(".yml") && !uri.endsWith(".md")) {
    return false;
  }

  const normalizedUri = URI.normalize(uri);
  return normalizedUri.includes(`/${ASSISTANTS_FOLDER}/`);
}

async function getDefinitionFilesInDir(
  ide: IDE,
  dir: string,
  fileExtType?: "yaml" | "markdown",
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
    let assistantFilePaths: string[];
    if (fileExtType === "yaml") {
      assistantFilePaths = uris.filter(
        (p) => p.endsWith(".yaml") || p.endsWith(".yml"),
      );
    } else if (fileExtType === "markdown") {
      assistantFilePaths = uris.filter((p) => p.endsWith(".md"));
    } else {
      assistantFilePaths = uris.filter(
        (p) => p.endsWith(".yaml") || p.endsWith(".yml") || p.endsWith(".md"),
      );
    }

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
  fileExtType?: "yaml" | "markdown";
}

export function getDotContinueSubDirs(
  ide: IDE,
  options: LoadAssistantFilesOptions,
  workspaceDirs: string[],
  subDirName: string,
): string[] {
  let fullDirs: string[] = [];

  // Workspace .continue/<subDirName>
  if (options.includeWorkspace) {
    fullDirs = workspaceDirs.map((dir) =>
      joinPathsToUri(dir, ".continue", subDirName),
    );
  }

  // ~/.continue/<subDirName>
  if (options.includeGlobal) {
    fullDirs.push(localPathToUri(getGlobalFolderWithName(subDirName)));
  }

  return fullDirs;
}

/**
 * This method searches in both ~/.continue and workspace .continue
 * for all YAML/Markdown files in the specified subdirectory, for example .continue/assistants or .continue/prompts
 */
export async function getAllDotContinueDefinitionFiles(
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

  // Get all definition files from the directories
  const definitionFiles = (
    await Promise.all(
      fullDirs.map((dir) =>
        getDefinitionFilesInDir(ide, dir, options.fileExtType),
      ),
    )
  ).flat();

  return definitionFiles;
}
