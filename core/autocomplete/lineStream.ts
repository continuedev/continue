import { distance } from "fastest-levenshtein";
import { LineStream } from "../diff/util.js";
import { DiffLine } from "../index.js";

export type LineFilter = (args: {
  lines: LineStream;
  fullStop: () => void;
}) => LineStream;

export async function* noTopLevelKeywordsMidline(
  lines: LineStream,
  topLevelKeywords: string[],
  fullStop: () => void,
): LineStream {
  for await (const line of lines) {
    for (const keyword of topLevelKeywords) {
      const indexOf = line.indexOf(`${keyword} `);
      if (indexOf >= 0 && line.slice(indexOf - 1, indexOf).trim() !== "") {
        yield line.slice(0, indexOf);
        fullStop();
        break;
      }
    }
    yield line;
  }
}

export async function* avoidPathLine(
  stream: LineStream,
  comment: string,
): LineStream {
  // Snippets are inserted as comments with a line at the start '// Path: <PATH>'.
  // Sometimes the model with copy this pattern, which is unwanted
  for await (const line of stream) {
    // Also filter lines that are empty comments
    if (line.startsWith(`${comment} Path: `) || line.trim() === comment) {
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

const bracketEnding = [")", "]", "}", ";"];
function isBracketEnding(line: string): boolean {
  return line
    .trim()
    .split("")
    .some((char) => bracketEnding.includes(char));
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return i;
}

export function lineIsRepeated(a: string, b: string): boolean {
  if (a.length <= 4 || b.length <= 4) {
    return false;
  }

  const aTrim = a.trim();
  const bTrim = b.trim();
  return (
    commonPrefixLength(aTrim, bTrim) > 12 ||
    distance(aTrim, bTrim) / bTrim.length < 0.1
  );
}

export async function* stopAtSimilarLine(
  stream: LineStream,
  line: string,
  fullStop: () => void,
): AsyncGenerator<string> {
  const trimmedLine = line.trim();
  const lineIsBracketEnding = isBracketEnding(trimmedLine);
  for await (const nextLine of stream) {
    if (nextLine === line) {
      fullStop();
      break;
    }

    if (lineIsBracketEnding && trimmedLine.trim() === nextLine.trim()) {
      yield nextLine;
      continue;
    }

    if (lineIsRepeated(nextLine, trimmedLine)) {
      fullStop();
      break;
    }
    yield nextLine;
  }
}

const LINES_TO_STOP_AT = ["# End of file.", "<STOP EDITING HERE"];

export async function* stopAtLines(
  stream: LineStream,
  fullStop: () => void,
): LineStream {
  for await (const line of stream) {
    if (LINES_TO_STOP_AT.some((stopAt) => line.trim().includes(stopAt))) {
      fullStop();
      break;
    }
    yield line;
  }
}

const PREFIXES_TO_SKIP = ["<COMPLETION>"];
export async function* skipPrefixes(lines: LineStream): LineStream {
  let isFirstLine = true;
  for await (const line of lines) {
    if (isFirstLine) {
      const match = PREFIXES_TO_SKIP.find((prefix) => line.startsWith(prefix));
      if (match) {
        yield line.slice(match.length);
        continue;
      }
      isFirstLine = false;
    }
    yield line;
  }
}

const LINES_TO_SKIP = ["</START EDITING HERE>"];

export async function* skipLines(stream: LineStream): LineStream {
  for await (const line of stream) {
    if (!LINES_TO_SKIP.some((skipAt) => line.startsWith(skipAt))) {
      yield line;
    }
  }
}

const LINES_TO_REMOVE_BEFORE_START = [
  "<COMPLETION>",
  "[CODE]",
  "<START EDITING HERE>",
];

function shouldRemoveLineBeforeStart(line: string): boolean {
  return (
    line.trimStart().startsWith("```") ||
    LINES_TO_REMOVE_BEFORE_START.some((l) => line.trim() === l)
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
      }
      seenValidLine = true;
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

    if (line.startsWith("```")) {
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
    line.startsWith("here's") ||
    line.startsWith("sure, here") ||
    line.startsWith("sure thing") ||
    line.startsWith("sure!") ||
    line.startsWith("to fill") ||
    line.startsWith("the code should")
  ) {
    return true;
  }

  return false;
}

export async function* filterEnglishLinesAtStart(lines: LineStream) {
  let i = 0;
  let wasEnglishFirstLine = false;
  for await (const line of lines) {
    if (i === 0 && line.trim() === "") {
      continue;
    }
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
  for await (const line of lines) {
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
  for await (const line of lines) {
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
  for await (const diffLine of diffLines) {
    const isBlankLineInsertion =
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

export async function* stopAtRepeatingLines(
  lines: LineStream,
  fullStop: () => void,
): LineStream {
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
      fullStop();
      return;
    }
  }

  while (repeatedLines.length > 0) {
    yield repeatedLines.shift()!;
  }
}
