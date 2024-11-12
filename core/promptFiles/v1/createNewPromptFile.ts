import path from "path";

import { IDE } from "../..";

import { DEFAULT_PROMPTS_FOLDER } from ".";

const DEFAULT_PROMPT_FILE = `# This is an example ".prompt" file
# It is used to define and reuse prompts within Continue
# Continue will automatically create a slash command for each prompt in the .prompts folder
# To learn more, see the full .prompt file reference: https://docs.continue.dev/features/prompt-files
temperature: 0.0
---
{{{ diff }}}

Give me feedback on the above changes. For each file, you should output a markdown section including the following:
- If you found any problems, an h3 like "❌ <filename>"
- If you didn't find any problems, an h3 like "✅ <filename>"
- If you found any problems, add below a bullet point description of what you found, including a minimal code snippet explaining how to fix it
- If you didn't find any problems, you don't need to add anything else

Here is an example. The example is surrounded in backticks, but your response should not be:

\`\`\`
### ✅ <Filename1>

### ❌ <Filename2>

<Description>
\`\`\`

You should look primarily for the following types of issues, and only mention other problems if they are highly pressing.

- console.logs that have been left after debugging
- repeated code
- algorithmic errors that could fail under edge cases
- something that could be refactored

Make sure to review ALL files that were changed, do not skip any.
`;

export async function createNewPromptFile(
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
    promptPath ?? DEFAULT_PROMPTS_FOLDER,
    "new-prompt-file.prompt",
  );

  await ide.writeFile(promptFilePath, DEFAULT_PROMPT_FILE);
  await ide.openFile(promptFilePath);
}
