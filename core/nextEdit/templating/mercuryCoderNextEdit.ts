import { Position, Range } from "../..";
import { CODE_TO_EDIT_CLOSE, CODE_TO_EDIT_OPEN, CURSOR } from "../constants";
import { insertCursorToken } from "./utils";

export function recentlyViewedCodeSnippetsBlock(
  recentlyViewedCodeSnippets: { filepath: string; content: string }[],
) {
  return recentlyViewedCodeSnippets.reduce((acc, snippet, i) => {
    const block = [
      `code_snippet_file_path: ${snippet.filepath}`,
      snippet.content,
    ].join("\n");

    return (
      acc + block + (i === recentlyViewedCodeSnippets.length - 1 ? "" : "\n")
    );
  }, "");
}

export function currentFileContentBlock(
  currentFileContent: string,
  editableRegionStartLine: number,
  editableRegionEndLine: number,
  cursorPosition: Position,
) {
  const currentFileContentLines = currentFileContent.split("\n");

  const insertedCursorLines = insertCursorToken(
    currentFileContentLines,
    cursorPosition,
    CURSOR,
  );

  const instrumentedLines = [
    ...insertedCursorLines.slice(0, editableRegionStartLine),
    CODE_TO_EDIT_OPEN,
    ...insertedCursorLines.slice(
      editableRegionStartLine,
      editableRegionEndLine + 1,
    ),
    CODE_TO_EDIT_CLOSE,
    ...insertedCursorLines.slice(editableRegionEndLine + 1),
  ];

  return instrumentedLines.join("\n");
}

export function editHistoryBlock(
  editDiffHistory: string, // could be a singe large unified diff
) {
  return editDiffHistory;
}

function mercuryNextEditTemplateBuilder(
  recentlyViewedCodeSnippets: { filepath: string; code: string }[],
  currentFileContent: string,
  codeToEdit: string,
  codeToEditRange: Range,
  cursorPosition: Position,
  editDiffHistory: string, // could be a singe large unified diff
): string {
  return "";
}
