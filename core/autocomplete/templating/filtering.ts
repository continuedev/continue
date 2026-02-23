import { countTokens } from "../../llm/countTokens";
import { SnippetPayload } from "../snippets";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippet,
  AutocompleteSnippetType,
  AutocompleteStaticSnippet,
} from "../snippets/types";
import { HelperVars } from "../util/HelperVars";
import { formatOpenedFilesContext } from "./formatOpenedFilesContext";

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
  snippets: (AutocompleteCodeSnippet | AutocompleteStaticSnippet)[],
  caretWindow: string,
): (AutocompleteCodeSnippet | AutocompleteStaticSnippet)[] {
  return snippets.filter(
    (s) => s.content.trim() !== "" && !caretWindow.includes(s.content.trim()),
  );
}

export const getSnippets = (
  helper: HelperVars,
  payload: SnippetPayload,
): AutocompleteSnippet[] => {
  const snippets = {
    clipboard: payload.clipboardSnippets,
    recentlyVisitedRanges: payload.recentlyVisitedRangesSnippets,
    recentlyEditedRanges: payload.recentlyEditedRangeSnippets,
    diff: payload.diffSnippets,
    recentlyOpenedFiles: payload.recentlyOpenedFileSnippets,
    base: shuffleArray(
      filterSnippetsAlreadyInCaretWindow(
        [
          ...payload.rootPathSnippets,
          ...payload.importDefinitionSnippets,
          ...payload.staticSnippet,
        ],
        helper.prunedCaretWindow,
      ),
    ),
  };

  // Define snippets with their priorities
  const snippetConfigs: {
    key: keyof typeof snippets;
    enabledOrPriority: boolean | number;
    defaultPriority: number;
    snippets: AutocompleteSnippet[];
  }[] = [
    {
      key: "clipboard",
      enabledOrPriority: helper.options.experimental_includeClipboard,
      defaultPriority: 1,
      snippets: payload.clipboardSnippets,
    },
    {
      key: "recentlyOpenedFiles",
      enabledOrPriority: helper.options.useRecentlyOpened,
      defaultPriority: 2,
      snippets: payload.recentlyOpenedFileSnippets,
    },
    {
      key: "recentlyVisitedRanges",
      enabledOrPriority:
        helper.options.experimental_includeRecentlyVisitedRanges,
      defaultPriority: 3,
      snippets: payload.recentlyVisitedRangesSnippets,
      /* TODO: recentlyVisitedRanges also contain contents from other windows like terminal or output
      if they are visible. We should handle them separately so that we can control their priority
      and whether they should be included or not. */
    },
    {
      key: "recentlyEditedRanges",
      enabledOrPriority:
        helper.options.experimental_includeRecentlyEditedRanges,
      defaultPriority: 4,
      snippets: payload.recentlyEditedRangeSnippets,
    },
    {
      key: "diff",
      enabledOrPriority: helper.options.experimental_includeDiff,
      defaultPriority: 5,
      snippets: payload.diffSnippets,
      // TODO: diff is commonly too large, thus anything lower in priority is not included.
    },
    {
      key: "base",
      enabledOrPriority: true,
      defaultPriority: 99, // make sure it's the last one to be processed, but still possible to override
      snippets: shuffleArray(
        filterSnippetsAlreadyInCaretWindow(
          [
            ...payload.rootPathSnippets,
            ...payload.importDefinitionSnippets,
            ...payload.staticSnippet,
          ],
          helper.prunedCaretWindow,
        ),
      ),
      // TODO: Add this too to experimental config, maybe move upper in the order, since it's almost
      // always not inlucded due to diff being commonly large
    },
  ];

  // Create a readable order of enabled snippets
  const snippetOrder = snippetConfigs
    .filter(({ enabledOrPriority }) => enabledOrPriority)
    .map(({ key, enabledOrPriority, defaultPriority }) => ({
      key,
      priority:
        typeof enabledOrPriority === "number"
          ? enabledOrPriority
          : defaultPriority,
    }))
    .sort((a, b) => a.priority - b.priority);

  const finalSnippets = [];
  let remainingTokenCount = getRemainingTokenCount(helper);

  // tracks already added filepaths for deduplication
  const addedFilepaths = new Set<string>();

  // Process snippets in priority order
  for (const { key } of snippetOrder) {
    // Special handling for recentlyOpenedFiles
    if (key === "recentlyOpenedFiles" && helper.options.useRecentlyOpened) {
      // Custom trimming
      const processedSnippets = formatOpenedFilesContext(
        payload.recentlyOpenedFileSnippets,
        remainingTokenCount,
        helper,
        finalSnippets,
        TOKEN_BUFFER,
      );

      // Add processed snippets to finalSnippets respecting token limits
      for (const snippet of processedSnippets) {
        if (!isValidSnippet(snippet)) continue;

        const snippetSize =
          countTokens(snippet.content, helper.modelName) + TOKEN_BUFFER;

        if (remainingTokenCount >= snippetSize) {
          finalSnippets.push(snippet);
          addedFilepaths.add(snippet.filepath);
          remainingTokenCount -= snippetSize;
        } else {
          continue; // Not enough tokens, try again with next snippet
        }
      }
    } else {
      // Normal processing for other snippet types
      const snippetsToProcess = snippets[key].filter(
        (snippet) =>
          snippet.type !== AutocompleteSnippetType.Code ||
          !addedFilepaths.has(snippet.filepath),
      );

      for (const snippet of snippetsToProcess) {
        if (!isValidSnippet(snippet)) continue;

        const snippetSize =
          countTokens(snippet.content, helper.modelName) + TOKEN_BUFFER;

        if (remainingTokenCount >= snippetSize) {
          finalSnippets.push(snippet);

          if ((snippet as AutocompleteCodeSnippet).filepath) {
            addedFilepaths.add((snippet as AutocompleteCodeSnippet).filepath);
          }

          remainingTokenCount -= snippetSize;
        } else {
          continue; // Not enough tokens, try again with next snippet
        }
      }
    }

    // If we're out of tokens, no need to process more snippet types
    if (remainingTokenCount <= 0) break;
  }

  return finalSnippets;
};
