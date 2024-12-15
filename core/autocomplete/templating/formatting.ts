import { getLastNPathParts } from "../../util";
import {
  AutocompleteClipboardSnippet,
  AutocompleteCodeSnippet,
  AutocompleteDiffSnippet,
  AutocompleteSnippet,
  AutocompleteSnippetType,
} from "../snippets/types";
import { AutocompleteContext } from "../util/AutocompleteContext";

const getCommentMark = (helper: AutocompleteContext) => {
  return helper.lang.singleLineComment;
};

const addCommentMarks = (text: string, helper: AutocompleteContext) => {
  const commentMark = getCommentMark(helper);
  const lines = [
    ...text
      .trim()
      .split("\n")
      .map((line) => `${commentMark} ${line}`),
  ];

  return lines.join("\n");
};

const formatClipboardSnippet = (
  snippet: AutocompleteClipboardSnippet,
): AutocompleteCodeSnippet => {
  return formatCodeSnippet({
    filepath: "Untitled.txt",
    content: snippet.content,
    type: AutocompleteSnippetType.Code,
  });
};

const formatCodeSnippet = (
  snippet: AutocompleteCodeSnippet,
): AutocompleteCodeSnippet => {
  return {
    ...snippet,
    content: `Path: ${getLastNPathParts(snippet.filepath, 2)}\n${snippet.content}`,
  };
};

const formatDiffSnippet = (
  snippet: AutocompleteDiffSnippet,
): AutocompleteDiffSnippet => {
  return snippet;
};

const getCurrentFilepath = (helper: AutocompleteContext) => {
  return getLastNPathParts(helper.filepath, 2);
};

const commentifySnippet = (
  helper: AutocompleteContext,
  snippet: AutocompleteSnippet,
): AutocompleteSnippet => {
  return {
    ...snippet,
    content: addCommentMarks(snippet.content, helper),
  };
};

export const formatSnippets = (
  helper: AutocompleteContext,
  snippets: AutocompleteSnippet[],
): string => {
  const currentFilepathComment = addCommentMarks(
    getCurrentFilepath(helper),
    helper,
  );

  return (
    snippets
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
        return commentifySnippet(helper, item).content;
      })
      .join("\n") + `\n${currentFilepathComment}`
  );
};
