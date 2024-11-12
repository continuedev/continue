import path from "path";

import { IDE } from "../..";
import { GlobalContext } from "../../util/GlobalContext";

import { DEFAULT_PROMPTS_FOLDER_V2 } from "./getPromptFiles";

const FIRST_TIME_DEFAULT_PROMPT_FILE = `# This is an example ".prompt" file
# It is used to define and reuse prompts within Continue
# Continue will automatically create a context provider for each prompt in the .prompts folder

# A prompt file consists of two parts:
# 1. Everything above the "---" is YAML. Here you can set "temperature", "description", and other options
# 2. Everything below the "---" is the prompt body

# If you don't want to set any options, you don't need to include the "---"

# In the body, you can reference:
# 1. Files, using either absolute or relative (based on the workspace root) paths
  # e.g. @README.md
  # e.g. @src/test/test.py
  # e.g. @/Users/me/Desktop/my-project/src/test/test.py
# 2. URLs
  # e.g. https://example.com
# 3. Some context providers, like
  # e.g. @currentFile
  # e.g. @os
  # e.g. @repo-map

# To learn more, see the full .prompt file reference: https://docs.continue.dev/features/prompt-files
name: Example
description: Example prompt file
version: 2
---
@README.md

Please reference the above README.md file to understand the current project.
`;

const DEFAULT_PROMPT_FILE = `version: 2
---

`;

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
  const baseDir = path.join(
    workspaceDirs[0],
    promptPath ?? DEFAULT_PROMPTS_FOLDER_V2,
  );

  // Find the first available filename
  let counter = 0;
  let promptFilePath: string;
  do {
    const suffix = counter === 0 ? "" : `-${counter}`;
    promptFilePath = path.join(baseDir, `new-prompt-file${suffix}.prompt`);
    counter++;
  } while (await ide.fileExists(promptFilePath));

  const PROMPT_FILE =
    new GlobalContext().get("hasAlreadyCreatedAPromptFile") === true
      ? DEFAULT_PROMPT_FILE
      : FIRST_TIME_DEFAULT_PROMPT_FILE;

  await ide.writeFile(promptFilePath, PROMPT_FILE);
  await ide.openFile(promptFilePath);
}
