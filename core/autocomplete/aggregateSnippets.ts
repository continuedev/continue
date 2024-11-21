import { ContextRetrievalService } from "./context/ContextRetrievalService.js";
import {
  fillPromptWithSnippets,
  rankAndOrderSnippets,
  type AutocompleteSnippetDeprecated,
} from "./context/ranking/index.js";
import { HelperVars } from "./util/HelperVars.js";

function filterSnippetsAlreadyInCaretWindow(
  snippets: AutocompleteSnippetDeprecated[],
  caretWindow: string,
): AutocompleteSnippetDeprecated[] {
  return snippets
    .map((snippet) => ({ ...snippet }))
    .filter(
      (s) =>
        s.contents.trim() !== "" && !caretWindow.includes(s.contents.trim()),
    );
}

export async function aggregateSnippets(
  helper: HelperVars,
  extraSnippets: AutocompleteSnippetDeprecated[],
  contextRetrievalService: ContextRetrievalService,
): Promise<AutocompleteSnippetDeprecated[]> {
  let snippets = await contextRetrievalService.retrieveCandidateSnippets(
    helper,
    extraSnippets,
  );

  snippets = filterSnippetsAlreadyInCaretWindow(
    snippets,
    helper.prunedCaretWindow,
  );

  const scoredSnippets = rankAndOrderSnippets(snippets, helper);

  const finalSnippets = fillPromptWithSnippets(
    scoredSnippets,
    helper.maxSnippetTokens,
    helper.modelName,
  );

  return finalSnippets;
}
