import { Position, Range } from "../index.js";

export function getRangeInString(content: string, range: Range): string {
  const lines = content.split("\n");

  if (range.start.line === range.end.line) {
    return (
      lines[range.start.line]?.substring(
        range.start.character,
        range.end.character,
      ) ?? ""
    );
  }

  const firstLine =
    lines[range.start.line]?.substring(
      range.start.character,
      lines[range.start.line].length,
    ) ?? "";
  const middleLines = lines.slice(range.start.line + 1, range.end.line);
  const lastLine =
    lines[range.end.line]?.substring(0, range.end.character) ?? "";

  return [firstLine, ...middleLines, lastLine].join("\n");
}

export function intersection(a: Range, b: Range): Range | null {
  // The intersection starts at the later of the two start positions and ends at
  // the earlier of the two end positions. Picking the character from whichever
  // range owns the shared line is wrong when both ranges start (or end) on the
  // same line, and when one range starts on an earlier line but at a later
  // character than the other.
  const start = maxPosition(a.start, b.start);
  const end = minPosition(a.end, b.end);

  if (
    start.line > end.line ||
    (start.line === end.line && start.character > end.character)
  ) {
    return null;
  }

  return {
    start,
    end,
  };
}

export function union(a: Range, b: Range): Range {
  let start: Position;
  if (a.start.line === b.start.line) {
    start = {
      line: a.start.line,
      character: Math.min(a.start.character, b.start.character),
    };
  } else if (a.start.line < b.start.line) start = a.start;
  else start = b.start;

  let end: Position;
  if (a.end.line === b.end.line) {
    end = {
      line: a.end.line,
      character: Math.max(a.end.character, b.end.character),
    };
  } else if (a.end.line > b.end.line) end = a.end;
  else end = b.end;

  return {
    start,
    end,
  };
}

export function maxPosition(a: Position, b: Position): Position {
  if (a.line > b.line) {
    return a;
  } else if (a.line < b.line) {
    return b;
  } else {
    return a.character > b.character ? a : b;
  }
}

export function minPosition(a: Position, b: Position): Position {
  if (a.line < b.line) {
    return a;
  } else if (a.line > b.line) {
    return b;
  } else {
    return a.character < b.character ? a : b;
  }
}
