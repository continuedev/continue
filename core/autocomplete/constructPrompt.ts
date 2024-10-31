import {
  countTokens,
  pruneLinesFromBottom,
  pruneLinesFromTop,
} from "../llm/countTokens.js";
import { shouldCompleteMultiline } from "./classification/shouldCompleteMultiline.js";
import {
  AutocompleteLanguageInfo,
  LANGUAGES,
  Typescript,
} from "./constants/AutocompleteLanguageInfo.js";
import { ImportDefinitionsService } from "./context/ImportDefinitionsService.js";
import {
  fillPromptWithSnippets,
  getSymbolsForSnippet,
  rankSnippets,
  removeRangeFromSnippets,
  type AutocompleteSnippet,
} from "./context/ranking/index.js";
import { RootPathContextService } from "./context/RootPathContextService.js";
import { HelperVars } from "./HelperVars.js";
import { findMatchingRange } from "./recentlyEdited.js";
import { AstPath, getAst, getTreePathAtCursor } from "./util/ast.js";

export function languageForFilepath(
  filepath: string,
): AutocompleteLanguageInfo {
  return LANGUAGES[filepath.split(".").slice(-1)[0]] || Typescript;
}

export async function constructAutocompletePrompt(
  fullPrefix: string,
  fullSuffix: string,
  helper: HelperVars,
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
  const maxPrefixTokens =
    helper.options.maxPromptTokens * helper.options.prefixPercentage;
  const prefix = pruneLinesFromTop(
    fullPrefix,
    maxPrefixTokens,
    helper.modelName,
  );

  // Construct suffix
  const maxSuffixTokens = Math.min(
    helper.options.maxPromptTokens - countTokens(prefix, helper.modelName),
    helper.options.maxSuffixPercentage * helper.options.maxPromptTokens,
  );
  const suffix = pruneLinesFromBottom(
    fullSuffix,
    maxSuffixTokens,
    helper.modelName,
  );

  // Calculate AST Path
  let treePath: AstPath | undefined;
  try {
    const ast = await getAst(helper.filepath, fullPrefix + fullSuffix);
    if (ast) {
      treePath = await getTreePathAtCursor(ast, fullPrefix.length);
    }
  } catch (e) {
    console.error("Failed to parse AST", e);
  }

  // Find external snippets
  let snippets: AutocompleteSnippet[] = [];

  if (helper.options.useOtherFiles) {
    snippets.push(...extraSnippets);

    const windowAroundCursor =
      fullPrefix.slice(
        -helper.options.slidingWindowSize *
          helper.options.slidingWindowPrefixPercentage,
      ) +
      fullSuffix.slice(
        helper.options.slidingWindowSize *
          (1 - helper.options.slidingWindowPrefixPercentage),
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

    if (helper.options.useRecentlyEdited) {
      const currentLinePrefix = prefix.trim().split("\n").slice(-1)[0];
      if (
        currentLinePrefix?.length >
        helper.options.recentLinePrefixMatchMinLength
      ) {
        const matchingRange = findMatchingRange(
          helper.input.recentlyEditedRanges,
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
    if (helper.options.useImports) {
      const importSnippets = [];
      const fileInfo = importDefinitionsService.get(helper.filepath);
      if (fileInfo) {
        const { imports } = fileInfo;
        // Look for imports of any symbols around the current range
        const textAroundCursor =
          fullPrefix.split("\n").slice(-5).join("\n") +
          fullSuffix.split("\n").slice(0, 3).join("\n");
        const symbols = Array.from(
          getSymbolsForSnippet(textAroundCursor),
        ).filter((symbol) => !helper.lang.topLevelKeywords.includes(symbol));
        for (const symbol of symbols) {
          const rifs = imports[symbol];
          if (Array.isArray(rifs)) {
            importSnippets.push(...rifs);
          }
        }
      }
      snippets.push(...importSnippets);
    }

    if (helper.options.useRootPathContext && treePath) {
      const ctx = await rootPathContextService.getContextForPath(
        helper.filepath,
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
      helper.options.maxPromptTokens * helper.options.maxSnippetPercentage;

    // Remove prefix range from snippets
    const prefixLines = prefix.split("\n").length;
    const suffixLines = suffix.split("\n").length;
    const buffer = 8;
    const prefixSuffixRangeWithBuffer = {
      start: {
        line: helper.pos.line - prefixLines - buffer,
        character: 0,
      },
      end: {
        line: helper.pos.line + suffixLines + buffer,
        character: 0,
      },
    };
    let finalSnippets = removeRangeFromSnippets(
      scoredSnippets,
      helper.filepath.split("://").slice(-1)[0],
      prefixSuffixRangeWithBuffer,
    );

    // Filter snippets for those with best scores (must be above threshold)
    finalSnippets = finalSnippets.filter(
      (snippet) =>
        snippet.score >= helper.options.recentlyEditedSimilarityThreshold,
    );
    finalSnippets = fillPromptWithSnippets(
      scoredSnippets,
      maxSnippetTokens,
      helper.modelName,
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
      helper.lang,
    ),
    snippets,
  };
}
