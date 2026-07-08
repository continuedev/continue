import {
  AutocompleteClipboardSnippet,
  AutocompleteCodeSnippet,
  AutocompleteSnippet,
  AutocompleteSnippetType,
} from "../snippets/types";

const MAX_CLIPBOARD_AGE = 5 * 60 * 1000;

const isValidClipboardSnippet = (
  snippet: AutocompleteClipboardSnippet,
): boolean => {
  const currDate = new Date();

  const isTooOld =
    currDate.getTime() - new Date(snippet.copiedAt).getTime() >
    MAX_CLIPBOARD_AGE;

  return !isTooOld;
};

export const isValidSnippet = (snippet: AutocompleteSnippet): boolean => {
  if (snippet.content.trim() === "") return false;

  if (snippet.type === AutocompleteSnippetType.Clipboard) {
    return isValidClipboardSnippet(snippet);
  }

  if (
    (snippet as AutocompleteCodeSnippet).filepath?.startsWith(
      "output:extension-output-Continue.continue",
    )
  ) {
    return false;
  }

  return true;
};
