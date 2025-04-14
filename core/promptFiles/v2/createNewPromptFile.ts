import { BlockType, ConfigYaml } from "@continuedev/config-yaml";
import * as YAML from "yaml";
import { IDE } from "../..";
import { GlobalContext } from "../../util/GlobalContext";
import { joinPathsToUri } from "../../util/uri";

const FIRST_TIME_DEFAULT_PROMPT_FILE = `# This is an example ".prompt" file
# It is used to define and reuse prompts within Continue
# Each .prompt file can be accessed by typing "@prompts" in the Chat input

# A prompt file consists of two parts:
# 1. Everything above the "---" is YAML. Here you can set "temperature", "description", and other options
# 2. Everything below the "---" is the prompt body

# If you do not want to set any options, you do not need to include the "---"

# In the body, you can reference:
# 1. Files, using either absolute or relative paths (based on the workspace root)
  # @README.md
  # @src/test/test.py
  # @/Users/me/Desktop/my-project/src/test/test.py
# 2. URLs, for example
  # @https://example.com
# 3. Context providers, for example
  # @currentFile
  # @os
  # @repo-map

# To learn more, see the full .prompt file reference: https://docs.continue.dev/features/prompt-files
name: Example
description: Example prompt file
---

Here is information about the current repo:

@README.md`;

const DEFAULT_PROMPT_FILE = "";

export async function createNewPromptFileV2(
  ide: IDE,
  promptPath: string | undefined,
): Promise<void> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  if (workspaceDirs.length === 0) {
    throw new Error(
      "No workspace directories found. Make sure you've opened a folder in your IDE.",
    );
  }

  const baseDirUri = joinPathsToUri(
    workspaceDirs[0],
    promptPath ?? ".continue/prompts",
  );

  // Find the first available filename
  let counter = 0;
  let promptFileUri: string;
  do {
    const suffix = counter === 0 ? "" : `-${counter}`;
    promptFileUri = joinPathsToUri(
      baseDirUri,
      `new-prompt-file${suffix}.prompt`,
    );
    counter++;
  } while (await ide.fileExists(promptFileUri));

  const globalContext = new GlobalContext();
  const PROMPT_FILE =
    globalContext.get("hasAlreadyCreatedAPromptFile") === true
      ? DEFAULT_PROMPT_FILE
      : FIRST_TIME_DEFAULT_PROMPT_FILE;

  globalContext.update("hasAlreadyCreatedAPromptFile", true);

  await ide.writeFile(promptFileUri, PROMPT_FILE);
  await ide.openFile(promptFileUri);
}

function getContentsForNewBlock(blockType: BlockType): ConfigYaml {
  const configYaml: ConfigYaml = {
    name: `New ${blockType}`,
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
    fileUri = joinPathsToUri(baseDirUri, `new-${blockType}${suffix}.yaml`);
    counter++;
  } while (await ide.fileExists(fileUri));

  await ide.writeFile(
    fileUri,
    YAML.stringify(getContentsForNewBlock(blockType)),
  );
  await ide.openFile(fileUri);
}
