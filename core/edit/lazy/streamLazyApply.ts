import {
  filterLeadingAndTrailingNewLineInsertion,
  filterLeadingNewline,
  stopAtLines,
} from "../../autocomplete/lineStream.js";
import { streamDiff } from "../../diff/streamDiff.js";
import { LineStream, streamLines } from "../../diff/util.js";
import { DiffLine, ILLM } from "../../index.js";
import { lazyApplyPromptForModel, UNCHANGED_CODE } from "./prompts.js";

export async function* streamLazyApply(
  oldCode: string,
  filename: string,
  newCode: string,
  llm: ILLM,
): AsyncGenerator<DiffLine> {
  const promptFactory = lazyApplyPromptForModel(llm.model, llm.providerName);
  if (!promptFactory) {
    throw new Error(`Lazy apply not supported for model ${llm.model}`);
  }

  const promptMessages = promptFactory(oldCode, filename, newCode);
  const lazyCompletion = llm.streamChat(promptMessages);

  // Do find and replace over the lazy edit response
  async function replacementFunction(
    oldCode: string,
    linesBefore: string[],
    linesAfter: string[],
  ): Promise<string> {
    let r = getReplacementByMatching(oldCode, linesBefore, linesAfter);
    if (r) {
      return r;
    }
    r = await getReplacementWithLlm(oldCode, linesBefore, linesAfter, llm);
    if (r) {
      return r;
    }
    return "// NO REPLACEMENT FOUND";
  }
  let lazyCompletionLines = streamLines(lazyCompletion, true);
  // Process line output
  // lazyCompletionLines = filterEnglishLinesAtStart(lazyCompletionLines);
  lazyCompletionLines = stopAtLines(lazyCompletionLines, () => {}, ["```"]);
  lazyCompletionLines = filterLeadingNewline(lazyCompletionLines);

  // Fill in unchanged code
  let lines = streamFillUnchangedCode(
    lazyCompletionLines,
    oldCode,
    replacementFunction,
  );

  // Convert output to diff
  const oldLines = oldCode.split(/\r?\n/);
  let diffLines = streamDiff(oldLines, lines);
  diffLines = filterLeadingAndTrailingNewLineInsertion(diffLines);
  for await (const diffLine of diffLines) {
    yield diffLine;
  }
}

const BUFFER_LINES_BELOW = 2;
async function* streamFillUnchangedCode(
  lines: LineStream,
  oldCode: string,
  replacementFunction: (
    oldCode: string,
    linesBefore: string[],
    linesAfter: string[],
  ) => Promise<string>,
): LineStream {
  const newLines = [];
  let buffer = [];
  let waitingForBuffer = false;

  for await (const line of lines) {
    if (waitingForBuffer) {
      buffer.push(line);

      if (buffer.length >= BUFFER_LINES_BELOW) {
        // Find the replacement and continue streaming once we have it
        const replacement = await replacementFunction(
          oldCode,
          newLines,
          buffer,
        );
        for (const replacementLine of replacement.split("\n")) {
          yield replacementLine;
          newLines.push(replacementLine);
        }

        console.log("FOUND REPLACEMENT:\n", replacement);

        // Yield the buffered lines
        for (const bufferedLine of buffer) {
          yield bufferedLine;
          newLines.push(bufferedLine);
        }

        waitingForBuffer = false;
        buffer = [];
      } else {
        continue;
      }
    }

    if (line.includes(UNCHANGED_CODE)) {
      // Buffer so we can give the context of BUFFER_LINES_BELOW lines below
      waitingForBuffer = true;
      // TODO: If the UNCHANGED CODE is at the very top of the file we need to handle a bit differently
    } else {
      yield line;
      newLines.push(line);
    }
  }

  if (waitingForBuffer) {
    // If we're still waiting for a buffer, we've reached the end of the stream
    // and we should just look for the replacement with what we have
    const replacement = await replacementFunction(oldCode, newLines, buffer);
    for (const replacementLine of replacement.split("\n")) {
      yield replacementLine;
      newLines.push(replacementLine);
    }
    // Yield the buffered lines
    for (const bufferedLine of buffer) {
      yield bufferedLine;
      newLines.push(bufferedLine);
    }
  }
}

const MATCH_LINES_ABOVE = 1;
function getReplacementByMatching(
  oldCode: string,
  linesBefore: string[],
  linesAfter: string[],
): string | undefined {
  const oldLines = oldCode.split("\n");
  const linesToMatchAbove = MATCH_LINES_ABOVE;
  const linesToMatchBelow = Math.min(BUFFER_LINES_BELOW, linesAfter.length);

  // Get surrounding lines around the gap
  const beforeContext = linesBefore.slice(-linesToMatchAbove).join("\n");
  const afterContext = linesAfter.slice(0, linesToMatchBelow).join("\n");

  // Find the start index in the old code
  const startIndex = oldLines.findIndex((line, index) => {
    const chunk = oldLines.slice(index, index + linesToMatchAbove).join("\n");
    return chunk === beforeContext;
  });

  if (startIndex === -1) {
    return undefined; // Couldn't find matching start
  }

  // Find the end index in the old code
  const endIndex = oldLines.findIndex((line, index) => {
    if (index <= startIndex + linesToMatchBelow) return false;
    const chunk = oldLines.slice(index, index + linesToMatchBelow).join("\n");
    return chunk === afterContext;
  });

  if (endIndex === -1) {
    return undefined; // Couldn't find matching end
  }

  // Extract the replacement code
  const replacement = oldLines
    .slice(startIndex + linesToMatchAbove, endIndex)
    .join("\n");

  return replacement;
}

async function getReplacementWithLlm(
  oldCode: string,
  linesBefore: string[],
  linesAfter: string[],
  llm: ILLM,
): Promise<string> {
  return "// TODO";
}
