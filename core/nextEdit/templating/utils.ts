import { Position } from "../..";
import {
  INSTINCT_EDITABLE_REGION_END_TOKEN,
  INSTINCT_EDITABLE_REGION_START_TOKEN,
  NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
  NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
} from "../constants";

export function insertCursorToken(
  lines: string[],
  cursorPos: Position,
  cursorToken: string,
) {
  if (cursorPos.line < 0 || cursorPos.line >= lines.length) {
    return lines;
  }

  // Ensure character position is within bounds or at the end of the line.
  const lineLength = lines[cursorPos.line].length;
  const charPos = Math.min(Math.max(0, cursorPos.character), lineLength);

  lines[cursorPos.line] =
    lines[cursorPos.line].slice(0, charPos) +
    cursorToken +
    lines[cursorPos.line].slice(charPos);

  return lines;
}

export function insertEditableRegionTokensWithStaticRange(
  lines: string[],
  cursorPos: Position,
  editableRegionStart?: number,
  editableRegionEnd?: number,
) {
  if (cursorPos.line < 0 || cursorPos.line >= lines.length) {
    return lines;
  }

  // Ensure editable regions are within bounds.
  if (editableRegionStart === undefined) {
    editableRegionStart = Math.max(
      cursorPos.line - NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
      0,
    );
  }
  if (editableRegionEnd === undefined) {
    editableRegionEnd = Math.min(
      cursorPos.line + NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
      lines.length - 1, // Line numbers should be zero-indexed.
    );
  }

  const instrumentedLines = [
    ...lines.slice(0, editableRegionStart),
    INSTINCT_EDITABLE_REGION_START_TOKEN,
    ...lines.slice(editableRegionStart, editableRegionEnd + 1),
    INSTINCT_EDITABLE_REGION_END_TOKEN,
    ...lines.slice(editableRegionEnd + 1),
  ];

  return instrumentedLines;
}
