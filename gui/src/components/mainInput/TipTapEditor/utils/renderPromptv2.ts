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
  if (command.promptFile) {
    visitedFiles.add(command.promptFile);
  }

  const contextItemAttrs: GetContextRequest[] = [];
  const addItem = (item: GetContextRequest) => {
    contextItemAttrs.push(item);
  };

  async function addContextRequestsRecursive(promptBody: string) {
    // Files
    for (const match of promptBody.matchAll(/@([^\s]+)/g)) {
      const name = match[0];
      const resolvedFileUri = await resolveRelativePathInDir(
        match[0],
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
          await addContextRequestsRecursive(contents);
        }
        return addItem({
          provider: name,
          query: resolvedFileUri,
        });
      }
      // URLs
      if (name.startsWith("http")) {
        return addItem({
          provider: "url",
          query: name,
        });
      }
      if (SUPPORTED_PROMPT_CONTEXT_PROVIDERS.includes(name)) {
        return addItem({
          provider: name,
        });
      }
    }
  }
  await addContextRequestsRecursive(command.prompt);
  return contextItemAttrs;
}
