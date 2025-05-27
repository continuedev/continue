import { BlockType, ConfigYaml } from "@continuedev/config-yaml";
import * as YAML from "yaml";
import { IDE } from "../..";
import { joinPathsToUri } from "../../util/uri";

function getContentsForNewBlock(blockType: BlockType): ConfigYaml {
  const configYaml: ConfigYaml = {
    name: `New ${blockType.slice(0, -1)}`,
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

  // Find the first available filename
  let counter = 0;
  let fileUri: string;
  do {
    const suffix = counter === 0 ? "" : `-${counter}`;
    fileUri = joinPathsToUri(
      baseDirUri,
      `new-${blockType.slice(0, -1)}${suffix}.yaml`,
    );
    counter++;
  } while (await ide.fileExists(fileUri));

  await ide.writeFile(
    fileUri,
    YAML.stringify(getContentsForNewBlock(blockType)),
  );
  await ide.openFile(fileUri);
}
