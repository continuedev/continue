import { ContextItemWithId, DiffLine, ILLM, SlashCommand } from "../..";
import { streamDiff } from "../../diff/streamDiff";
import { LineStream, streamLines } from "../../diff/util";
import { gptEditPrompt } from "../../llm/templates/edit";
import {
  dedentAndGetCommonWhitespace,
  getMarkdownLanguageTagForFile,
  renderPromptTemplate,
} from "../../util";
import {
  RangeInFileWithContents,
  contextItemToRangeInFileWithContents,
} from "../util";

function shouldRemoveLineBeforeStart(line: string): boolean {
  return line.trimStart().startsWith("```") || line.trim() === "[CODE]";
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

async function* filterCodeBlockLines(rawLines: LineStream): LineStream {
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

function constructPrompt(
  codeToEdit: string,
  llm: ILLM,
  userInput: string,
  language: string | undefined
): string {
  const template = llm.promptTemplates?.edit ?? gptEditPrompt;
  const rendered = renderPromptTemplate(template, [], {
    userInput,
    codeToEdit,
    language: language || "",
  });
  return typeof rendered === "string"
    ? rendered
    : rendered[rendered.length - 1].content;
}

async function* addIndentation(
  diffLineGenerator: AsyncGenerator<DiffLine>,
  indentation: string
): AsyncGenerator<DiffLine> {
  for await (const diffLine of diffLineGenerator) {
    yield {
      ...diffLine,
      line: indentation + diffLine.line,
    };
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

async function* filterEnglishLines(lines: LineStream) {
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

async function* fixCodeLlamaFirstLineIndentation(lines: LineStream) {
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

function modelIsInept(model: string): boolean {
  return !(model.includes("gpt") || model.includes("claude"));
}

async function* filterLeadingAndTrailingNewLineInsertion(
  diffLines: AsyncGenerator<DiffLine>
): AsyncGenerator<DiffLine> {
  let isFirst = true;
  let buffer: DiffLine[] = [];
  for await (let diffLine of diffLines) {
    let isBlankLineInsertion =
      diffLine.type === "new" &&
      (diffLine.line.trim() === "" || diffLine.line.trim() === "```");
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

export async function* streamDiffLines(
  oldCode: string,
  llm: ILLM,
  input: string,
  language: string | undefined
): AsyncGenerator<DiffLine> {
  // Strip common indentation for the LLM, then add back after generation
  const [withoutIndentation, commonIndentation] =
    dedentAndGetCommonWhitespace(oldCode);
  oldCode = withoutIndentation;
  const oldLines = oldCode.split("\n");
  const prompt = constructPrompt(oldCode, llm, input, language);
  const inept = modelIsInept(llm.model);

  console.log("Prompt:\n\n", prompt);

  const completion = llm.streamComplete(prompt);

  let lines = streamLines(completion);

  if (inept) {
    lines = filterEnglishLines(lines);
  }
  lines = filterCodeBlockLines(lines);
  if (inept) {
    lines = fixCodeLlamaFirstLineIndentation(lines);
  }

  let diffLines = streamDiff(oldLines, lines);
  diffLines = addIndentation(diffLines, commonIndentation);
  diffLines = filterLeadingAndTrailingNewLineInsertion(diffLines);

  for await (let diffLine of diffLines) {
    yield diffLine;
  }
}

const VerticalEditSlashCommand: SlashCommand = {
  name: "verticalEdit",
  description: "Edit highlighted code with vertical diff",
  run: async function* ({ ide, llm, input, contextItems }) {
    const contextItemToEdit = contextItems.find(
      (item: ContextItemWithId) =>
        item.editing && item.id.providerTitle === "code"
    );

    if (!contextItemToEdit) {
      yield "Highlight the code that you want to edit first";
      return;
    }

    const rif: RangeInFileWithContents =
      contextItemToRangeInFileWithContents(contextItemToEdit);
    const startLine = rif.range.start.line;
    const endLine = rif.range.end.line;
    const filepath = rif.filepath;

    const diffLineGenerator = streamDiffLines(
      rif.contents,
      llm,
      input,
      getMarkdownLanguageTagForFile(rif.filepath)
    );

    for await (const diffLine of diffLineGenerator) {
      await ide.verticalDiffUpdate(filepath, startLine, endLine, diffLine);
    }
  },
};

export default VerticalEditSlashCommand;
