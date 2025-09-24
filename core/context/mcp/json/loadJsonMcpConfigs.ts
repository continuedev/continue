import {
  ConfigValidationError,
  convertJsonMcpConfigToYamlMcpConfig,
  McpJsonConfig,
  mcpServerConfigFileSchema,
  mcpServersJsonSchema,
} from "@continuedev/config-yaml";
import * as JSONC from "comment-json";
import ignore from "ignore";
import { IDE, InternalMcpOptions } from "../../..";
import { convertYamlMcpConfigToInternalMcpOptions } from "../../../config/yaml/yamlToContinueConfig";
import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILETYPES,
} from "../../../indexing/ignore";
import { walkDir } from "../../../indexing/walkDir";
import { getGlobalFolderWithName } from "../../../util/paths";
import { localPathToUri } from "../../../util/pathToUri";
import { getUriPathBasename, joinPathsToUri } from "../../../util/uri";

/**
 * This method searches in both ~/.continue and workspace .continue
 * for all YAML/Markdown files in the specified subdirectory, for example .continue/assistants or .continue/prompts
 */
export async function loadJsonMcpConfigs(
  ide: IDE,
  includeGlobal: boolean,
): Promise<{
  mcpServers: InternalMcpOptions[];
  errors: ConfigValidationError[];
}> {
  const errors: ConfigValidationError[] = [];

  // Get dirs
  const workspaceDirs = await ide.getWorkspaceDirs();
  const mcpDirs = workspaceDirs.map((dir) =>
    joinPathsToUri(dir, ".continue", "mcpServers"),
  );
  if (includeGlobal) {
    mcpDirs.push(localPathToUri(getGlobalFolderWithName("mcpServers")));
  }

  // Get json files and their contents
  const overrideDefaultIgnores = ignore()
    .add(
      DEFAULT_IGNORE_FILETYPES.filter(
        (val) => !["config.json", "settings.json"].includes(val),
      ),
    )
    .add(DEFAULT_IGNORE_DIRS);

  const jsonFiles: { uri: string; content: string }[] = [];

  await Promise.all(
    mcpDirs.map(async (dir) => {
      const exists = await ide.fileExists(dir);
      if (!exists) {
        return;
      }
      try {
        const uris = await walkDir(dir, ide, {
          overrideDefaultIgnores,
          source: "get mcp json files",
        });
        const jsonUris = uris.filter((uri) => uri.endsWith(".json"));
        await Promise.all(
          jsonUris.map(async (uri) => {
            try {
              const content = await ide.readFile(uri);
              jsonFiles.push({ uri, content });
            } catch (e) {
              errors.push({
                fatal: false,
                message: `Failed to read MCP server JSON file at ${uri}: ${e instanceof Error ? e.message : String(e)}`,
              });
            }
          }),
        );
      } catch (e) {
        errors.push({
          fatal: false,
          message: `Failed to check for MCP JSON files in ${dir}: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }),
  );

  const validJsonConfigs: { name: string; mcpJson: McpJsonConfig }[] = [];
  for (const file of jsonFiles) {
    try {
      const json = JSONC.parse(file.content);
      const claudeFileParsed = mcpServerConfigFileSchema.safeParse(json);

      // Try parsing as a file with mcpServers and multiple servers (claude-esque format)
      if (claudeFileParsed.success) {
        validJsonConfigs.push(
          ...Object.entries(claudeFileParsed.data.mcpServers).map(
            ([name, mcpJson]) => ({
              name,
              mcpJson,
            }),
          ),
        );
        claudeFileParsed.data;
      } else {
        // Try parsing as single JSON file
        const singleConfigParsed = mcpServersJsonSchema.safeParse(json);
        if (singleConfigParsed.success) {
          validJsonConfigs.push({
            mcpJson: singleConfigParsed.data,
            name: getUriPathBasename(file.uri).replace(".json", ""),
          });
        } else {
          errors.push({
            fatal: false,
            message: `MCP JSON file at ${file.uri} doesn't match a supported MCP JSON configuration format`,
          });
        }
      }
    } catch (e) {
      errors.push({
        fatal: false,
        message: `Error parsing MCP JSON file at ${file.uri}: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // Two levels of conversion for now.
  const yamlConfigs = validJsonConfigs.map((c) =>
    convertJsonMcpConfigToYamlMcpConfig(c.name, c.mcpJson),
  );
  const mcpServers = yamlConfigs.map((c) =>
    convertYamlMcpConfigToInternalMcpOptions(c.yamlConfig),
  );
  // Parse and convert files
  return {
    mcpServers,
    errors,
  };
}
