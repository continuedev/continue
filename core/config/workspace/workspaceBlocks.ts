import {
  BlockType,
  ConfigYaml,
  createPromptMarkdown,
  createRuleMarkdown,
  sanitizeRuleName,
} from "@continuedev/config-yaml";
import * as YAML from "yaml";
import { IDE } from "../..";
import { getContinueGlobalPath } from "../../util/paths";
import { localPathToUri } from "../../util/pathToUri";
import { joinPathsToUri } from "../../util/uri";

const BLOCK_TYPE_CONFIG: Record<
  BlockType,
  { singular: string; filename: string }
> = {
  context: { singular: "context", filename: "context" },
  models: { singular: "model", filename: "model" },
  rules: { singular: "rule", filename: "rule" },
  docs: { singular: "doc", filename: "doc" },
  prompts: { singular: "prompt", filename: "prompt" },
  mcpServers: { singular: "MCP server", filename: "mcp-server" },
  data: { singular: "data", filename: "data" },
};

function getContentsForNewBlock(blockType: BlockType): ConfigYaml {
  const configYaml: ConfigYaml = {
    name: `New ${BLOCK_TYPE_CONFIG[blockType]?.singular}`,
    version: "0.0.1",
    schema: "v1",
  };
  switch (blockType) {
    case "context":
      configYaml.context = [
        {
          provider: "file",
        },
      ];
      break;
    case "models":
      configYaml.models = [
        {
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          apiKey: "${{ secrets.ANTHROPIC_API_KEY }}",
          name: "Claude Sonnet 4.5",
          roles: ["chat", "edit"],
        },
      ];
      break;
    case "rules":
      configYaml.rules = ["Always give concise responses"];
      break;
    case "docs":
      configYaml.docs = [
        {
          name: "New docs",
          startUrl: "https://docs.continue.dev",
        },
      ];
      break;
    case "prompts":
      configYaml.prompts = [
        {
          name: "New prompt",
          description: "New prompt",
          prompt:
            "Please write a thorough suite of unit tests for this code, making sure to cover all relevant edge cases",
        },
      ];
      break;
    case "mcpServers":
      configYaml.mcpServers = [
        {
          name: "New MCP server",
          command: "npx",
          args: ["-y", "<your-mcp-server>"],
          env: {},
        },
      ];
      break;
  }

  return configYaml;
}

function getFileExtension(blockType: BlockType): string {
  if (blockType === "rules" || blockType === "prompts") {
    return "md";
  }
  return "yaml";
}

export function getFileContent(blockType: BlockType): string {
  if (blockType === "rules") {
    return createRuleMarkdown("New Rule", "Your rule content", {
      description: "A description of your rule",
    });
  } else if (blockType === "prompts") {
    return createPromptMarkdown(
      "New prompt",
      "Please write a thorough suite of unit tests for this code, making sure to cover all relevant edge cases",
      {
        description: "New prompt",
        invokable: true,
      },
    );
  } else {
    return YAML.stringify(getContentsForNewBlock(blockType));
  }
}

export async function findAvailableFilename(
  baseDirUri: string,
  blockType: BlockType,
  fileExists: (uri: string) => Promise<boolean>,
  extension?: string,
  isGlobal?: boolean,
  baseFilenameOverride?: string,
): Promise<string> {
  const fileExtension = extension ?? getFileExtension(blockType);
  let baseFilename = "";

  const trimmedOverride = baseFilenameOverride?.trim();
  if (trimmedOverride) {
    if (blockType === "rules") {
      const withoutExtension = trimmedOverride.replace(/\.[^./\\]+$/, "");
      const sanitized = sanitizeRuleName(withoutExtension);
      baseFilename = sanitized;
    } else {
      baseFilename = trimmedOverride;
    }
  }
  if (!baseFilename) {
    baseFilename =
      blockType === "rules" && isGlobal
        ? "global-rule"
        : `new-${BLOCK_TYPE_CONFIG[blockType]?.filename}`;
  }

  let counter = 0;
  let fileUri: string;

  do {
    const suffix = counter === 0 ? "" : `-${counter}`;
    fileUri = joinPathsToUri(
      baseDirUri,
      `${baseFilename}${suffix}.${fileExtension}`,
    );
    counter++;
  } while (await fileExists(fileUri));

  return fileUri;
}

export async function createNewWorkspaceBlockFile(
  ide: IDE,
  blockType: BlockType,
  baseFilename?: string,
): Promise<void> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  if (workspaceDirs.length === 0) {
    throw new Error(
      "No workspace directories found. Make sure you've opened a folder in your IDE.",
    );
  }

  const baseDirUri = joinPathsToUri(workspaceDirs[0], `.continue/${blockType}`);

  const fileUri = await findAvailableFilename(
    baseDirUri,
    blockType,
    ide.fileExists.bind(ide),
    undefined,
    false,
    baseFilename,
  );

  const fileContent = getFileContent(blockType);

  await ide.writeFile(fileUri, fileContent);
  await ide.openFile(fileUri);
}

export async function createNewGlobalRuleFile(
  ide: IDE,
  baseFilename?: string,
): Promise<void> {
  try {
    const globalDir = localPathToUri(getContinueGlobalPath());

    // Create the rules subdirectory within the global directory
    const rulesDir = joinPathsToUri(globalDir, "rules");

    const fileUri = await findAvailableFilename(
      rulesDir,
      "rules",
      ide.fileExists.bind(ide),
      undefined,
      true, // isGlobal = true for global rules
      baseFilename,
    );

    const fileContent = getFileContent("rules");

    await ide.writeFile(fileUri, fileContent);

    await ide.openFile(fileUri);
  } catch (error) {
    throw error;
  }
}
