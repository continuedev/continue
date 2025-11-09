import { SlashCommandWithSource } from "../..";
import { parsePromptFile } from "../../promptFiles/parsePromptFile";

export function slashCommandFromPromptFile(
  path: string,
  content: string,
): SlashCommandWithSource | null {
  const { name, description, systemMessage, prompt, version } = parsePromptFile(
    path,
    content,
  );

  return {
    name,
    description,
    prompt,
    source: version === 1 ? "prompt-file-v1" : "prompt-file-v2",
    sourceFile: path,
    overrideSystemMessage: systemMessage,
  };
}
