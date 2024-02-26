import { DiffLine } from "..";
import { LineStream, matchLine } from "./util";

/**
 * https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/
 * Invariants:
 * - new + same = newLines.length
 * - old + same = oldLines.length
 * ^ (above two guarantee that all lines get represented)
 * - Lines are always output in order, at least among old and new separately
 */
export async function* streamDiff(
  oldLines: string[],
  newLines: LineStream
): AsyncGenerator<DiffLine> {
  const mutatedOldLines = [...oldLines]; // be careful
  let seenIndentationMistake = false;

  let newLineResult = await newLines.next();
  const postponedLines: string[] = [];
  while (oldLines.length > 0 && !newLineResult.done) {
    const [matchIndex, isPerfectMatch, newLine] = matchLine(
      newLineResult.value,
      mutatedOldLines,
      seenIndentationMistake
    );
    if (!seenIndentationMistake && newLineResult.value !== newLine) {
      seenIndentationMistake = true;
    }

    if (matchIndex < 0) {
      // Insert new line
      postponedLines.push(newLine);
    } else {
      // Insert all deleted lines before match
      for (let i = 0; i < matchIndex; i++) {
        yield { type: "old", line: mutatedOldLines.shift()! };
      }
      if (postponedLines.length > 0) {
        for (let i = 0; i <= postponedLines.length; i++) {
          yield { type: "new", line: postponedLines.shift()! };
        }
      }

      if (isPerfectMatch) {
        // Same
        yield { type: "same", line: mutatedOldLines.shift()! };
      } else {
        // Delete old line and insert the new
        yield { type: "old", line: mutatedOldLines.shift()! };
        postponedLines.push(newLine);
      }
    }

    newLineResult = await newLines.next();
  }

  // Once at the edge, only one choice
  if (newLineResult.done === true && mutatedOldLines.length > 0) {
    for (let oldLine of oldLines) {
      yield { type: "old", line: oldLine };
    }
  }

  if (!newLineResult.done && mutatedOldLines.length === 0) {
    yield { type: "new", line: newLineResult.value };
    for await (const newLine of newLines) {
      yield { type: "new", line: newLine };
    }
  }

  if (postponedLines.length > 0) {
    for await (const newLine of postponedLines) {
      yield { type: "new", line: newLine };
    }
  }
}
