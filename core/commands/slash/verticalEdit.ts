import { ContextItemWithId, DiffLine, ILLM, SlashCommand } from "../..";
import {
  filterCodeBlockLines,
  filterEnglishLinesAtEnd,
  filterEnglishLinesAtStart,
  filterLeadingAndTrailingNewLineInsertion,
  fixCodeLlamaFirstLineIndentation,
} from "../../autocomplete/lineStream";
import { streamDiff } from "../../diff/streamDiff";
import { streamLines } from "../../diff/util";
import { stripImages } from "../../llm/countTokens";
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
    : stripImages(rendered[rendered.length - 1].content);
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

function modelIsInept(model: string): boolean {
  return !(model.includes("gpt") || model.includes("claude"));
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

  const completion = llm.streamComplete(prompt);

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

const VerticalEditSlashCommand: SlashCommand = {
  name: "verticalEdit",
  description: "Edit selected code with vertical diff",
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
