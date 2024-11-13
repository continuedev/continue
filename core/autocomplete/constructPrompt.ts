import { Position, Range } from "../index.js";

import { ContextRetrievalService } from "./context/ContextRetrievalService.js";
import {
  fillPromptWithSnippets,
  rankAndOrderSnippets,
  removeRangeFromSnippets,
  type AutocompleteSnippet,
} from "./context/ranking/index.js";
import { HelperVars } from "./util/HelperVars.js";

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
): Promise<AutocompleteSnippet[]> {
  let snippets = await contextRetrievalService.retrieveCandidateSnippets(
    helper,
    extraSnippets,
  );

  snippets = filterSnippetsAlreadyInCaretWindow(
    snippets,
    helper.prunedCaretWindow,
  );

  const scoredSnippets = rankAndOrderSnippets(snippets, helper);

  // This might be redundant with filterSnippetsAlreadyInCaretWindow
  let finalSnippets = removeRangeFromSnippets(
    scoredSnippets,
    helper.filepath.split("://").slice(-1)[0],
    getRangeOfPrefixAndSuffixWithBuffer(
      helper.prunedPrefix,
      helper.prunedSuffix,
      helper.pos,
    ),
  );

  // Filter snippets below similarity threshold
  finalSnippets = finalSnippets.filter(
    (snippet) =>
      snippet.score >= helper.options.recentlyEditedSimilarityThreshold,
  );

  finalSnippets = fillPromptWithSnippets(
    scoredSnippets,
    helper.maxSnippetTokens,
    helper.modelName,
  );

  return finalSnippets;
}
