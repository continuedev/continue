import { distance } from "fastest-levenshtein";
import { DiffLine } from "..";
import { LineStream } from "../diff/util";

export async function* avoidPathLine(
  stream: LineStream,
  comment: string,
): LineStream {
  // Snippets are inserted as comments with a line at the start '// Path: <PATH>'.
  // Sometimes the model with copy this pattern, which is unwanted
  for await (const line of stream) {
    if (line.startsWith(comment + " Path: ")) {
      continue;
    }
    yield line;
  }
}

export async function* streamWithNewLines(stream: LineStream): LineStream {
  let firstLine = true;
  for await (const nextLine of stream) {
    if (!firstLine) {
      yield "\n";
    }
    firstLine = false;
    yield nextLine;
  }
}

const brackets = ["(", "[", "{", "`", '"""'];
const bracketsReverse = [")", "]", "}", "`", '"""'];

export async function* stopAtSimilarLine(
  stream: LineStream,
  line: string,
): AsyncGenerator<string> {
  line = line.trim();
  for await (const nextLine of stream) {
    if (
      bracketsReverse.includes(nextLine.trim()) &&
      bracketsReverse.includes(line.trim()) &&
      line.trim() === nextLine.trim()
    ) {
      continue;
    }

    const dist = distance(nextLine.trim(), line);
    let lineQualifies = nextLine.length > 4 && line.length > 4;
    if (lineQualifies && dist / line.length < 0.1) {
      break;
    }
    yield nextLine;
  }
}

const LINES_TO_STOP_AT = ["# End of file."];

export async function* stopAtLines(stream: LineStream): LineStream {
  for await (const line of stream) {
    if (LINES_TO_STOP_AT.includes(line)) {
      break;
    }
    yield line;
  }
}

function shouldRemoveLineBeforeStart(line: string): boolean {
  return (
    line.trimStart().startsWith("```") ||
    line.trim() === "[CODE]" ||
    line.trim() === ""
  );
}

function shouldChangeLineAndStop(line: string): string | undefined {
  if (line.trimStart() === "```") {
    return line;
  }

  if (line.includes("[/CODE]")) {
    return line.split("[/CODE]")[0].trimEnd();
  }

  return undefined;
}

export async function* filterCodeBlockLines(rawLines: LineStream): LineStream {
  let seenValidLine = false;

  let waitingToSeeIfLineIsLast = undefined;

  for await (const line of rawLines) {
    // Filter out starting ```
    if (!seenValidLine) {
      if (shouldRemoveLineBeforeStart(line)) {
        continue;
      } else {
        seenValidLine = true;
      }
    }

    // Filter out ending ```
    if (typeof waitingToSeeIfLineIsLast !== "undefined") {
      yield waitingToSeeIfLineIsLast;
      waitingToSeeIfLineIsLast = undefined;
    }

    const changedEndLine = shouldChangeLineAndStop(line);
    if (typeof changedEndLine === "string") {
      yield changedEndLine;
      return;
    }

    if (line === "```") {
      waitingToSeeIfLineIsLast = line;
    } else {
      yield line;
    }
  }
}

function isEnglishFirstLine(line: string) {
  line = line.trim().toLowerCase();
  if (line.endsWith(":") && !line.trimStart().startsWith("def")) {
    return true;
  }
  if (
    line.startsWith("here is") ||
    line.startsWith("sure, here") ||
    line.startsWith("sure thing") ||
    line.startsWith("sure!")
  ) {
    return true;
  }

  return false;
}

export async function* filterEnglishLinesAtStart(lines: LineStream) {
  let i = 0;
  let wasEnglishFirstLine = false;
  for await (let line of lines) {
    if (i === 0) {
      if (isEnglishFirstLine(line)) {
        wasEnglishFirstLine = true;
        i++;
        continue;
      }
    } else if (i === 1 && wasEnglishFirstLine && line.trim() === "") {
      i++;
      continue;
    }
    i++;
    yield line;
  }
}

function isEnglishPostExplanation(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.startsWith("explanation:") ||
    lower.startsWith("here is") ||
    lower.startsWith("here's how") ||
    lower.startsWith("the above")
  );
}

export async function* filterEnglishLinesAtEnd(lines: LineStream) {
  let finishedCodeBlock = false;
  for await (let line of lines) {
    if (line.trim() === "```") {
      finishedCodeBlock = true;
    }
    if (finishedCodeBlock && isEnglishPostExplanation(line)) {
      break;
    }
    yield line;
  }
}

export async function* fixCodeLlamaFirstLineIndentation(lines: LineStream) {
  let isFirstLine = true;
  for await (let line of lines) {
    if (isFirstLine && line.startsWith("  ")) {
      yield line.slice(2);
      isFirstLine = false;
    } else {
      yield line;
    }
  }
}

function isUselessLine(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "" || trimmed === "```" || trimmed.startsWith("// end");
}

export async function* filterLeadingAndTrailingNewLineInsertion(
  diffLines: AsyncGenerator<DiffLine>,
): AsyncGenerator<DiffLine> {
  let isFirst = true;
  let buffer: DiffLine[] = [];
  for await (let diffLine of diffLines) {
    let isBlankLineInsertion =
      diffLine.type === "new" && isUselessLine(diffLine.line);
    if (isFirst && isBlankLineInsertion) {
      isFirst = false;
      continue;
    }
    isFirst = false;

    if (isBlankLineInsertion) {
      buffer.push(diffLine);
    } else {
      if (diffLine.type === "old") {
        buffer = [];
      } else {
        while (buffer.length > 0) {
          yield buffer.shift()!;
        }
      }
      yield diffLine;
    }
  }
}

export async function* stopAtRepeatingLines(lines: LineStream): LineStream {
  const repeatedLines: string[] = [];
  for await (const line of lines) {
    if (repeatedLines.length === 0) {
      repeatedLines.push(line);
    } else if (repeatedLines.length < 3) {
      if (repeatedLines[repeatedLines.length - 1] === line) {
        repeatedLines.push(line);
      } else {
        while (repeatedLines.length > 0) {
          yield repeatedLines.shift()!;
        }
        yield line;
      }
    } else {
      yield repeatedLines[0];
      return;
    }
  }

  while (repeatedLines.length > 0) {
    yield repeatedLines.shift()!;
  }
}
