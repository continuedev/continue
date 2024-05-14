import { Position, Range } from "../index.js";

export function getRangeInString(content: string, range: Range): string {
  const lines = content.split("\n");

  if (range.start.line === range.end.line) {
    return (
      lines[range.start.line]?.substring(
        range.start.character,
        range.end.character + 1,
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
  const startLine = Math.max(a.start.line, b.start.line);
  const endLine = Math.min(a.end.line, b.end.line);

  if (startLine > endLine) {
    return null;
  }

  if (startLine === endLine) {
    const startCharacter = Math.max(a.start.character, b.start.character);
    const endCharacter = Math.min(a.end.character, b.end.character);

    if (startCharacter > endCharacter) {
      return null;
    }

    return {
      start: { line: startLine, character: startCharacter },
      end: { line: endLine, character: endCharacter },
    };
  }

  const startCharacter =
    startLine === a.start.line ? a.start.character : b.start.character;
  const endCharacter =
    endLine === a.end.line ? a.end.character : b.end.character;

  return {
    start: { line: startLine, character: startCharacter },
    end: { line: endLine, character: endCharacter },
  };
}

export function union(a: Range, b: Range): Range {
  const startLine = Math.min(a.start.line, b.start.line);
  const endLine = Math.max(a.end.line, b.end.line);

  const startCharacter =
    startLine === a.start.line ? a.start.character : b.start.character;
  const endCharacter =
    endLine === a.end.line ? a.end.character : b.end.character;

  return {
    start: { line: startLine, character: startCharacter },
    end: { line: endLine, character: endCharacter },
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
