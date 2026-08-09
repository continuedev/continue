import { distance } from "fastest-levenshtein";

import { ChatMessage } from "../index.js";
import { renderChatMessage } from "../util/messageContent.js";

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
    // trims trailing whitespaces from the lines before comparison
    //this ensures trailing spaces don't affect matching.
    const oldLineTrimmed = oldLines[i].trimEnd();
    const newLineTrimmed = newLine.trimEnd();

    // Don't match end bracket lines if too far away
    if (i > 4 && isEndBracket) {
      return { matchIndex: -1, isPerfectMatch: false, newLine };
    }

    if (linesMatchPerfectly(newLineTrimmed, oldLineTrimmed)) {
      return { matchIndex: i, isPerfectMatch: true, newLine };
    }
    if (linesMatch(newLineTrimmed, oldLineTrimmed, i)) {
      // This is a way to fix indentation, but only for sufficiently long lines to avoid matching whitespace or short lines
      if (
        newLineTrimmed.trimStart() === oldLineTrimmed.trimStart() &&
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
  log: boolean = false,
): LineStream {
  let allLines = [];

  let buffer = "";

  try {
    for await (const update of streamCompletion) {
      const chunk =
        typeof update === "string" ? update : renderChatMessage(update);
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        yield line;
        allLines.push(line);
      }

      // if (buffer === "" && chunk.endsWith("\n")) {
      //   yield "";
      //   allLines.push("");
      // }
    }
    if (buffer.length > 0) {
      yield buffer;
      allLines.push(buffer);
    }
  } finally {
    if (log) {
      console.log("Streamed lines: ", allLines.join("\n"));
    }
  }
}

export async function* generateLines<T>(lines: T[]): AsyncGenerator<T> {
  for (const line of lines) {
    yield line;
    // await new Promise((resolve, reject) => setTimeout(() => resolve(null), 50));
  }
}
