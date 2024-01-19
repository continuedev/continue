import Parser from "web-tree-sitter";
import {
  countTokens,
  pruneLinesFromBottom,
  pruneLinesFromTop,
} from "../llm/countTokens";
import { getBasename } from "../util";
import { getParserForFile } from "../util/treeSitter";
import { AutocompleteLanguageInfo, Typescript } from "./languages";
import {
  MAX_PROMPT_TOKENS,
  MAX_SUFFIX_PERCENTAGE,
  PREFIX_PERCENTAGE,
} from "./parameters";

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

async function getTreePathAtCursor(
  filepath: string,
  fileContents: string,
  cursorIndex: number
): Promise<Parser.SyntaxNode[]> {
  const parser = await getParserForFile(filepath);
  const ast = parser.parse(fileContents);
  const path = [ast.rootNode];
  while (path[path.length - 1].childCount > 0) {
    let foundChild = false;
    for (let child of path[path.length - 1].children) {
      if (child.startIndex <= cursorIndex && child.endIndex >= cursorIndex) {
        path.push(child);
        foundChild = true;
        break;
      }
    }

    if (!foundChild) {
      break;
    }
  }

  return path;
}

export async function constructAutocompletePrompt(
  filepath: string,
  fullPrefix: string,
  fullSuffix: string,
  clipboardText: string,
  language: AutocompleteLanguageInfo
): Promise<{ prefix: string; suffix: string; useFim: boolean }> {
  // Find external snippets
  // const path =

  // Construct basic prefix / suffix
  const maxPrefixTokens = MAX_PROMPT_TOKENS * PREFIX_PERCENTAGE;
  const prefix = pruneLinesFromTop(fullPrefix, maxPrefixTokens);

  const maxSuffixTokens = Math.min(
    MAX_PROMPT_TOKENS - countTokens(prefix, "gpt-4"),
    MAX_SUFFIX_PERCENTAGE * MAX_PROMPT_TOKENS
  );
  let suffix = pruneLinesFromBottom(fullSuffix, maxSuffixTokens);

  return { prefix, suffix, useFim: true };
}
