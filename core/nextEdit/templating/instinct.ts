import { Position } from "../..";
import {
  INSTINCT_CONTEXT_FILE_TOKEN,
  INSTINCT_EDITABLE_REGION_END_TOKEN,
  INSTINCT_EDITABLE_REGION_START_TOKEN,
  INSTINCT_SNIPPET_TOKEN,
  INSTINCT_USER_CURSOR_IS_HERE_TOKEN,
} from "../constants";
import { insertCursorToken } from "./utils";

/**
 * @param contextSnippets Codestral style snippet with +++++ filename\ncontent or an empty string.
 */
export function contextSnippetsBlock(contextSnippets: string) {
  const headerRegex = /^(\+\+\+\+\+ )(.*)/;
  const lines = contextSnippets.split("\n");

  return lines
    .reduce<string[]>((acc, line) => {
      const matches = line.match(headerRegex);
      if (matches) {
        const filename = matches[2];
        acc.push(`${INSTINCT_CONTEXT_FILE_TOKEN}: ${filename}`);
      } else {
        if (
          acc.length > 0 &&
          acc[acc.length - 1].startsWith(INSTINCT_CONTEXT_FILE_TOKEN) // if header was added just before
        ) {
          acc.push(`${INSTINCT_SNIPPET_TOKEN}`);
        }
        acc.push(line);
      }

      return acc;
    }, [])
    .join("\n");
}

export function currentFileContentBlock(
  currentFileContent: string,
  windowStart: number,
  windowEnd: number,
  editableRegionStartLine: number,
  editableRegionEndLine: number,
  cursorPosition: Position,
) {
  const currentFileContentLines = currentFileContent.split("\n");

  const insertedCursorLines = insertCursorToken(
    currentFileContentLines,
    cursorPosition,
    INSTINCT_USER_CURSOR_IS_HERE_TOKEN,
  );

  const instrumentedLines = [
    ...insertedCursorLines.slice(windowStart, editableRegionStartLine),
    INSTINCT_EDITABLE_REGION_START_TOKEN,
    ...insertedCursorLines.slice(
      editableRegionStartLine,
      editableRegionEndLine + 1,
    ),
    INSTINCT_EDITABLE_REGION_END_TOKEN,
    ...insertedCursorLines.slice(editableRegionEndLine + 1, windowEnd + 1),
  ];

  return instrumentedLines.join("\n");
}

export function editHistoryBlock(
  editDiffHistories: string[], // array of unified diffs with Index headers
) {
  if (!editDiffHistories.length) {
    return "";
  }

  const blocks: string[] = [];

  for (const editDiffHistory of editDiffHistories) {
    if (!editDiffHistory.trim()) {
      continue;
    }

    // Split on Index: lines to get the unified diff.
    const diffSections = editDiffHistory
      .split(/^Index: /m)
      .filter((section) => section.trim());

    for (const section of diffSections) {
      const lines = section.split("\n");

      // Extract filename from the first line (after "Index: " was split off).
      const filename = lines[0];

      // Find the start of the actual diff content (skip ---, +++, and === lines).
      const diffLines = lines
        .filter(
          (line) =>
            !line.startsWith("---") &&
            !line.startsWith("+++") &&
            !line.startsWith("===") &&
            line.trim() !== "", // remove empty lines from header section
        )
        .slice(1); // remove the filename line

      // Only include lines that are actual diff content (@@, +, -, or context lines).
      const actualDiffContent = diffLines.filter(
        (line) =>
          line.startsWith("@@") ||
          line.startsWith("+") ||
          line.startsWith("-") ||
          line.startsWith(" "), // context lines
      );

      if (actualDiffContent.length === 0) continue;

      const diffBlock = [
        `User edited file "${filename}"`,
        "",
        "```diff",
        actualDiffContent.join("\n"),
        "```",
      ].join("\n");

      blocks.push(diffBlock);
    }
  }

  return blocks.join("\n");
}
