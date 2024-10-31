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
import { ContextRetrievalService } from "./context/ContextRetrievalService.js";
import {
  fillPromptWithSnippets,
  rankSnippets,
  removeRangeFromSnippets,
  type AutocompleteSnippet,
} from "./context/ranking/index.js";
import { HelperVars } from "./HelperVars.js";

export function languageForFilepath(
  filepath: string,
): AutocompleteLanguageInfo {
  return LANGUAGES[filepath.split(".").slice(-1)[0]] || Typescript;
}

export async function constructAutocompletePrompt(
  helper: HelperVars,
  extraSnippets: AutocompleteSnippet[],
  contextRetrievalService: ContextRetrievalService,
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
  const prunedPrefix = pruneLinesFromTop(
    helper.fullPrefix,
    maxPrefixTokens,
    helper.modelName,
  );

  // Construct suffix
  const maxSuffixTokens = Math.min(
    helper.options.maxPromptTokens -
      countTokens(prunedPrefix, helper.modelName),
    helper.options.maxSuffixPercentage * helper.options.maxPromptTokens,
  );
  const prunedSuffix = pruneLinesFromBottom(
    helper.fullSuffix,
    maxSuffixTokens,
    helper.modelName,
  );

  let snippets = await contextRetrievalService.retrieve(
    prunedPrefix,
    helper,
    extraSnippets,
  );

  // Filter out empty snippets and ones that are already in the prefix/suffix
  snippets = snippets
    .map((snippet) => ({ ...snippet }))
    .filter(
      (s) =>
        s.contents.trim() !== "" &&
        !(prunedPrefix + prunedSuffix).includes(s.contents.trim()),
    );

  // Rank / order the snippets
  const scoredSnippets = rankSnippets(snippets, helper);

  // Fill maxSnippetTokens with snippets
  const maxSnippetTokens =
    helper.options.maxPromptTokens * helper.options.maxSnippetPercentage;

  // Remove prefix range from snippets
  const prefixLines = prunedPrefix.split("\n").length;
  const suffixLines = prunedSuffix.split("\n").length;
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

  return {
    prefix: prunedPrefix,
    suffix: prunedSuffix,
    useFim: true,
    completeMultiline: await shouldCompleteMultiline(helper),
    snippets,
  };
}
