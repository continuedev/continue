import { BLOCK_TYPES } from "@continuedev/config-yaml";
import ignore from "ignore";
import * as URI from "uri-js";
import { IDE } from "..";
import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILETYPES,
} from "../indexing/ignore";
import { walkDir } from "../indexing/walkDir";
import { RULES_MARKDOWN_FILENAME } from "../llm/rules/constants";
import { getGlobalFolderWithName } from "../util/paths";
import { localPathToUri } from "../util/pathToUri";
import { getUriPathBasename, joinPathsToUri } from "../util/uri";
import { SYSTEM_PROMPT_DOT_FILE } from "./getWorkspaceContinueRuleDotFiles";
import { SUPPORTED_AGENT_FILES } from "./markdown";
export function isContinueConfigRelatedUri(uri: string): boolean {
  return (
    uri.endsWith(".continuerc.json") ||
    uri.endsWith(".prompt") ||
    !!SUPPORTED_AGENT_FILES.find((file) => uri.endsWith(`/${file}`)) ||
    uri.endsWith(SYSTEM_PROMPT_DOT_FILE) ||
    (uri.includes(".continue") &&
      (uri.endsWith(".yaml") ||
        uri.endsWith(".yml") ||
        uri.endsWith(".json"))) ||
    [...BLOCK_TYPES, "agents", "assistants"].some((blockType) =>
      uri.includes(`.continue/${blockType}`),
    )
  );
}

export function isContinueAgentConfigFile(uri: string): boolean {
  const isYaml = uri.endsWith(".yaml") || uri.endsWith(".yml");
  if (!isYaml) {
    return false;
  }

  const normalizedUri = URI.normalize(uri);
  return (
    normalizedUri.includes(`/.continue/agents/`) ||
    normalizedUri.includes(`/.continue/assistants/`)
  );
}

export function isColocatedRulesFile(uri: string): boolean {
  return getUriPathBasename(uri) === RULES_MARKDOWN_FILENAME;
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
      .add(
        DEFAULT_IGNORE_FILETYPES.filter(
          (t) => t !== "config.yaml" && t !== "config.yml",
        ),
      )
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
