import Parser from "web-tree-sitter";
import { TabAutocompleteOptions } from "..";
import {
  countTokens,
  pruneLinesFromBottom,
  pruneLinesFromTop,
} from "../llm/countTokens";
import { getBasename } from "../util";
import { getParserForFile } from "../util/treeSitter";
import { AutocompleteLanguageInfo, LANGUAGES, Typescript } from "./languages";

export function languageForFilepath(
  filepath: string
): AutocompleteLanguageInfo {
  return LANGUAGES[filepath.split(".").slice(-1)[0]] || Typescript;
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

async function getAst(
  filepath: string,
  fileContents: string
): Promise<Parser.Tree | undefined> {
  const parser = await getParserForFile(filepath);

  if (!parser) {
    return undefined;
  }

  const ast = parser.parse(fileContents);
  return ast;
}

async function getTreePathAtCursor(
  ast: Parser.Tree,
  cursorIndex: number
): Promise<Parser.SyntaxNode[] | undefined> {
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

const BLOCK_TYPES = ["body", "statement_block"];

function shouldCompleteMultiline(
  treePath: Parser.SyntaxNode[],
  cursorLine: number
): boolean {
  // If at the base of the file, do multiline
  if (treePath.length === 1) {
    return true;
  }

  // If at the first line of an otherwise empty funtion body, do multiline
  for (let i = treePath.length - 1; i >= 0; i--) {
    const node = treePath[i];
    if (
      BLOCK_TYPES.includes(node.type) &&
      Math.abs(node.startPosition.row - cursorLine) <= 1
    ) {
      let text = node.text;
      text = text.slice(text.indexOf("{") + 1);
      text = text.slice(0, text.lastIndexOf("}"));
      text = text.trim();
      return text.split("\n").length === 1;
    }
  }

  return false;
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
): Promise<{
  prefix: string;
  suffix: string;
  useFim: boolean;
  completeMultiline: boolean;
}> {
  // Find external snippets
  const snippets: AutocompleteSnippet[] = [];

  let treePath: Parser.SyntaxNode[] | undefined;
  try {
    const ast = await getAst(filepath, fullPrefix + fullSuffix);
    if (!ast) {
      throw new Error(`AST undefined for ${filepath}`);
    }

    treePath = await getTreePathAtCursor(ast, fullPrefix.length);
  } catch (e) {
    console.error("Failed to parse AST", e);
  }

  let completeMultiline = false;
  if (treePath) {
    // Get function def when inside call expression
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

    // Use AST to determine whether to complete multiline
    let cursorLine = fullPrefix.split("\n").length - 1;
    completeMultiline = shouldCompleteMultiline(treePath, cursorLine);
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

  return { prefix, suffix, useFim: true, completeMultiline };
}
