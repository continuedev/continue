import { IDE } from "..";
import { joinPathsToUri } from "../util/uri";

const DEFAULT_ASSISTANT_FILE = `# This is an example configuration file
# To learn more, see the full config.yaml reference: https://docs.continue.dev/reference

name: Example Config
version: 1.0.0
schema: v1

# Define which models can be used
# https://docs.continue.dev/customization/models
models:
  - name: my gpt-5
    provider: openai
    model: gpt-5
    apiKey: YOUR_OPENAI_API_KEY_HERE
  - uses: ollama/qwen2.5-coder-7b
  - uses: anthropic/claude-4-sonnet
    with:
      ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}

# MCP Servers that Continue can access
# https://docs.continue.dev/customization/mcp-tools
mcpServers:
  - uses: anthropic/memory-mcp
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
    assistantPath ?? ".continue/agents",
  );

  // Find the first available filename
  let counter = 0;
  let assistantFileUri: string;
  do {
    const suffix = counter === 0 ? "" : `-${counter}`;
    assistantFileUri = joinPathsToUri(baseDirUri, `new-config${suffix}.yaml`);
    counter++;
  } while (await ide.fileExists(assistantFileUri));

  await ide.writeFile(assistantFileUri, DEFAULT_ASSISTANT_FILE);
  await ide.openFile(assistantFileUri);
}
