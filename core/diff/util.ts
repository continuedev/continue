import { distance } from "fastest-levenshtein";
import { ChatMessage } from "../index.js";
import { stripImages } from "../llm/images.js";

export type LineStream = AsyncGenerator<string>;

export type MatchLineResult = {
  /**
   * -1 if it's a new line, otherwise the index of the first match
   * in the old lines.
   */
  matchIndex: number;
  isPerfectMatch: boolean;
  newLine: string;
};

function linesMatchPerfectly(lineA: string, lineB: string): boolean {
  return lineA === lineB && lineA !== "";
}

const END_BRACKETS = ["}", "});", "})"];

function linesMatch(lineA: string, lineB: string, linesBetween = 0): boolean {
  // Require a perfect (without padding) match for these lines
  // Otherwise they are edit distance 1 from empty lines and other single char lines (e.g. each other)
  if (["}", "*", "});", "})"].includes(lineA.trim())) {
    return lineA.trim() === lineB.trim();
  }

  const d = distance(lineA, lineB);

  return (
    // Should be more unlikely for lines to fuzzy match if they are further away
    (d / Math.max(lineA.length, lineB.length) <=
      Math.max(0, 0.48 - linesBetween * 0.06) ||
      lineA.trim() === lineB.trim()) &&
    lineA.trim() !== ""
  );
}

/**
 * Used to find a match for a new line in an array of old lines.
 *
 * Return the index of the first match and whether it is a perfect match
 * Also return a version of the line with correct indentation if needs fixing
 */
export function matchLine(
  newLine: string,
  oldLines: string[],
  permissiveAboutIndentation = false,
): MatchLineResult {
  // Only match empty lines if it's the next one:
  if (newLine.trim() === "" && oldLines[0]?.trim() === "") {
    return {
      matchIndex: 0,
      isPerfectMatch: true,
      newLine: newLine.trim(),
    };
  }

  const isEndBracket = END_BRACKETS.includes(newLine.trim());

  for (let i = 0; i < oldLines.length; i++) {
    // Don't match end bracket lines if too far away
    if (i > 4 && isEndBracket) {
      return { matchIndex: -1, isPerfectMatch: false, newLine };
    }

    if (linesMatchPerfectly(newLine, oldLines[i])) {
      return { matchIndex: i, isPerfectMatch: true, newLine };
    }
    if (linesMatch(newLine, oldLines[i], i)) {
      // This is a way to fix indentation, but only for sufficiently long lines to avoid matching whitespace or short lines
      if (
        newLine.trimStart() === oldLines[i].trimStart() &&
        (permissiveAboutIndentation || newLine.trim().length > 8)
      ) {
        return {
          matchIndex: i,
          isPerfectMatch: true,
          newLine: oldLines[i],
        };
      }
      return { matchIndex: i, isPerfectMatch: false, newLine };
    }
  }

  return { matchIndex: -1, isPerfectMatch: false, newLine };
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
