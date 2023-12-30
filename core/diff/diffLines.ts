import { matchLine } from "./util";

interface DiffLineNew {
  type: "new";
  newLine: string;
}

interface DiffLineOldOrSame {
  type: "old" | "same";
}

export type DiffLine = DiffLineNew | DiffLineOldOrSame;

/**
 * https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/
 */
export async function* streamDiff(
  oldLines: string[],
  newLines: AsyncGenerator<string>
): AsyncGenerator<DiffLine> {
  let newLineResult = await newLines.next();
  while (oldLines.length > 0 && !newLineResult.done) {
    const newLine = newLineResult.value;
    const [matchIndex, isPerfectMatch] = matchLine(newLine, oldLines);

    if (matchIndex < 0) {
      yield { type: "new", newLine };
    } else {
      for (let i = 0; i < matchIndex; i++) {
        yield { type: "old" };
      }
      if (isPerfectMatch) {
        yield { type: "same" };
      } else {
        yield { type: "old" };
        yield { type: "new", newLine };
      }
    }

    newLineResult = await newLines.next();
  }

  // Once at the edge, only one choice
  if (newLineResult.done === true && oldLines.length > 0) {
    for (let _ of oldLines) {
      yield { type: "old" };
    }
  } else if (!newLineResult.done && oldLines.length === 0) {
    for await (const newLine of newLines) {
      yield { type: "new", newLine };
    }
  }
}
