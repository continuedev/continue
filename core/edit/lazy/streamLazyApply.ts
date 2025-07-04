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

  let lines = streamFillUnchangedCode(
    lazyCompletionLines,
    oldCode,
    replacementFunction,
  );

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
        const replacementLines = replacementFunction(oldCode, newLines, buffer);
        let replacement = "";
        for await (const replacementLine of replacementLines) {
          yield replacementLine;
          newLines.push(replacementLine);
          replacement += replacementLine + "\n";
        }
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
      waitingForBuffer = true;
    } else {
      yield line;
      newLines.push(line);
    }
  }

  if (waitingForBuffer) {
    const replacementLines = replacementFunction(oldCode, newLines, buffer);
    for await (const replacementLine of replacementLines) {
      yield replacementLine;
      newLines.push(replacementLine);
    }
    for (const bufferedLine of buffer) {
      yield bufferedLine;
      newLines.push(bufferedLine);
    }
  }
}
