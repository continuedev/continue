import { BlockType, ConfigYaml } from "@continuedev/config-yaml";
import * as YAML from "yaml";
import { IDE } from "../..";
import { joinPathsToUri } from "../../util/uri";
import { RULE_FILE_EXTENSION, createRuleMarkdown } from "../markdown";

export function blockTypeToSingular(blockType: BlockType): string {
  switch (blockType) {
    case "context":
      return "context";
    case "models":
      return "model";
    case "rules":
      return "rule";
    case "docs":
      return "doc";
    case "prompts":
      return "prompt";
    case "mcpServers":
      return "MCP server";
    default:
      // Fallback to slice approach for any new block types
      return blockType.slice(0, -1);
  }
}

export function blockTypeToFilename(blockType: BlockType): string {
  switch (blockType) {
    case "context":
      return "context";
    case "models":
      return "model";
    case "rules":
      return "rule";
    case "docs":
      return "doc";
    case "prompts":
      return "prompt";
    case "mcpServers":
      return "mcp-server";
    default:
      // Fallback to slice approach for any new block types
      return blockType.slice(0, -1);
  }
}

function getContentsForNewBlock(blockType: BlockType): ConfigYaml {
  const configYaml: ConfigYaml = {
    name: `New ${blockTypeToSingular(blockType)}`,
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
          model: "claude-3-7-sonnet-latest",
          apiKey: "${{ secrets.ANTHROPIC_API_KEY }}",
          name: "Claude 3.7 Sonnet",
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
  return blockType === "rules" ? RULE_FILE_EXTENSION : "yaml";
}

export function getFileContent(blockType: BlockType): string {
  if (blockType === "rules") {
    return createRuleMarkdown("New Rule", "Your rule content", {
      description: "A description of your rule",
    });
  } else {
    return YAML.stringify(getContentsForNewBlock(blockType));
  }
}

export async function findAvailableFilename(
  baseDirUri: string,
  blockType: BlockType,
  fileExists: (uri: string) => Promise<boolean>,
  extension?: string,
): Promise<string> {
  const baseFilename = `new-${blockTypeToFilename(blockType)}`;
  const fileExtension = extension ?? getFileExtension(blockType);
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
  );

  const fileContent = getFileContent(blockType);

  await ide.writeFile(fileUri, fileContent);
  await ide.openFile(fileUri);
}
