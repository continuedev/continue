import { ContextItemWithId, DiffLine, ILLM, SlashCommand } from "../..";
import { streamDiff } from "../../diff/diffLines";
import { streamLines } from "../../diff/util";
import { gptEditPrompt } from "../../llm/templates/edit";
import { renderPromptTemplate } from "../../util";
import {
  RangeInFileWithContents,
  contextItemToRangeInFileWithContents,
} from "../util";

function shouldRemoveLineBeforeStart(line: string): boolean {
  return line.startsWith("```");
}

async function* filterLines(
  rawLines: AsyncGenerator<string>
): AsyncGenerator<string> {
  let seenValidLine = false;
  for await (const line of rawLines) {
    if (!seenValidLine) {
      if (shouldRemoveLineBeforeStart(line)) {
        continue;
      } else {
        seenValidLine = true;
      }
    }
    yield line;
  }
}

function constructPrompt(oldLines: string[], llm: ILLM, input: string): string {
  const template = llm.promptTemplates?.edit ?? gptEditPrompt;
  const rendered = renderPromptTemplate(template, [], {
    userInput: input,
    codeToEdit: oldLines.join("\n"),
  });
  return typeof rendered === "string"
    ? rendered
    : rendered[rendered.length - 1].content;
}

export function streamDiffLines(
  oldLines: string[],
  llm: ILLM,
  input: string
): AsyncGenerator<DiffLine> {
  const prompt = constructPrompt(oldLines, llm, input);

  const completion = llm.streamComplete(prompt);
  const newLines = filterLines(streamLines(completion));
  const diffLineGenerator = streamDiff(oldLines, newLines);
  return diffLineGenerator;
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
    const oldLines = rif.contents.split("\n");
    const startLine = rif.range.start.line;
    const endLine = rif.range.end.line;
    const filepath = rif.filepath;

    const diffLineGenerator = streamDiffLines(oldLines, llm, input);

    for await (const diffLine of diffLineGenerator) {
      await ide.verticalDiffUpdate(filepath, startLine, endLine, diffLine);
    }
  },
};

export default VerticalEditSlashCommand;
