import { Prompt } from "@continuedev/config-yaml";
import { SlashCommandWithSource } from "../..";

export function convertPromptBlockToSlashCommand(
  prompt: Prompt,
): SlashCommandWithSource {
  return {
    name: prompt.name,
    description: prompt.description ?? "",
    prompt: prompt.prompt,
    source: "yaml-prompt-block",
    sourceFile: prompt.sourceFile,
  };
}
