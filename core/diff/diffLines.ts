import { DiffLine } from "..";
import { matchLine } from "./util";

/**
 * https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/
 */
export async function* streamDiff(
  oldLines: string[],
  newLines: AsyncGenerator<string>
): AsyncGenerator<DiffLine> {
  oldLines = [...oldLines]; // be careful

  let newLineResult = await newLines.next();
  while (oldLines.length > 0 && !newLineResult.done) {
    const newLine = newLineResult.value;
    const [matchIndex, isPerfectMatch] = matchLine(newLine, oldLines);

    if (matchIndex < 0) {
      yield { type: "new", line: newLine };
    } else {
      for (let i = 0; i < matchIndex; i++) {
        yield { type: "old", line: oldLines.shift()! };
      }
      if (isPerfectMatch) {
        yield { type: "same", line: oldLines.shift()! };
      } else {
        yield { type: "old", line: oldLines.shift()! };
        yield { type: "new", line: newLine };
      }
    }

    newLineResult = await newLines.next();
  }

  // Once at the edge, only one choice
  if (newLineResult.done === true && oldLines.length > 0) {
    for (let oldLine of oldLines) {
      yield { type: "old", line: oldLine };
    }
  } else if (!newLineResult.done && oldLines.length === 0) {
    yield { type: "new", line: newLineResult.value };
    for await (const newLine of newLines) {
      yield { type: "new", line: newLine };
    }
  }
}
