import { Position, Range } from "../..";
import {
  MERCURY_CODE_TO_EDIT_CLOSE,
  MERCURY_CODE_TO_EDIT_OPEN,
  MERCURY_CURSOR,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_CLOSE,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_OPEN,
} from "../constants";
import { insertCursorToken } from "./utils";

export function recentlyViewedCodeSnippetsBlock(
  recentlyViewedCodeSnippets: { filepath: string; content: string }[],
) {
  return recentlyViewedCodeSnippets.reduce((acc, snippet, i) => {
    const block = [
      MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_OPEN,
      `code_snippet_file_path: ${snippet.filepath}`,
      snippet.content,
      MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_CLOSE,
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
    MERCURY_CURSOR,
  );

  const instrumentedLines = [
    ...insertedCursorLines.slice(0, editableRegionStartLine),
    MERCURY_CODE_TO_EDIT_OPEN,
    ...insertedCursorLines.slice(
      editableRegionStartLine,
      editableRegionEndLine + 1,
    ),
    MERCURY_CODE_TO_EDIT_CLOSE,
    ...insertedCursorLines.slice(editableRegionEndLine + 1),
  ];

  return instrumentedLines.join("\n");
}

export function editHistoryBlock(
  editDiffHistory: string[], // could be a singe large unified diff
) {
  // diffHistory is made from createDiff.
  // This uses createPatch from npm diff library, which includes an index line and a separator.
  // We get rid of these first two lines.
  return editDiffHistory
    .map((diff) => diff.split("\n").slice(2).join("\n"))
    .join("\n");
  // return editDiffHistory.split("\n").slice(2).join("\n");
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
