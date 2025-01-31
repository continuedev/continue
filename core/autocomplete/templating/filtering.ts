import { countTokens } from "../../llm/countTokens";
import { SnippetPayload } from "../snippets";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippet,
} from "../snippets/types";
import { HelperVars } from "../util/HelperVars";

import { isValidSnippet } from "./validation";

const getRemainingTokenCount = (helper: HelperVars): number => {
  const tokenCount = countTokens(helper.prunedCaretWindow, helper.modelName);

  return helper.options.maxPromptTokens - tokenCount;
};

const TOKEN_BUFFER = 10; // We may need extra tokens for snippet description etc.

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param array The array to shuffle.
 * @returns The shuffled array.
 */
const shuffleArray = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

function filterSnippetsAlreadyInCaretWindow(
  snippets: AutocompleteCodeSnippet[],
  caretWindow: string,
): AutocompleteCodeSnippet[] {
  return snippets.filter(
    (s) => s.content.trim() !== "" && !caretWindow.includes(s.content.trim()),
  );
}

export const getSnippets = (
  helper: HelperVars,
  payload: SnippetPayload,
): AutocompleteSnippet[] => {
  const snippets = [
    ...payload.clipboardSnippets,
    ...payload.recentlyVisitedRangesSnippets,
    ...payload.recentlyEditedRangeSnippets,
    //...payload.diffSnippets,
    ...shuffleArray(
      filterSnippetsAlreadyInCaretWindow(
        [...payload.rootPathSnippets, ...payload.importDefinitionSnippets],
        helper.prunedCaretWindow,
      ),
    ),
  ];

  const finalSnippets = [];

  let remainingTokenCount = getRemainingTokenCount(helper);

  while (remainingTokenCount > 0 && snippets.length > 0) {
    const snippet = snippets.shift();
    if (!snippet || !isValidSnippet(snippet)) {
      continue;
    }

    const snippetSize =
      countTokens(snippet.content, helper.modelName) + TOKEN_BUFFER;

    if (remainingTokenCount >= snippetSize) {
      finalSnippets.push(snippet);
      remainingTokenCount -= snippetSize;
    }
  }

  return finalSnippets;
};
