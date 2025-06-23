import { CustomCommand, SlashCommandWithSource } from "../..";

export function convertPromptBlockToSlashCommand(
  customCommand: CustomCommand,
): SlashCommandWithSource {
  return {
    name: customCommand.name,
    description: customCommand.description ?? "",
    prompt: customCommand.prompt,
    source: "yaml-prompt-block",
  };
}
