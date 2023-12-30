import { distance } from "fastest-levenshtein";

function linesMatchPerfectly(lineA: string, lineB: string): boolean {
  return lineA === lineB;
}

function linesMatch(lineA: string, lineB: string): boolean {
  const d = distance(lineA, lineB);
  return d / Math.max(lineA.length, lineB.length) < 0.5 && lineA !== "";
}

/**
 * Return the index of the first match and whether it is a perfect match
 */
export function matchLine(
  newLine: string,
  oldLines: string[]
): [number, boolean] {
  for (let i = 0; i < oldLines.length; i++) {
    if (linesMatchPerfectly(newLine, oldLines[i])) {
      return [i, true];
    } else if (linesMatch(newLine, oldLines[i])) {
      return [i, false];
    }
  }

  return [-1, false];
}

/**
 * Convert a stream of arbitrary chunks to a stream of lines
 */
export async function* streamLines(
  streamCompletion: AsyncGenerator<string>
): AsyncGenerator<string> {
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
