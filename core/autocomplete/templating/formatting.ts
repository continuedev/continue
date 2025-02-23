import { getLastNUriRelativePathParts } from "../../util/uri";
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
  const commentMark = getCommentMark(helper);
  return text
    .trim()
    .split("\n")
    .map((line) => `${commentMark} ${line}`)
    .join("\n");
};

const formatClipboardSnippet = (
  snippet: AutocompleteClipboardSnippet,
  workspaceDirs: string[],
): AutocompleteCodeSnippet => {
  return formatCodeSnippet(
    {
      filepath: "file:///Untitled.txt",
      content: snippet.content,
      type: AutocompleteSnippetType.Code,
    },
    workspaceDirs,
  );
};

const formatCodeSnippet = (
  snippet: AutocompleteCodeSnippet,
  workspaceDirs: string[],
): AutocompleteCodeSnippet => {
  return {
    ...snippet,
    content: `Path: ${getLastNUriRelativePathParts(workspaceDirs, snippet.filepath, 2)}\n${snippet.content}`,
  };
};

const formatDiffSnippet = (
  snippet: AutocompleteDiffSnippet,
): AutocompleteDiffSnippet => {
  return snippet;
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

export const formatSnippets = (
  helper: HelperVars,
  snippets: AutocompleteSnippet[],
  workspaceDirs: string[],
): string => {
  const currentFilepathComment = addCommentMarks(
    getLastNUriRelativePathParts(workspaceDirs, helper.filepath, 2),
    helper,
  );

  return (
    snippets
      .map((snippet) => {
        switch (snippet.type) {
          case AutocompleteSnippetType.Code:
            return formatCodeSnippet(snippet, workspaceDirs);
          case AutocompleteSnippetType.Diff:
            return formatDiffSnippet(snippet);
          case AutocompleteSnippetType.Clipboard:
            return formatClipboardSnippet(snippet, workspaceDirs);
        }
      })
      .map((item) => {
        return commentifySnippet(helper, item).content;
      })
      .join("\n") + `\n${currentFilepathComment}`
  );
};
