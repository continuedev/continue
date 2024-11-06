import path from "path";
import { IDE } from "../..";
import { GlobalContext } from "../../util/GlobalContext";
import { DEFAULT_PROMPTS_FOLDER_V2 } from "./getPromptFiles";

const FIRST_TIME_DEFAULT_PROMPT_FILE = `# This is an example ".prompt" file
# It is used to define and reuse prompts within Continue
# Continue will automatically create a context provider for each prompt in the .prompts folder
# To learn more, see the full .prompt file reference: https://docs.continue.dev/features/prompt-files
temperature: 0.0
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
  const promptFilePath = path.join(
    workspaceDirs[0],
    promptPath ?? DEFAULT_PROMPTS_FOLDER_V2,
    "new-prompt-file.prompt",
  );

  const PROMPT_FILE =
    new GlobalContext().get("hasAlreadyCreatedAPromptFile") === true
      ? DEFAULT_PROMPT_FILE
      : FIRST_TIME_DEFAULT_PROMPT_FILE;

  await ide.writeFile(promptFilePath, PROMPT_FILE);
  await ide.openFile(promptFilePath);
}
