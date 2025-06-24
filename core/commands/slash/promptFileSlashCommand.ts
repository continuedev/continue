import { SlashCommandWithSource } from "../..";
import { parsePromptFile } from "../../promptFiles/parsePromptFile";

export function slashCommandFromPromptFileV1(
  path: string,
  content: string,
): SlashCommandWithSource | null {
  const { name, description, systemMessage, prompt } = parsePromptFile(
    path,
    content,
  );

  return {
    name,
    description,
    prompt,
    source: "prompt-file-v1",
    promptFile: path,
  };
}
