import { distance } from "fastest-levenshtein";
import { ChatMessage } from "..";
import { stripImages } from "../llm/countTokens";

export type LineStream = AsyncGenerator<string>;

function linesMatchPerfectly(lineA: string, lineB: string): boolean {
  return lineA === lineB && lineA !== "";
}

function linesMatch(lineA: string, lineB: string): boolean {
  // Require a perfect (without padding) match for these lines
  // Otherwise they are edit distance 1 from empty lines and other single char lines (e.g. each other)
  if (["}", "*"].includes(lineA.trim())) {
    return lineA.trim() === lineB.trim();
  }

  const d = distance(lineA, lineB);
  return (
    (d / Math.max(lineA.length, lineB.length) < 0.5 ||
      lineA.trim() === lineB.trim()) &&
    lineA.trim() !== ""
  );
}

/**
 * Return the index of the first match and whether it is a perfect match
 * Also return a version of the line with correct indentation if needs fixing
 */
export function matchLine(
  newLine: string,
  oldLines: string[],
  permissiveAboutIndentation: boolean = false,
): [number, boolean, string] {
  // Only match empty lines if it's the next one:
  if (newLine.trim() === "" && oldLines[0]?.trim() === "") {
    return [0, true, newLine.trim()];
  }

  for (let i = 0; i < oldLines.length; i++) {
    if (linesMatchPerfectly(newLine, oldLines[i])) {
      return [i, true, newLine];
    } else if (linesMatch(newLine, oldLines[i])) {
      // This is a way to fix indentation, but only for sufficiently long lines to avoid matching whitespace or short lines
      if (
        newLine.trimStart() === oldLines[i].trimStart() &&
        (permissiveAboutIndentation || newLine.trim().length > 8)
      ) {
        return [i, true, oldLines[i]];
      }
      return [i, false, newLine];
    }
  }

  return [-1, false, newLine];
}

/**
 * Convert a stream of arbitrary chunks to a stream of lines
 */
export async function* streamLines(
  streamCompletion: AsyncGenerator<string | ChatMessage>,
): LineStream {
  let buffer = "";
  for await (const update of streamCompletion) {
    const chunk =
      typeof update === "string" ? update : stripImages(update.content);
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      yield line;
    }
  }
  if (buffer.length > 0) {
    yield buffer;
  }
}
