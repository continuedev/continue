import { DiffLine } from "..";
import { LineStream, matchLine } from "./util";

/**
 * https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/
 */
export async function* streamDiff(
  oldLines: string[],
  newLines: LineStream
): AsyncGenerator<DiffLine> {
  oldLines = [...oldLines]; // be careful

  // Greedy gives you alternating red/green
  // Buffering to wait until end of block avoids this
  let buffer: DiffLine[] = [];

  let newLineResult = await newLines.next();
  while (oldLines.length > 0 && !newLineResult.done) {
    const [matchIndex, isPerfectMatch, newLine] = matchLine(
      newLineResult.value,
      oldLines
    );

    if (matchIndex < 0) {
      // Empty buffer
      while (buffer.length) {
        yield buffer.shift()!;
      }

      // Insert new line
      yield { type: "new", line: newLine };
    } else {
      if (isPerfectMatch) {
        // Empty buffer
        while (buffer.length) {
          yield buffer.shift()!;
        }
      }

      // Insert all deleted lines before match
      for (let i = 0; i < matchIndex; i++) {
        yield { type: "old", line: oldLines.shift()! };
      }

      if (isPerfectMatch) {
        // Same
        yield { type: "same", line: oldLines.shift()! };
      } else {
        // Delete old and buffer insertion of the new
        yield { type: "old", line: oldLines.shift()! };
        buffer.push({ type: "new", line: newLine });
      }
    }

    newLineResult = await newLines.next();
  }

  // Once at the edge, only one choice
  if (newLineResult.done === true && oldLines.length > 0) {
    for (let oldLine of oldLines) {
      yield { type: "old", line: oldLine };
    }
  }

  // Empty the buffer - (important that this is between the above and below loops)
  while (buffer.length) {
    yield buffer.shift()!;
  }

  if (!newLineResult.done && oldLines.length === 0) {
    yield { type: "new", line: newLineResult.value };
    for await (const newLine of newLines) {
      yield { type: "new", line: newLine };
    }
  }
}
