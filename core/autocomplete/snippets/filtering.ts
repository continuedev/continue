import { countTokens } from "../../llm/countTokens";
import { isValidSnippet } from "../templating/validation";
import { AutocompleteContext } from "../util/AutocompleteContext";
import { AutocompleteSnippet } from "./types";

const getRemainingTokenCount = (helper: AutocompleteContext): number => {
  const tokenCount = countTokens(helper.prunedCaretWindow, helper.modelName);

  return helper.options.maxPromptTokens - tokenCount;
};

const TOKEN_BUFFER = 10; // We may need extra tokens for snippet description etc.

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param array The array to shuffle.
 * @returns The shuffled array.
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export function filterSnippetsAlreadyInCaretWindow(
  snippets: AutocompleteSnippet[],
  caretWindow: string,
): AutocompleteSnippet[] {
  return snippets.filter(
    (s) => s.content.trim() !== "" && !caretWindow.includes(s.content.trim()),
  );
}

export function keepSnippetsFittingInMaxTokens(
  ctx: AutocompleteContext,
  snippets: AutocompleteSnippet[],
): AutocompleteSnippet[] {
  const finalSnippets = [];

  const tokenCountInCaretWindow = countTokens(
    ctx.prunedCaretWindow,
    ctx.modelName,
  );

  let remainingTokenCount =
    ctx.options.maxPromptTokens - tokenCountInCaretWindow;

  while (remainingTokenCount > 0 && snippets.length > 0) {
    const snippet = snippets.shift();
    if (!snippet || !isValidSnippet(snippet)) {
      continue;
    }

    const snippetSize =
      countTokens(snippet.content, ctx.modelName) + TOKEN_BUFFER;

    if (remainingTokenCount >= snippetSize) {
      finalSnippets.push(snippet);
      remainingTokenCount -= snippetSize;
    }
  }
  if (ctx.options.logSnippetLimiting) {
    const dropMessage =
      snippets.length > finalSnippets.length
        ? `dropped snippets due to maxPromptTokens:\n${snippets
            .slice(finalSnippets.length)
            .map((s) => s.content)
            .join("\n\n")}`
        : "no snippets dropped";

    ctx.writeLog(
      `Snippet limiting: maxPromptTokens: ${ctx.options.maxPromptTokens} tokenCountInCaretWindow: ${tokenCountInCaretWindow} ${dropMessage}`,
    );
  }

  return finalSnippets;
}
