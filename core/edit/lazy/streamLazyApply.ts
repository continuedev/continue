import {
  filterLeadingAndTrailingNewLineInsertion,
  filterLeadingNewline,
  removeTrailingWhitespace,
} from "../../autocomplete/filtering/streamTransforms/lineStream.js";
import { streamDiff } from "../../diff/streamDiff.js";
import { LineStream, streamLines } from "../../diff/util.js";
import { DiffLine, ILLM } from "../../index.js";

import { lazyApplyPromptForModel, UNCHANGED_CODE } from "./prompts.js";
import { BUFFER_LINES_BELOW, getReplacementWithLlm } from "./replace.js";

function headerIsMarkdown(header: string): boolean {
  return (
    header === "md" ||
    header === "markdown" ||
    header === "gfm" ||
    header === "github-markdown" ||
    header.includes(" md") ||
    header.includes(" markdown") ||
    header.includes(" gfm") ||
    header.includes(" github-markdown") ||
    header.split(" ")[0]?.split(".").pop() === "md" ||
    header.split(" ")[0]?.split(".").pop() === "markdown" ||
    header.split(" ")[0]?.split(".").pop() === "gfm"
  );
}

function isMarkdownFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ["md", "markdown", "gfm"].includes(ext || "");
}

async function* stopAtLinesWithMarkdownSupport(
  lines: LineStream,
  filename: string,
): LineStream {
  if (!isMarkdownFile(filename)) {
    for await (const line of lines) {
      if (line.trim() === "```") {
        return;
      }
      yield line;
    }
    return;
  }

  const allLines: string[] = [];
  for await (const line of lines) {
    allLines.push(line);
  }

  const source = allLines.join("\n");
  if (!source.match(/```(\w*|.*)(md|markdown|gfm|github-markdown)/)) {
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].trim() === "```") {
        for (let j = 0; j < i; j++) {
          yield allLines[j];
        }
        return;
      }
      yield allLines[i];
    }
    return;
  }

  let nestCount = 0;
  const trimmedLines = allLines.map((l) => l.trim());

  for (let i = 0; i < trimmedLines.length; i++) {
    const line = trimmedLines[i];

    if (nestCount > 0) {
      if (line.match(/^`+$/)) {
        let remainingBareBackticks = 0;
        for (let j = i + 1; j < trimmedLines.length; j++) {
          if (trimmedLines[j].match(/^`+$/)) {
            remainingBareBackticks++;
          }
        }

        if (remainingBareBackticks === 0) {
          nestCount = 0;
          for (let j = 0; j < i; j++) {
            yield allLines[j];
          }
          return;
        }
      } else if (line.startsWith("```")) {
        nestCount++;
      }
    } else {
      if (line.startsWith("```")) {
        const header = line.replaceAll("`", "");
        const isMarkdown = headerIsMarkdown(header);

        if (isMarkdown) {
          nestCount = 1;
        }
      }
    }
  }

  for (const line of allLines) {
    yield line;
  }
}

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
