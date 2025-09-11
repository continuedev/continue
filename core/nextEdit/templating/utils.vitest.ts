import { describe, expect, it } from "vitest";
import { Position } from "../..";
import {
  INSTINCT_EDITABLE_REGION_END_TOKEN,
  INSTINCT_EDITABLE_REGION_START_TOKEN,
  NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
  NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
} from "../constants";
import {
  insertCursorToken,
  insertEditableRegionTokensWithStaticRange,
} from "./utils";

describe("insertCursorToken", () => {
  it("should insert cursor token at the specified position", () => {
    const lines = ["line one", "line two", "line three"];
    const cursorPos: Position = { line: 1, character: 5 };
    const cursorToken = "|CURSOR|";

    const result = insertCursorToken(lines, cursorPos, cursorToken);

    expect(result).toEqual(["line one", "line |CURSOR|two", "line three"]);
  });

  it("should handle cursor at the beginning of a line", () => {
    const lines = ["line one", "line two", "line three"];
    const cursorPos: Position = { line: 1, character: 0 };
    const cursorToken = "|CURSOR|";

    const result = insertCursorToken(lines, cursorPos, cursorToken);

    expect(result).toEqual(["line one", "|CURSOR|line two", "line three"]);
  });

  it("should handle cursor at the end of a line", () => {
    const lines = ["line one", "line two", "line three"];
    const cursorPos: Position = { line: 1, character: 8 };
    const cursorToken = "|CURSOR|";

    const result = insertCursorToken(lines, cursorPos, cursorToken);

    expect(result).toEqual(["line one", "line two|CURSOR|", "line three"]);
  });

  it("should not modify lines if cursor position is out of bounds (negative line)", () => {
    const lines = ["line one", "line two", "line three"];
    const cursorPos: Position = { line: -1, character: 5 };
    const cursorToken = "|CURSOR|";

    const result = insertCursorToken(lines, cursorPos, cursorToken);

    expect(result).toEqual(lines);
  });

  it("should not modify lines if cursor position is out of bounds (line too large)", () => {
    const lines = ["line one", "line two", "line three"];
    const cursorPos: Position = { line: 3, character: 5 };
    const cursorToken = "|CURSOR|";

    const result = insertCursorToken(lines, cursorPos, cursorToken);

    expect(result).toEqual(lines);
  });

  it("should cap the character position to the line length if it exceeds it", () => {
    const lines = ["line one", "line two", "line three"];
    const cursorPos: Position = { line: 1, character: 100 };
    const cursorToken = "|CURSOR|";

    const result = insertCursorToken(lines, cursorPos, cursorToken);

    expect(result).toEqual(["line one", "line two|CURSOR|", "line three"]);
  });
});

describe("insertEditableRegionTokensWithStaticRange", () => {
  it("should insert editable region tokens with default margins", () => {
    const lines = ["line 0", "line 1", "line 2", "line 3", "line 4"];
    const cursorPos: Position = { line: 2, character: 3 };

    const result = insertEditableRegionTokensWithStaticRange(lines, cursorPos);

    const expectedStart = Math.max(2 - NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN, 0);
    const expectedEnd = Math.min(
      2 + NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
      lines.length - 1,
    );

    const expected = [
      ...lines.slice(0, expectedStart),
      INSTINCT_EDITABLE_REGION_START_TOKEN,
      ...lines.slice(expectedStart, expectedEnd + 1),
      INSTINCT_EDITABLE_REGION_END_TOKEN,
      ...lines.slice(expectedEnd + 1),
    ];

    expect(result).toEqual(expected);
  });

  it("should insert editable region tokens with explicit range", () => {
    const lines = ["line 0", "line 1", "line 2", "line 3", "line 4"];
    const cursorPos: Position = { line: 2, character: 3 };
    const editableRegionStart = 1;
    const editableRegionEnd = 3;

    const result = insertEditableRegionTokensWithStaticRange(
      lines,
      cursorPos,
      editableRegionStart,
      editableRegionEnd,
    );

    const expected = [
      "line 0",
      INSTINCT_EDITABLE_REGION_START_TOKEN,
      "line 1",
      "line 2",
      "line 3",
      INSTINCT_EDITABLE_REGION_END_TOKEN,
      "line 4",
    ];

    expect(result).toEqual(expected);
  });

  it("should not modify lines if cursor position is out of bounds", () => {
    const lines = ["line 0", "line 1", "line 2"];
    const cursorPos: Position = { line: 5, character: 3 };

    const result = insertEditableRegionTokensWithStaticRange(lines, cursorPos);

    expect(result).toEqual(lines);
  });
});
