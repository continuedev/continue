import ignore from "ignore";
import { IDE } from "../../..";
import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILETYPES,
} from "../../../indexing/ignore";
import { walkDir } from "../../../indexing/walkDir";
import { getGlobalFolderWithName } from "../../../util/paths";
import { localPathToUri } from "../../../util/pathToUri";
import { joinPathsToUri } from "../../../util/uri";

async function getDefinitionFilesInDir(
  ide: IDE,
  dir: string,
): Promise<{ path: string; content: string }[]> {
  try {
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

/**
 * This method searches in both ~/.continue and workspace .continue
 * for all YAML/Markdown files in the specified subdirectory, for example .continue/assistants or .continue/prompts
 */
export async function getJsonConfigs(
  ide: IDE,
  includeGlobal: boolean,
): Promise<{ path: string; content: string }[]> {
  const dirsToCheck = await ide.getWorkspaceDirs();
  if (includeGlobal) {
    dirsToCheck.push(localPathToUri(getGlobalFolderWithName("mcpServers")));
  }

  const fullDirs = dirsToCheck.map((dir) =>
    joinPathsToUri(dir, ".continue", "mcpServers"),
  );

  const exists = await ide.fileExists(dir);

  const overrideDefaultIgnores = ignore()
    .add(
      DEFAULT_IGNORE_FILETYPES.filter(
        (val) => !["config.json", "settings.json"].includes(val),
      ),
    )
    .add(DEFAULT_IGNORE_DIRS);

  const uris = await walkDir(dir, ide, {
    overrideDefaultIgnores,
    source: "get mcp json files",
  });

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
