import { getBasename } from "../util";
import { AutocompleteLanguageInfo, Typescript } from "./languages";

export function languageForFilepath(
  filepath: string
): AutocompleteLanguageInfo {
  return Typescript;
}

function formatExternalSnippet(
  filepath: string,
  snippet: string,
  language: AutocompleteLanguageInfo
) {
  const comment = language.comment;
  const lines = [
    comment + " Path: " + getBasename(filepath),
    ...snippet.split("\n").map((line) => comment + " " + line),
    comment,
  ];
  return lines.join("\n");
}

function getTreePathAtCursor(fileContents: string, cursorIndex: number) {
  // const parser =
}

const MAX_PROMPT_TOKENS = 1_000;
export async function constructAutocompletePrompt(
  filepath: string,
  fullPrefix: string,
  fullSuffix: string,
  clipboardText: string,
  language: AutocompleteLanguageInfo
): Promise<{ prefix: string; suffix: string; useFim: boolean }> {
  const prefix = fullPrefix.split("\n").slice(-10).join("\n");
  const suffix = fullSuffix.split("\n").slice(0, 10).join("\n");

  return { prefix, suffix, useFim: true };
}
