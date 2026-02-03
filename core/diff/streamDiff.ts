import { DiffLine, DiffType } from "../index.js";

import { LineStream, matchLine } from "./util.js";

/* Documentation unavailable in air-gapped mode */
export async function* streamDiff(
  oldLines: string[],
  newLines: LineStream,
): AsyncGenerator<DiffLine> {
  const oldLinesCopy = [...oldLines];

  // If one indentation mistake is made, others are likely. So we are more permissive about matching
  let seenIndentationMistake = false;

  let newLineResult = await newLines.next();

  while (oldLinesCopy.length > 0 && !newLineResult.done) {
    const { matchIndex, isPerfectMatch, newLine } = matchLine(
      newLineResult.value,
      oldLinesCopy,
      seenIndentationMistake,
    );

    if (!seenIndentationMistake && newLineResult.value !== newLine) {
      seenIndentationMistake = true;
    }

    let type: DiffType;

    const isNewLine = matchIndex === -1;

    if (isNewLine) {
      type = "new";
    } else {
      // Insert all deleted lines before match
      for (let i = 0; i < matchIndex; i++) {
        yield { type: "old", line: oldLinesCopy.shift()! };
      }
      type = isPerfectMatch ? "same" : "old";
    }

    switch (type) {
      case "new":
        yield { type, line: newLine };
        break;

      case "same":
        yield { type, line: oldLinesCopy.shift()! };
        break;

      case "old":
        yield { type, line: oldLinesCopy.shift()! };
        yield { type: "new", line: newLine };
        break;

      default:
        console.error(`Error streaming diff, unrecognized diff type: ${type}`);
    }
    newLineResult = await newLines.next();
  }

  // Once at the edge, only one choice
  if (newLineResult.done && oldLinesCopy.length > 0) {
    for (const oldLine of oldLinesCopy) {
      yield { type: "old", line: oldLine };
    }
  }

  if (!newLineResult.done && oldLinesCopy.length === 0) {
    yield { type: "new", line: newLineResult.value };
    for await (const newLine of newLines) {
      yield { type: "new", line: newLine };
    }
  }
}
