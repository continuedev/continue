import { getBasename, getLastNPathParts } from "../../util";
import { AutocompleteLanguageInfo } from "../constants/AutocompleteLanguageInfo";
import {
  AutocompleteClipboardSnippet,
  AutocompleteCodeSnippet,
  AutocompleteDiffSnippet,
  AutocompleteSnippet,
  AutocompleteSnippetType,
} from "../snippets/types";
import { HelperVars } from "../util/HelperVars";

const getCommentMark = (helper: HelperVars) => {
  return helper.lang.singleLineComment;
};

const addCommentMarks = (text: string, helper: HelperVars) => {
  const lines = [
    ...text
      .trim()
      .split("\n")
      .map((line) => `${getCommentMark(helper)} ${line}`),
  ];
  return lines.join("\n");
};

const formatClipboardSnippet = (
  snippet: AutocompleteClipboardSnippet,
): AutocompleteClipboardSnippet => {
  return {
    ...snippet,
    content: `Recently copied by user:${snippet.content.includes("\n") ? "\n" : ""} ${snippet.content}`,
  };
};

const formatCodeSnippet = (
  snippet: AutocompleteCodeSnippet,
): AutocompleteCodeSnippet => {
  return {
    ...snippet,
    content: `Path: ${getBasename(snippet.filepath)}\n${snippet.content}`,
  };
};

const formatDiffSnippet = (
  snippet: AutocompleteDiffSnippet,
): AutocompleteDiffSnippet => {
  return snippet;
};

// TODO: Insert this somewhere
const getCurrentFilepathSnippet = (helper: HelperVars) => {
  const currentFilePath = `\n\n${getLastNPathParts(helper.filepath, 2)}\n\n`;
};

const commentifySnippet = (
  helper: HelperVars,
  snippet: AutocompleteSnippet,
): AutocompleteSnippet => {
  return {
    ...snippet,
    content: addCommentMarks(snippet.content, helper),
  };
};

const SNIPPET_TYPES_TO_COMMENT = [
  AutocompleteSnippetType.Code,
  AutocompleteSnippetType.Clipboard,
];

export const formatSnippets = (
  helper: HelperVars,
  snippets: AutocompleteSnippet[],
): string => {
  return snippets
    .map((snippet) => {
      switch (snippet.type) {
        case AutocompleteSnippetType.Code:
          return formatCodeSnippet(snippet);
        case AutocompleteSnippetType.Diff:
          return formatDiffSnippet(snippet);
        case AutocompleteSnippetType.Clipboard:
          return formatClipboardSnippet(snippet);
      }
    })
    .map((item) => {
      if (SNIPPET_TYPES_TO_COMMENT.includes(item.type)) {
        return commentifySnippet(helper, item);
      }

      return item;
    })
    .map((item) => {
      if (SNIPPET_TYPES_TO_COMMENT.includes(item.type)) {
        return item.content + `\n${getCommentMark}\n${getCommentMark}`;
      }

      return item.content + "\n\n";
    })
    .join("");
};
