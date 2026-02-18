import { SlashCommandDescWithSource } from "core";
import { SUPPORTED_PROMPT_CONTEXT_PROVIDERS } from "core/promptFiles";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { GetContextRequest } from "./types";

export async function getPromptV2ContextRequests(
  ideMessenger: IIdeMessenger,
  command: SlashCommandDescWithSource,
): Promise<GetContextRequest[]> {
  if (!command.prompt) {
    return [];
  }
  const workspaceDirs = await ideMessenger.ide.getWorkspaceDirs();
  const visitedFiles = new Set<string>();
  if (command.sourceFile) {
    visitedFiles.add(command.sourceFile);
  }

  const contextRequests: GetContextRequest[] = [];

  async function addContextRequestsRecursive(promptBody: string) {
    // Files
    const templateMatches = promptBody.matchAll(/@([^\s]+)/g);
    for (const match of templateMatches) {
      const name = match[1];

      if (SUPPORTED_PROMPT_CONTEXT_PROVIDERS.includes(name)) {
        contextRequests.push({
          provider: name,
        });
        continue;
      }

      // URLs
      if (name.startsWith("http")) {
        contextRequests.push({
          provider: "url",
          query: name,
        });
        continue;
      }

      // Files
      const resolvedFileUri = await resolveRelativePathInDir(
        match[1],
        ideMessenger.ide,
        workspaceDirs,
      );
      if (resolvedFileUri) {
        const contents = await ideMessenger.ide.readFile(resolvedFileUri);
        if (name.endsWith(".prompt")) {
          if (visitedFiles.has(resolvedFileUri)) {
            return [];
          }
          visitedFiles.add(resolvedFileUri);
          // As well as any context providers it references
          await addContextRequestsRecursive(contents);
        }
        contextRequests.push({
          provider: "file",
          query: resolvedFileUri,
        });
      }
    }
  }
  await addContextRequestsRecursive(command.prompt);
  return contextRequests;
}
