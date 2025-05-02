import {
  ChatMessage,
  DiffLine,
  ILLM,
  Prediction,
  RuleWithSource,
  ToolResultChatMessage,
  UserChatMessage,
} from "../";
import {
  filterCodeBlockLines,
  filterEnglishLinesAtEnd,
  filterEnglishLinesAtStart,
  filterLeadingAndTrailingNewLineInsertion,
  removeTrailingWhitespace,
  skipLines,
  stopAtLines,
} from "../autocomplete/filtering/streamTransforms/lineStream";
import { streamDiff } from "../diff/streamDiff";
import { streamLines } from "../diff/util";
import { getSystemMessageWithRules } from "../llm/rules/getSystemMessageWithRules";
import { gptEditPrompt } from "../llm/templates/edit";
import { findLast } from "../util/findLast";
import { Telemetry } from "../util/posthog";

function constructEditPrompt(
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

export async function* addIndentation(
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

export async function* streamDiffLines({
  prefix,
  highlighted,
  suffix,
  llm,
  input,
  language,
  onlyOneInsertion,
  overridePrompt,
  rulesToInclude,
}: {
  prefix: string;
  highlighted: string;
  suffix: string;
  llm: ILLM;
  input: string;
  language: string | undefined;
  onlyOneInsertion: boolean;
  overridePrompt: ChatMessage[] | undefined;
  rulesToInclude: RuleWithSource[] | undefined;
}): AsyncGenerator<DiffLine> {
  void Telemetry.capture(
    "inlineEdit",
    {
      model: llm.model,
      provider: llm.providerName,
    },
    true,
  );

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

  // Defaults to creating an edit prompt
  // For apply can be overridden with simply apply prompt
  let prompt =
    overridePrompt ??
    constructEditPrompt(prefix, highlighted, suffix, llm, input, language);

  // Rules can be included with edit prompt
  // If any rules are present this will result in using chat instead of legacy completion
  const systemMessage = rulesToInclude
    ? getSystemMessageWithRules({
        rules: rulesToInclude,
        userMessage:
          typeof prompt === "string"
            ? ({
                role: "user",
                content: prompt,
              } as UserChatMessage)
            : (findLast(
                prompt,
                (msg) => msg.role === "user" || msg.role === "tool",
              ) as UserChatMessage | ToolResultChatMessage | undefined),
        baseSystemMessage: undefined,
      })
    : undefined;

  if (systemMessage) {
    if (typeof prompt === "string") {
      prompt = [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: prompt,
        },
      ];
    } else {
      const curSysMsg = prompt.find((msg) => msg.role === "system");
      if (curSysMsg) {
        curSysMsg.content = systemMessage + "\n\n" + curSysMsg.content;
      } else {
        prompt.unshift({
          role: "system",
          content: systemMessage,
        });
      }
    }
  }

  const inept = modelIsInept(llm.model);

  const prediction: Prediction = {
    type: "content",
    content: highlighted,
  };

  const completion =
    typeof prompt === "string"
      ? llm.streamComplete(prompt, new AbortController().signal, {
          raw: true,
          prediction,
          reasoning: false,
        })
      : llm.streamChat(prompt, new AbortController().signal, {
          prediction,
          reasoning: false,
        });

  let lines = streamLines(completion);

  lines = filterEnglishLinesAtStart(lines);
  lines = filterCodeBlockLines(lines);
  lines = stopAtLines(lines, () => {});
  lines = skipLines(lines);
  lines = removeTrailingWhitespace(lines);
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
