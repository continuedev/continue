import {
  filterLeadingAndTrailingNewLineInsertion,
  filterLeadingNewline,
  removeTrailingWhitespace,
} from "../../autocomplete/filtering/streamTransforms/lineStream.js";
import { streamDiff } from "../../diff/streamDiff.js";
import { LineStream, streamLines } from "../../diff/util.js";
import { DiffLine, ILLM } from "../../index.js";
import { stopAtLinesWithMarkdownSupport } from "../../utils/streamMarkdownUtils.js";

import { lazyApplyPromptForModel, UNCHANGED_CODE } from "./prompts.js";
import { BUFFER_LINES_BELOW, getReplacementWithLlm } from "./replace.js";

export async function* streamLazyApply(
  oldCode: string,
  filename: string,
  newCode: string,
  llm: ILLM,
  abortController: AbortController,
): AsyncGenerator<DiffLine> {
  const promptFactory = lazyApplyPromptForModel(llm.model, llm.providerName);
  if (!promptFactory) {
    throw new Error(`Lazy apply not supported for model ${llm.model}`);
  }

  const promptMessages = promptFactory(oldCode, filename, newCode);
  const lazyCompletion = llm.streamChat(promptMessages, abortController.signal);

  // Do find and replace over the lazy edit response
  async function* replacementFunction(
    oldCode: string,
    linesBefore: string[],
    linesAfter: string[],
  ): AsyncGenerator<string> {
    for await (const line of getReplacementWithLlm(
      oldCode,
      linesBefore,
      linesAfter,
      llm,
      abortController,
    )) {
      yield line;
    }
  }

  let lazyCompletionLines = streamLines(lazyCompletion, true);

  lazyCompletionLines = stopAtLinesWithMarkdownSupport(
    lazyCompletionLines,
    filename,
  );

  lazyCompletionLines = filterLeadingNewline(lazyCompletionLines);
  lazyCompletionLines = removeTrailingWhitespace(lazyCompletionLines);

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

async function* streamFillUnchangedCode(
  lines: LineStream,
  oldCode: string,
  replacementFunction: (
    oldCode: string,
    linesBefore: string[],
    linesAfter: string[],
  ) => AsyncGenerator<string>,
): LineStream {
  const newLines = [];
  let buffer = [];
  let waitingForBuffer = false;

  for await (const line of lines) {
    if (waitingForBuffer) {
      buffer.push(line);

      if (buffer.length >= BUFFER_LINES_BELOW) {
        // Find the replacement and continue streaming once we have it
        const replacementLines = replacementFunction(oldCode, newLines, buffer);
        let replacement = "";
        for await (const replacementLine of replacementLines) {
          yield replacementLine;
          newLines.push(replacementLine);
          replacement += replacementLine + "\n";
        }
        // Yield the buffered lines
        for (const bufferedLine of buffer) {
          yield bufferedLine;
          newLines.push(bufferedLine);
        }

        waitingForBuffer = false;
        buffer = [];
        continue;
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
    const replacementLines = replacementFunction(oldCode, newLines, buffer);
    for await (const replacementLine of replacementLines) {
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
