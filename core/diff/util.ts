import { distance } from "fastest-levenshtein";

export type LineStream = AsyncGenerator<string>;

function linesMatchPerfectly(lineA: string, lineB: string): boolean {
  return lineA === lineB && lineA !== "";
}

function linesMatch(lineA: string, lineB: string): boolean {
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
  oldLines: string[]
): [number, boolean, string] {
  for (let i = 0; i < oldLines.length; i++) {
    if (linesMatchPerfectly(newLine, oldLines[i])) {
      return [i, true, newLine];
    } else if (linesMatch(newLine, oldLines[i])) {
      // This is a way to fix indentation, but only for sufficiently long lines to avoid matching whitespace or short lines
      if (newLine === oldLines[i].trimStart() && newLine.trim().length > 8) {
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
export async function* streamLines(streamCompletion: LineStream): LineStream {
  let buffer = "";
  for await (const chunk of streamCompletion) {
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
