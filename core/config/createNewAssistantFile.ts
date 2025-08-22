import { IDE } from "..";
import { joinPathsToUri } from "../util/uri";

const DEFAULT_ASSISTANT_FILE = `# This is an example assistant configuration file
# It is used to define custom AI assistants within Continue
# Each assistant file can be accessed by selecting it from the assistant dropdown

# To learn more, see the full assistant reference: https://docs.continue.dev/reference

name: Example Assistant
version: 1.0.0
schema: v1

# Models define which AI models this assistant can use
models:
  - name: my gpt-5
    provider: openai
    model: gpt-5
    apiKey: YOUR_API_KEY_HERE

# Context providers define what information the assistant can access
context:
  - provider: code
  - provider: docs
  - provider: diff
  - provider: terminal
  - provider: problems
  - provider: folder
  - provider: codebase
`;

export async function createNewAssistantFile(
  ide: IDE,
  assistantPath: string | undefined,
): Promise<void> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  if (workspaceDirs.length === 0) {
    throw new Error(
      "No workspace directories found. Make sure you've opened a folder in your IDE.",
    );
  }

  const baseDirUri = joinPathsToUri(
    workspaceDirs[0],
    assistantPath ?? ".continue/assistants",
  );

  // Find the first available filename
  let counter = 0;
  let assistantFileUri: string;
  do {
    const suffix = counter === 0 ? "" : `-${counter}`;
    assistantFileUri = joinPathsToUri(
      baseDirUri,
      `new-assistant${suffix}.yaml`,
    );
    counter++;
  } while (await ide.fileExists(assistantFileUri));

  await ide.writeFile(assistantFileUri, DEFAULT_ASSISTANT_FILE);
  await ide.openFile(assistantFileUri);
}
