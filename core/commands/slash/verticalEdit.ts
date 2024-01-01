import { ContextItemWithId, DiffLine, ILLM, SlashCommand } from "../..";
import { streamDiff } from "../../diff/diffLines";
import { LineStream, streamLines } from "../../diff/util";
import { gptEditPrompt } from "../../llm/templates/edit";
import { dedentAndGetCommonWhitespace, renderPromptTemplate } from "../../util";
import {
  RangeInFileWithContents,
  contextItemToRangeInFileWithContents,
} from "../util";

function shouldRemoveLineBeforeStart(line: string): boolean {
  return line.startsWith("```");
}

async function* filterLines(rawLines: LineStream): LineStream {
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
  userInput: string
): string {
  const template = llm.promptTemplates?.edit ?? gptEditPrompt;
  const rendered = renderPromptTemplate(template, [], {
    userInput,
    codeToEdit,
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

export async function* streamDiffLines(
  oldCode: string,
  llm: ILLM,
  input: string
): AsyncGenerator<DiffLine> {
  // Strip common indentation for the LLM, then add back after generation
  const [withoutIndentation, commonIndentation] =
    dedentAndGetCommonWhitespace(oldCode);
  oldCode = withoutIndentation;
  const prompt = constructPrompt(oldCode, llm, input);

  const completion = llm.streamComplete(prompt);
  const newLines = filterLines(streamLines(completion));
  const diffLineGenerator = addIndentation(
    streamDiff(oldCode.split("\n"), newLines),
    commonIndentation
  );

  for await (let diffLine of diffLineGenerator) {
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

    const diffLineGenerator = streamDiffLines(rif.contents, llm, input);

    for await (const diffLine of diffLineGenerator) {
      await ide.verticalDiffUpdate(filepath, startLine, endLine, diffLine);
    }
  },
};

export default VerticalEditSlashCommand;
