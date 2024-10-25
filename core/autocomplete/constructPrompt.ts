import { RangeInFileWithContents } from "../commands/util.js";
import { TabAutocompleteOptions } from "../index.js";

import {
  countTokens,
  pruneLinesFromBottom,
  pruneLinesFromTop,
} from "../llm/countTokens.js";
import { AstPath, getAst, getTreePathAtCursor } from "./ast.js";
import {
  AutocompleteLanguageInfo,
  LANGUAGES,
  Typescript,
} from "./languages.js";
import {
  fillPromptWithSnippets,
  getSymbolsForSnippet,
  rankSnippets,
  removeRangeFromSnippets,
  type AutocompleteSnippet,
} from "./ranking.js";
import { RecentlyEditedRange, findMatchingRange } from "./recentlyEdited.js";
import { ImportDefinitionsService } from "./services/ImportDefinitionsService.js";
import { RootPathContextService } from "./services/RootPathContextService.js";
import { shouldCompleteMultiline } from "./shouldCompleteMultiline.js";

export function languageForFilepath(
  filepath: string,
): AutocompleteLanguageInfo {
  return LANGUAGES[filepath.split(".").slice(-1)[0]] || Typescript;
}

export async function constructAutocompletePrompt(
  filepath: string,
  cursorLine: number,
  fullPrefix: string,
  fullSuffix: string,
  clipboardText: string,
  language: AutocompleteLanguageInfo,
  options: TabAutocompleteOptions,
  recentlyEditedRanges: RecentlyEditedRange[],
  recentlyEditedFiles: RangeInFileWithContents[],
  modelName: string,
  extraSnippets: AutocompleteSnippet[],
  importDefinitionsService: ImportDefinitionsService,
  rootPathContextService: RootPathContextService,
): Promise<{
  prefix: string;
  suffix: string;
  useFim: boolean;
  completeMultiline: boolean;
  snippets: AutocompleteSnippet[];
}> {
  // Construct basic prefix
  const maxPrefixTokens = options.maxPromptTokens * options.prefixPercentage;
  const prefix = pruneLinesFromTop(fullPrefix, maxPrefixTokens, modelName);

  // Construct suffix
  const maxSuffixTokens = Math.min(
    options.maxPromptTokens - countTokens(prefix, modelName),
    options.maxSuffixPercentage * options.maxPromptTokens,
  );
  const suffix = pruneLinesFromBottom(fullSuffix, maxSuffixTokens, modelName);

  // Calculate AST Path
  let treePath: AstPath | undefined;
  try {
    const ast = await getAst(filepath, fullPrefix + fullSuffix);
    if (ast) {
      treePath = await getTreePathAtCursor(ast, fullPrefix.length);
    }
  } catch (e) {
    console.error("Failed to parse AST", e);
  }

  // Find external snippets
  let snippets: AutocompleteSnippet[] = [];

  if (options.useOtherFiles) {
    snippets.push(...extraSnippets);

    const windowAroundCursor =
      fullPrefix.slice(
        -options.slidingWindowSize * options.slidingWindowPrefixPercentage,
      ) +
      fullSuffix.slice(
        options.slidingWindowSize * (1 - options.slidingWindowPrefixPercentage),
      );

    // This was much too slow, and not super useful
    // const slidingWindowMatches = await slidingWindowMatcher(
    //   recentlyEditedFiles,
    //   windowAroundCursor,
    //   3,
    //   options.slidingWindowSize,
    // );
    // snippets.push(...slidingWindowMatches);

    // snippets.push(
    //   ...recentlyEditedRanges.map((r) => ({
    //     ...r,
    //     contents: r.lines.join("\n"),
    //   })),
    // );

    if (options.useRecentlyEdited) {
      const currentLinePrefix = prefix.trim().split("\n").slice(-1)[0];
      if (currentLinePrefix?.length > options.recentLinePrefixMatchMinLength) {
        const matchingRange = findMatchingRange(
          recentlyEditedRanges,
          currentLinePrefix,
        );
        if (matchingRange) {
          snippets.push({
            ...matchingRange,
            contents: matchingRange.lines.join("\n"),
            score: 0.8,
          });
        }
      }
    }

    // Use imports
    if (options.useImports) {
      const importSnippets = [];
      const fileInfo = importDefinitionsService.get(filepath);
      if (fileInfo) {
        const { imports } = fileInfo;
        // Look for imports of any symbols around the current range
        const textAroundCursor =
          fullPrefix.split("\n").slice(-5).join("\n") +
          fullSuffix.split("\n").slice(0, 3).join("\n");
        const symbols = Array.from(
          getSymbolsForSnippet(textAroundCursor),
        ).filter((symbol) => !language.topLevelKeywords.includes(symbol));
        for (const symbol of symbols) {
          const rifs = imports[symbol];
          if (Array.isArray(rifs)) {
            importSnippets.push(...rifs);
          }
        }
      }
      snippets.push(...importSnippets);
    }

    if (options.useRootPathContext && treePath) {
      const ctx = await rootPathContextService.getContextForPath(
        filepath,
        treePath,
      );
      snippets.push(...ctx);
    }

    // Filter out empty snippets and ones that are already in the prefix/suffix
    snippets = snippets
      .map((snippet) => ({ ...snippet }))
      .filter(
        (s) =>
          s.contents.trim() !== "" &&
          !(prefix + suffix).includes(s.contents.trim()),
      );

    // Rank / order the snippets
    const scoredSnippets = rankSnippets(snippets, windowAroundCursor);

    // Fill maxSnippetTokens with snippets
    const maxSnippetTokens =
      options.maxPromptTokens * options.maxSnippetPercentage;

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

    snippets = finalSnippets;
  }

  return {
    prefix,
    suffix,
    useFim: true,
    completeMultiline: await shouldCompleteMultiline(
      treePath,
      fullPrefix,
      fullSuffix,
      language,
    ),
    snippets,
  };
}
