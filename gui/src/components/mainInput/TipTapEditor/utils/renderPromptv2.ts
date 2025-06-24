import { SlashCommandDescWithSource } from "core";
import { SUPPORTED_PROMPT_CONTEXT_PROVIDERS } from "core/promptFiles";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { MentionAttrs } from "./types";

export async function getPromptV2ContextAttrs(
  ideMessenger: IIdeMessenger,
  command: SlashCommandDescWithSource,
): Promise<MentionAttrs[]> {
  if (!command.prompt) {
    return [];
  }
  const workspaceDirs = await ideMessenger.ide.getWorkspaceDirs();
  const visitedFiles = new Set<string>();
  if (command.promptFile) {
    visitedFiles.add(command.promptFile);
  }

  const contextItemAttrs: MentionAttrs[] = [];
  const addItem = (item: MentionAttrs) => {
    contextItemAttrs.push(item);
  };

  async function addContextAttrsRecursive(promptBody: string) {
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
          await addContextAttrsRecursive(contents);
        }
        return addItem({
          label: name,
          id: "file",
          itemType: "contextProvider",
          query: resolvedFileUri,
        });
      }
      // URLs
      if (name.startsWith("http")) {
        return addItem({
          label: name,
          id: "url",
          itemType: "contextProvider",
          query: name,
        });
      }
      if (SUPPORTED_PROMPT_CONTEXT_PROVIDERS.includes(name)) {
        return addItem({
          label: name,
          id: name,
          itemType: "contextProvider",
          query: "",
        });
      }
    }
  }
  await addContextAttrsRecursive(command.prompt);
  return contextItemAttrs;
}
