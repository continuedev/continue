import { DiffLine } from "../index.js";
import { LineStream, matchLine } from "./util.js";

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
  newLines: LineStream,
): AsyncGenerator<DiffLine> {
  // If one indentation mistake is made, others are likely. So we are more permissive about matching
  let seenIndentationMistake = false;

  let newLineResult = await newLines.next();

  while (oldLines.length > 0 && !newLineResult.done) {
    const { matchIndex, isPerfectMatch, newLine } = matchLine(
      newLineResult.value,
      oldLines,
      seenIndentationMistake,
    );

    if (!seenIndentationMistake && newLineResult.value !== newLine) {
      seenIndentationMistake = true;
    }

    let type: DiffLine["type"];

    let isLineRemoval = false;
    const isNewLine = matchIndex === -1;

    if (isNewLine) {
      type = "new";
    } else {
      // Insert all deleted lines before match
      for (let i = 0; i < matchIndex; i++) {
        yield { type: "old", line: oldLines.shift()! };
      }

      type = isPerfectMatch ? "same" : "old";
    }

    switch (type) {
      case "new":
        yield { type, line: newLine };
        break;

      case "same":
        yield { type, line: oldLines.shift()! };
        break;

      case "old":
        yield { type, line: oldLines.shift()! };

        if (oldLines[0] !== newLine) {
          yield { type: "new", line: newLine };
        } else {
          isLineRemoval = true;
        }

        break;

      default:
        console.error(`Error streaming diff, unrecognized diff type: ${type}`);
    }

    if (!isLineRemoval) {
      newLineResult = await newLines.next();
    }
  }

  // Once at the edge, only one choice
  if (newLineResult.done && oldLines.length > 0) {
    for (const oldLine of oldLines) {
      yield { type: "old", line: oldLine };
    }
  }

  if (!newLineResult.done && oldLines.length === 0) {
    yield { type: "new", line: newLineResult.value };
    for await (const newLine of newLines) {
      yield { type: "new", line: newLine };
    }
  }
}
