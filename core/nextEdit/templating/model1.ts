import { Position, Range } from "../..";
import {
  MODEL_1_CONTEXT_FILE_TOKEN,
  MODEL_1_EDITABLE_REGION_END_TOKEN,
  MODEL_1_EDITABLE_REGION_START_TOKEN,
  MODEL_1_SNIPPET_TOKEN,
  MODEL_1_USER_CURSOR_IS_HERE_TOKEN,
} from "../constants";
import { extractMetadataFromUnifiedDiff } from "../context/diffFormatting";
import { insertCursorToken } from "./utils";

/**
 * @param contextSnippets Codestral style snippet with +++++ filename\ncontent or an empty string.
 */
export function contextSnippetsBlock(contextSnippets: string) {
  const headerRegex = /^(\+\+\+\+\+ )(.*)/g;
  const lines = contextSnippets.split("\n");

  return lines
    .reduce<string[]>((acc, line) => {
      const matches = line.match(headerRegex);
      if (matches) {
        acc.push("\n");
        const filename = matches[2];
        acc.push(`${MODEL_1_CONTEXT_FILE_TOKEN}: ${filename}`);
      } else {
        if (
          acc.length > 0 &&
          acc[acc.length - 1].match(headerRegex) // if header was added just before
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
    ...insertedCursorLines.slice(0, editableRegionStartLine),
    MODEL_1_EDITABLE_REGION_START_TOKEN,
    ...insertedCursorLines.slice(
      editableRegionStartLine,
      editableRegionEndLine + 1,
    ),
    MODEL_1_EDITABLE_REGION_END_TOKEN,
    ...insertedCursorLines.slice(editableRegionEndLine + 1),
  ];

  return instrumentedLines.join("\n");
}

export function editHistoryBlock(
  editDiffHistories: string[], // list of unified diffs
) {
  // diffHistory is made from createDiff.
  // This uses createPatch from npm diff library, which includes an index line and a separator.
  // We get rid of these first two lines.
  const block: string[] = [];

  editDiffHistories.forEach((diff) => {
    const metadata = extractMetadataFromUnifiedDiff(diff);
    block.push(
      [
        `User edited file \"${metadata.oldFilename}\"`,
        "",
        "```diff",
        `${diff.split("\n").slice(2).join("\n")}`,
        "```",
      ].join("\n"),
    );
  });

  return block.join("\n");
}
