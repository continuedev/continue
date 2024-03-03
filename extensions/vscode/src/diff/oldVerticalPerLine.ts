import { matchLine } from "core/diff/util";

interface NextLineEvent {
  type: "nextLine";
}

interface InsertDeletionEvent {
  type: "insertDeletion";
  lines: string[];
  aboveLineAtIndex: number;
}

interface ReplaceLineEvent {
  type: "replaceLine";
  index: number;
  newLine: string;
}

interface InsertLineEvent {
  type: "insertLine";
  aboveLineAtIndex: number;
  line: string;
}

type VerticalPerLineDiffEvent =
  | NextLineEvent
  | InsertDeletionEvent
  | ReplaceLineEvent
  | InsertLineEvent;

async function* streamVerticalPerLineDiff(
  lineGenerator: AsyncGenerator<string>,
  oldCode: string,
): AsyncGenerator<VerticalPerLineDiffEvent> {
  const remainingLines = oldCode.split("\n");
  let index = 0; // Index in terms of oldCode

  let accumulatedDeletedLines: string[] = [];

  for await (const line of lineGenerator) {
    const [matchIndex, isPerfectMatch] = matchLine(line, remainingLines);

    if (matchIndex < 0) {
      // No match, so insert above remainingLines[0]
      yield {
        type: "insertLine",
        aboveLineAtIndex: index,
        line,
      };
    } else if (matchIndex === 0) {
      if (isPerfectMatch) {
        // Perfect match of the next line, so insert and clear existing block
        yield {
          type: "insertDeletion",
          lines: accumulatedDeletedLines,
          aboveLineAtIndex: index,
        };
        remainingLines.shift();
        accumulatedDeletedLines = [];
      } else {
        // Replace next line, so part of same block if one exists
        yield {
          type: "replaceLine",
          index,
          newLine: line,
        };

        let nextLine = remainingLines.shift();
        nextLine && accumulatedDeletedLines.push();
      }
    } else {
      // Already in a block, which is disconnected from this one, so insert and clear it
      accumulatedDeletedLines.push(...remainingLines.splice(0, matchIndex));
      if (isPerfectMatch) {
        yield {
          type: "insertDeletion",
          lines: accumulatedDeletedLines,
          aboveLineAtIndex: index - accumulatedDeletedLines.length,
        };
        accumulatedDeletedLines = [];
      } else {
        // Add to the current block all of the lines in between, then replace with the new line
        yield {
          type: "insertLine",
          aboveLineAtIndex: index - accumulatedDeletedLines.length,
          line,
        };
      }
    }

    index += Math.max(0, matchIndex);
    remainingLines.splice(0, matchIndex);
  }
}
