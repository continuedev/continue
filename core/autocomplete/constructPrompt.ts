import Parser from "web-tree-sitter";
import { TabAutocompleteOptions } from "..";
import {
  countTokens,
  pruneLinesFromBottom,
  pruneLinesFromTop,
} from "../llm/countTokens";
import { getBasename } from "../util";
import { getParserForFile } from "../util/treeSitter";
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

async function getTreePathAtCursor(
  filepath: string,
  fileContents: string,
  cursorIndex: number
): Promise<Parser.SyntaxNode[] | undefined> {
  const parser = await getParserForFile(filepath);

  if (!parser) {
    return undefined;
  }

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

export interface AutocompleteSnippet {
  filepath: string;
  content: string;
}

export async function constructAutocompletePrompt(
  filepath: string,
  fullPrefix: string,
  fullSuffix: string,
  clipboardText: string,
  language: AutocompleteLanguageInfo,
  getDefinition: (
    filepath: string,
    line: number,
    character: number
  ) => Promise<AutocompleteSnippet | undefined>,
  options: TabAutocompleteOptions
): Promise<{ prefix: string; suffix: string; useFim: boolean }> {
  // Find external snippets
  const snippets: AutocompleteSnippet[] = [];

  const treePath = await getTreePathAtCursor(
    filepath,
    fullPrefix + fullSuffix,
    fullPrefix.length
  );

  // Get function def when inside call expression
  if (treePath) {
    let callExpression = undefined;
    for (let node of treePath.reverse()) {
      if (node.type === "call_expression") {
        callExpression = node;
        break;
      }
    }
    if (callExpression) {
      const definition = await getDefinition(
        filepath,
        callExpression.startPosition.row,
        callExpression.startPosition.column
      );
      if (definition) {
        snippets.push(definition);
      }
    }
  }

  // Construct basic prefix / suffix
  const formattedSnippets = snippets
    .map((snippet) =>
      formatExternalSnippet(snippet.filepath, snippet.content, language)
    )
    .join("\n");
  const maxPrefixTokens =
    options.maxPromptTokens * options.prefixPercentage -
    countTokens(formattedSnippets, "gpt-4");
  let prefix = pruneLinesFromTop(fullPrefix, maxPrefixTokens);
  if (formattedSnippets.length > 0) {
    prefix = formattedSnippets + "\n" + prefix;
  }

  const maxSuffixTokens = Math.min(
    options.maxPromptTokens - countTokens(prefix, "gpt-4"),
    options.maxSuffixPercentage * options.maxPromptTokens
  );
  let suffix = pruneLinesFromBottom(fullSuffix, maxSuffixTokens);

  return { prefix, suffix, useFim: true };
}
