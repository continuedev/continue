import { Position } from "../..";
import {
  MODEL_1_CONTEXT_FILE_TOKEN,
  MODEL_1_EDITABLE_REGION_END_TOKEN,
  MODEL_1_EDITABLE_REGION_START_TOKEN,
  MODEL_1_SNIPPET_TOKEN,
  MODEL_1_USER_CURSOR_IS_HERE_TOKEN,
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
        acc.push(`${MODEL_1_CONTEXT_FILE_TOKEN}: ${filename}`);
      } else {
        if (
          acc.length > 0 &&
          acc[acc.length - 1].startsWith(MODEL_1_CONTEXT_FILE_TOKEN) // if header was added just before
        ) {
          acc.push(`${MODEL_1_SNIPPET_TOKEN}`);
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
    MODEL_1_USER_CURSOR_IS_HERE_TOKEN,
  );

  const instrumentedLines = [
    ...insertedCursorLines.slice(windowStart, editableRegionStartLine),
    MODEL_1_EDITABLE_REGION_START_TOKEN,
    ...insertedCursorLines.slice(
      editableRegionStartLine,
      editableRegionEndLine + 1,
    ),
    MODEL_1_EDITABLE_REGION_END_TOKEN,
    ...insertedCursorLines.slice(editableRegionEndLine + 1, windowEnd + 1),
  ];

  return instrumentedLines.join("\n");
}

export function editHistoryBlock(
  editDiffHistories: string, // unified diffs with Index headers
) {
  if (!editDiffHistories.trim()) {
    return "";
  }

  const blocks: string[] = [];

  // Split on Index: lines to get the unified diff.
  const diffSections = editDiffHistories
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

  return blocks.join("\n");
}
