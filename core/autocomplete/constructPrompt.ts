import { Position, Range } from "../index.js";
import {
  countTokens,
  pruneLinesFromBottom,
  pruneLinesFromTop,
} from "../llm/countTokens.js";
import { shouldCompleteMultiline } from "./classification/shouldCompleteMultiline.js";
import { ContextRetrievalService } from "./context/ContextRetrievalService.js";
import {
  fillPromptWithSnippets,
  rankAndOrderSnippets,
  removeRangeFromSnippets,
  type AutocompleteSnippet,
} from "./context/ranking/index.js";
import { HelperVars } from "./HelperVars.js";

function prunePrefixSuffix(helper: HelperVars) {
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

  return {
    prunedPrefix,
    prunedSuffix,
  };
}

function filterSnippetsAlreadyInCaretWindow(
  snippets: AutocompleteSnippet[],
  caretWindow: string,
): AutocompleteSnippet[] {
  return snippets
    .map((snippet) => ({ ...snippet }))
    .filter(
      (s) =>
        s.contents.trim() !== "" && !caretWindow.includes(s.contents.trim()),
    );
}

function getRangeOfPrefixAndSuffixWithBuffer(
  prefix: string,
  suffix: string,
  caretPos: Position,
): Range {
  // Remove prefix range from snippets
  const prefixLines = prefix.split("\n").length;
  const suffixLines = suffix.split("\n").length;
  const buffer = 8;
  const prefixSuffixRangeWithBuffer = {
    start: {
      line: caretPos.line - prefixLines - buffer,
      character: 0,
    },
    end: {
      line: caretPos.line + suffixLines + buffer,
      character: 0,
    },
  };

  return prefixSuffixRangeWithBuffer;
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
  // Prune prefix/suffix based on token budgets
  const { prunedPrefix, prunedSuffix } = prunePrefixSuffix(helper);

  let snippets = await contextRetrievalService.retrieve(
    prunedPrefix,
    helper,
    extraSnippets,
  );

  snippets = filterSnippetsAlreadyInCaretWindow(
    snippets,
    prunedPrefix + prunedSuffix,
  );

  const scoredSnippets = rankAndOrderSnippets(snippets, helper);

  let finalSnippets = removeRangeFromSnippets(
    scoredSnippets,
    helper.filepath.split("://").slice(-1)[0],
    getRangeOfPrefixAndSuffixWithBuffer(prunedPrefix, prunedSuffix, helper.pos),
  );

  // Filter snippets for those with best scores (must be above threshold)
  finalSnippets = finalSnippets.filter(
    (snippet) =>
      snippet.score >= helper.options.recentlyEditedSimilarityThreshold,
  );

  finalSnippets = fillPromptWithSnippets(
    scoredSnippets,
    helper.maxSnippetTokens,
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
