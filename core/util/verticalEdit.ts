import {
  filterCodeBlockLines,
  filterEnglishLinesAtEnd,
  filterEnglishLinesAtStart,
  filterLeadingAndTrailingNewLineInsertion,
  skipLines,
  stopAtLines,
} from "../autocomplete/lineStream.js";
import { streamDiff } from "../diff/streamDiff.js";
import { streamLines } from "../diff/util.js";
import {
  ChatMessage,
  DiffLine,
  ILLM,
  LLMFullCompletionOptions,
} from "../index.js";
import { gptEditPrompt } from "../llm/templates/edit.js";
import { Telemetry } from "./posthog.js";

function constructPrompt(
  prefix: string,
  highlighted: string,
  suffix: string,
  llm: ILLM,
  userInput: string,
  language: string | undefined,
): string | ChatMessage[] {
  const template = llm.promptTemplates?.edit ?? gptEditPrompt;
  return llm.renderPromptTemplate(template, [], {
    userInput,
    prefix,
    codeToEdit: highlighted,
    suffix,
    language: language ?? "",
  });
}

async function* addIndentation(
  diffLineGenerator: AsyncGenerator<DiffLine>,
  indentation: string,
): AsyncGenerator<DiffLine> {
  for await (const diffLine of diffLineGenerator) {
    yield {
      ...diffLine,
      line: indentation + diffLine.line,
    };
  }
}

function modelIsInept(model: string): boolean {
  return !(model.includes("gpt") || model.includes("claude"));
}

export async function* streamDiffLines(
  prefix: string,
  highlighted: string,
  suffix: string,
  llm: ILLM,
  input: string,
  language: string | undefined,
  onlyOneInsertion?: boolean,
): AsyncGenerator<DiffLine> {
  Telemetry.capture("inlineEdit", {
    model: llm.model,
    provider: llm.providerName,
  });

  // Strip common indentation for the LLM, then add back after generation
  let oldLines =
    highlighted.length > 0
      ? highlighted.split("\n")
      : // When highlighted is empty, we need to combine last line of prefix and first line of suffix to determine the line being edited
        [(prefix + suffix).split("\n")[prefix.split("\n").length - 1]];

  // But if that line is empty, we can assume we are insertion-only
  if (oldLines.length === 1 && oldLines[0].trim() === "") {
    oldLines = [];
  }

  const prompt = constructPrompt(
    prefix,
    highlighted,
    suffix,
    llm,
    input,
    language,
  );
  const inept = modelIsInept(llm.model);

  const options: LLMFullCompletionOptions = {};
  const completion =
    typeof prompt === "string"
      ? llm.streamComplete(prompt, { raw: true })
      : llm.streamChat(prompt);

  let lines = streamLines(completion);

  lines = filterEnglishLinesAtStart(lines);
  lines = filterCodeBlockLines(lines);
  lines = stopAtLines(lines, () => {});
  lines = skipLines(lines);
  if (inept) {
    // lines = fixCodeLlamaFirstLineIndentation(lines);
    lines = filterEnglishLinesAtEnd(lines);
  }

  let diffLines = streamDiff(oldLines, lines);
  diffLines = filterLeadingAndTrailingNewLineInsertion(diffLines);
  if (highlighted.length === 0) {
    const line = prefix.split("\n").slice(-1)[0];
    const indentation = line.slice(0, line.length - line.trimStart().length);
    diffLines = addIndentation(diffLines, indentation);
  }

  let seenGreen = false;
  for await (const diffLine of diffLines) {
    yield diffLine;
    if (diffLine.type === "new") {
      seenGreen = true;
    } else if (onlyOneInsertion && seenGreen && diffLine.type === "same") {
      break;
    }
  }
}
