import Parser from "web-tree-sitter";
import { TabAutocompleteOptions } from "..";
import { RangeInFileWithContents } from "../commands/util";
import {
  countTokens,
  pruneLinesFromBottom,
  pruneLinesFromTop,
} from "../llm/countTokens";
import { getBasename } from "../util";

import { getAst, getTreePathAtCursor } from "./ast";
import { AutocompleteLanguageInfo, LANGUAGES, Typescript } from "./languages";
import {
  AutocompleteSnippet,
  fillPromptWithSnippets,
  rankSnippets,
  removeRangeFromSnippets,
} from "./ranking";
import { slidingWindowMatcher } from "./slidingWindow";

export function languageForFilepath(
  filepath: string,
): AutocompleteLanguageInfo {
  return LANGUAGES[filepath.split(".").slice(-1)[0]] || Typescript;
}

function formatExternalSnippet(
  filepath: string,
  snippet: string,
  language: AutocompleteLanguageInfo,
) {
  const comment = language.comment;
  const lines = [
    comment + " Path: " + getBasename(filepath),
    ...snippet
      .trim()
      .split("\n")
      .map((line) => comment + " " + line),
    comment,
  ];
  return lines.join("\n");
}

const BLOCK_TYPES = ["body", "statement_block"];

function shouldCompleteMultilineAst(
  treePath: Parser.SyntaxNode[],
  cursorLine: number,
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

async function shouldCompleteMultiline(
  filepath: string,
  fullPrefix: string,
  fullSuffix: string,
): Promise<boolean> {
  // Use AST to determine whether to complete multiline
  let treePath: Parser.SyntaxNode[] | undefined;
  try {
    const ast = await getAst(filepath, fullPrefix + fullSuffix);
    if (!ast) {
      return true;
    }

    treePath = await getTreePathAtCursor(ast, fullPrefix.length);
  } catch (e) {
    console.error("Failed to parse AST", e);
  }

  let completeMultiline = false;
  if (treePath) {
    let cursorLine = fullPrefix.split("\n").length - 1;
    completeMultiline = shouldCompleteMultilineAst(treePath, cursorLine);
  }
  return completeMultiline;
}

export async function constructAutocompletePrompt(
  filepath: string,
  cursorLine: number,
  fullPrefix: string,
  fullSuffix: string,
  clipboardText: string,
  language: AutocompleteLanguageInfo,
  options: TabAutocompleteOptions,
  recentlyEditedRanges: RangeInFileWithContents[],
  recentlyEditedDocuments: RangeInFileWithContents[],
  modelName: string,
  extraSnippets: AutocompleteSnippet[],
): Promise<{
  prefix: string;
  suffix: string;
  useFim: boolean;
  completeMultiline: boolean;
}> {
  // Find external snippets
  let snippets: RangeInFileWithContents[] = extraSnippets;

  const windowAroundCursor =
    fullPrefix.slice(
      -options.slidingWindowSize * options.slidingWindowPrefixPercentage,
    ) +
    fullSuffix.slice(
      options.slidingWindowSize * (1 - options.slidingWindowPrefixPercentage),
    );

  const slidingWindowMatches = await slidingWindowMatcher(
    recentlyEditedDocuments,
    windowAroundCursor,
    3,
    options.slidingWindowSize,
  );
  snippets.push(...slidingWindowMatches);

  const recentlyEdited = (
    await Promise.all(
      recentlyEditedRanges.map(async (r) => {
        return r;
        // return await getScopeAroundRange(r);
      }),
    )
  ).filter((s) => !!s);
  snippets.push(...(recentlyEdited as any));

  // Rank / order the snippets
  const scoredSnippets = rankSnippets(snippets, windowAroundCursor);

  // Fill maxSnippetTokens with snippets
  const maxSnippetTokens =
    options.maxPromptTokens * options.maxSnippetPercentage;

  // Construct basic prefix
  const maxPrefixTokens = options.maxPromptTokens * options.prefixPercentage;
  let prefix = pruneLinesFromTop(fullPrefix, maxPrefixTokens, modelName);

  // Construct suffix
  const maxSuffixTokens = Math.min(
    options.maxPromptTokens - countTokens(prefix, modelName),
    options.maxSuffixPercentage * options.maxPromptTokens,
  );
  let suffix = pruneLinesFromBottom(fullSuffix, maxSuffixTokens, modelName);

  // Remove prefix range from snippets
  const prefixLines = prefix.split("\n").length;
  const suffixLines = suffix.split("\n").length;
  const buffer = 8;
  const prefixSuffixRangeWithBuffer = {
    start: {
      line: cursorLine - prefixLines - buffer,
      character: 0,
    },
    end: {
      line: cursorLine + suffixLines + buffer,
      character: 0,
    },
  };
  let finalSnippets = removeRangeFromSnippets(
    scoredSnippets,
    filepath.split("://").slice(-1)[0],
    prefixSuffixRangeWithBuffer,
  );

  // Filter snippets for those with best scores (must be above threshold)
  finalSnippets = finalSnippets.filter(
    (snippet) => snippet.score >= options.recentlyEditedSimilarityThreshold,
  );
  finalSnippets = fillPromptWithSnippets(
    scoredSnippets,
    maxSnippetTokens,
    modelName,
  );

  // Format snippets as comments and prepend to prefix
  const formattedSnippets = finalSnippets
    .map((snippet) =>
      formatExternalSnippet(snippet.filepath, snippet.contents, language),
    )
    .join("\n");
  if (formattedSnippets.length > 0) {
    prefix = formattedSnippets + "\n\n" + prefix;
  }

  return {
    prefix,
    suffix,
    useFim: true,
    completeMultiline: await shouldCompleteMultiline(
      filepath,
      fullPrefix,
      fullSuffix,
    ),
  };
}
