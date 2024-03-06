import { ChatMessage, DiffLine, ILLM } from "..";
import {
  filterCodeBlockLines,
  filterEnglishLinesAtEnd,
  filterEnglishLinesAtStart,
  filterLeadingAndTrailingNewLineInsertion,
  fixCodeLlamaFirstLineIndentation,
} from "../autocomplete/lineStream";
import { streamDiff } from "../diff/streamDiff";
import { streamLines } from "../diff/util";
import { gptEditPrompt } from "../llm/templates/edit";
import { dedentAndGetCommonWhitespace, renderPromptTemplate } from "../util";

function constructPrompt(
  codeToEdit: string,
  llm: ILLM,
  userInput: string,
  language: string | undefined,
): string | ChatMessage[] {
  const template = llm.promptTemplates?.edit ?? gptEditPrompt;
  return renderPromptTemplate(template, [], {
    userInput,
    codeToEdit,
    language: language || "",
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
  oldCode: string,
  llm: ILLM,
  input: string,
  language: string | undefined,
): AsyncGenerator<DiffLine> {
  // Strip common indentation for the LLM, then add back after generation
  const [withoutIndentation, commonIndentation] =
    dedentAndGetCommonWhitespace(oldCode);
  oldCode = withoutIndentation;
  const oldLines = oldCode.split("\n");
  const prompt = constructPrompt(oldCode, llm, input, language);
  const inept = modelIsInept(llm.model);

  const completion =
    typeof prompt === "string"
      ? llm.streamComplete(prompt)
      : llm.streamChat(prompt);

  let lines = streamLines(completion);

  if (inept) {
    lines = filterEnglishLinesAtStart(lines);
  }
  lines = filterCodeBlockLines(lines);
  if (inept) {
    lines = filterEnglishLinesAtEnd(fixCodeLlamaFirstLineIndentation(lines));
  }

  let diffLines = streamDiff(oldLines, lines);
  diffLines = addIndentation(diffLines, commonIndentation);
  diffLines = filterLeadingAndTrailingNewLineInsertion(diffLines);

  for await (let diffLine of diffLines) {
    yield diffLine;
  }
}
