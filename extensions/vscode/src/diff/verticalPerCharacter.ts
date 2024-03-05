import { matchLine } from "core/diff/util";

interface DiffBlock {
  startLine: number;
  endLine: number;
  replacement: string[];
}

interface LineUpdate {
  content: string;
  line: number;
  replace: boolean;
}

type DiffEvent = LineUpdate | DiffBlock;

/**
 * Returns a stream of characters, but with "undefined" inserted into the stream whenever there is a new line
 */
async function* streamWithLineBreaks(
  completionStream: AsyncGenerator<string>,
): AsyncGenerator<string | undefined> {
  for await (const chunk of completionStream) {
    if (chunk.includes("\n")) {
      const lines = chunk.split("\n");
      for (let i = 0; i < lines.length; i++) {
        yield lines[i];
        if (i < lines.length - 1) {
          yield undefined;
        }
      }
    } else {
      yield chunk;
    }
  }
}

async function* streamDiffEvents(
  completionStream: AsyncGenerator<string>,
  oldCode: string,
): AsyncGenerator<DiffEvent> {
  let remainingLines = oldCode.split("\n");
  let i = 0;
  let oldLine = remainingLines.shift();
  let newLine = "";
  let alreadyReplacedCurrentLine = false;

  for await (const chunk of streamWithLineBreaks(completionStream)) {
    if (chunk === undefined) {
      // Decide whether there is a match
      const matchIndex = matchLine(newLine, remainingLines);
      // Delete all of the lines in the middle
      // TODO

      // Start a new line
      oldLine = remainingLines.shift();
      newLine = "";
      alreadyReplacedCurrentLine = false;
      i++;
    } else {
      // Continue current line
      newLine += chunk;

      if (oldLine?.startsWith(newLine)) {
        // Match, do nothing
      } else {
        // Difference, send the update
        // This also handles when we are past all of the oldLines
        if (alreadyReplacedCurrentLine) {
          yield {
            content: chunk,
            line: i,
            replace: false,
          };
        } else {
          yield {
            content: newLine,
            line: i,
            replace: true,
          };
          alreadyReplacedCurrentLine = true;
        }
      }
    }
  }
}

// But you also want to stream between the diff blocks.
// So...not only do you want to stream DiffBlocks
// Next is stream lines: {line: string, type: "match" | ""}
