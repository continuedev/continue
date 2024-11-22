import { countTokens } from "../../llm/countTokens";
import { SnippetPayload } from "../snippets";
import { AutocompleteSnippet } from "../snippets/types";
import { HelperVars } from "../util/HelperVars";
import { isValidSnippet } from "./validation";

const getRemainingTokenCount = (helper: HelperVars): number => {
  const tokenCount = countTokens(helper.prunedCaretWindow, helper.modelName);

  return helper.options.maxPromptTokens - tokenCount;
};

const TOKEN_BUFFER = 10; // We may need extra tokens for snippet description etc.

export const getSnippets = (
  helper: HelperVars,
  payload: SnippetPayload,
): AutocompleteSnippet[] => {
  const snippets = [
    ...payload.diffSnippets,
    ...payload.clipboardSnippets,
    ...payload.rootPathSnippets,
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
