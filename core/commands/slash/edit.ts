import { ContextItemWithId, ILLM, SlashCommand } from "../..";
import {
  filterCodeBlockLines,
  filterEnglishLinesAtEnd,
  filterEnglishLinesAtStart,
  fixCodeLlamaFirstLineIndentation,
  streamWithNewLines,
} from "../../autocomplete/lineStream";
import { streamLines } from "../../diff/util";
import { stripImages } from "../../llm/countTokens";
import { dedentAndGetCommonWhitespace, renderPromptTemplate } from "../../util";
import {
  RangeInFileWithContents,
  contextItemToRangeInFileWithContents,
} from "../util";

const PROMPT = `Take the file prefix and suffix into account, but only rewrite the code_to_edit as specified in the user_request. The code you write in modified_code_to_edit will replace the code between the code_to_edit tags. Do NOT preface your answer or write anything other than code. The </modified_code_to_edit> tag should be written to indicate the end of the modified code section. Do not ever use nested tags.

Example:

<file_prefix>
class Database:
    def __init__(self):
        self._data = {{}}

    def get(self, key):
        return self._data[key]

</file_prefix>
<code_to_edit>
    def set(self, key, value):
        self._data[key] = value
</code_to_edit>
<file_suffix>

    def clear_all():
        self._data = {{}}
</file_suffix>
<user_request>
Raise an error if the key already exists.
</user_request>
<modified_code_to_edit>
    def set(self, key, value):
        if key in self._data:
            raise KeyError(f"Key {{key}} already exists")
        self._data[key] = value
</modified_code_to_edit>

Main task:
`;

export async function getPromptParts(
  rif: RangeInFileWithContents,
  fullFileContents: string,
  model: ILLM,
  input: string,
  tokenLimit: number | undefined,
) {
  let maxTokens = Math.floor(model.contextLength / 2);

  const TOKENS_TO_BE_CONSIDERED_LARGE_RANGE = tokenLimit || 1200;
  // if (model.countTokens(rif.contents) > TOKENS_TO_BE_CONSIDERED_LARGE_RANGE) {
  //   throw new Error(
  //     "\n\n**It looks like you've selected a large range to edit, which may take a while to complete. If you'd like to cancel, click the 'X' button above. If you highlight a more specific range, Continue will only edit within it.**"
  //   );
  // }

  const BUFFER_FOR_FUNCTIONS = 400;
  let totalTokens =
    model.countTokens(fullFileContents + PROMPT + input) +
    BUFFER_FOR_FUNCTIONS +
    maxTokens;

  let fullFileContentsList = fullFileContents.split("\n");
  let maxStartLine = rif.range.start.line;
  let minEndLine = rif.range.end.line;
  let curStartLine = 0;
  let curEndLine = fullFileContentsList.length - 1;

  if (totalTokens > model.contextLength) {
    while (curEndLine > minEndLine) {
      totalTokens -= model.countTokens(fullFileContentsList[curEndLine]);
      curEndLine--;
      if (totalTokens < model.contextLength) {
        break;
      }
    }
  }

  if (totalTokens > model.contextLength) {
    while (curStartLine < maxStartLine) {
      curStartLine++;
      totalTokens -= model.countTokens(fullFileContentsList[curStartLine]);
      if (totalTokens < model.contextLength) {
        break;
      }
    }
  }

  let filePrefix = fullFileContentsList
    .slice(curStartLine, maxStartLine)
    .join("\n");
  let fileSuffix = fullFileContentsList
    .slice(minEndLine, curEndLine - 1)
    .join("\n");

  if (rif.contents.length > 0) {
    let lines = rif.contents.split(/\r?\n/);
    let firstLine = lines[0] || null;
    while (firstLine && firstLine.trim() === "") {
      filePrefix += firstLine;
      rif.contents = rif.contents.substring(firstLine.length);
      lines = rif.contents.split(/\r?\n/);
      firstLine = lines[0] || null;
    }

    let lastLine = lines[lines.length - 1] || null;
    while (lastLine && lastLine.trim() === "") {
      fileSuffix = lastLine + fileSuffix;
      rif.contents = rif.contents.substring(
        0,
        rif.contents.length - lastLine.length,
      );
      lines = rif.contents.split(/\r?\n/);
      lastLine = lines[lines.length - 1] || null;
    }

    while (rif.contents.startsWith("\n")) {
      filePrefix += "\n";
      rif.contents = rif.contents.substring(1);
    }
    while (rif.contents.endsWith("\n")) {
      fileSuffix = "\n" + fileSuffix;
      rif.contents = rif.contents.substring(0, rif.contents.length - 1);
    }
  }
  return { filePrefix, fileSuffix, contents: rif.contents, maxTokens };
}

function compilePrompt(
  filePrefix: string,
  contents: string,
  fileSuffix: string,
  input: string,
): string {
  if (contents.trim() == "") {
    // Separate prompt for insertion at the cursor, the other tends to cause it to repeat whole file
    return `\
<file_prefix>
${filePrefix}
</file_prefix>
<insertion_code_here>
<file_suffix>
${fileSuffix}
</file_suffix>
<user_request>
${input}
</user_request>

Please output the code to be inserted at the cursor in order to fulfill the user_request. Do NOT preface your answer or write anything other than code. You should not write any tags, just the code. Make sure to correctly indent the code:`;
  }

  let prompt = PROMPT;
  if (filePrefix.trim() != "") {
    prompt += `
<file_prefix>
${filePrefix}
</file_prefix>`;
  }
  prompt += `
<code_to_edit>
${contents}
</code_to_edit>`;

  if (fileSuffix.trim() != "") {
    prompt += `
<file_suffix>
${fileSuffix}
</file_suffix>`;
  }
  prompt += `
<user_request>
${input}
</user_request>
<modified_code_to_edit>
`;

  return prompt;
}

function isEndLine(line: string) {
  return (
    line.includes("</modified_code_to_edit>") ||
    line.includes("</code_to_edit>") ||
    line.includes("[/CODE]")
  );
}

function lineToBeIgnored(line: string, isFirstLine: boolean = false): boolean {
  return (
    line.includes("```") ||
    line.includes("<modified_code_to_edit>") ||
    line.includes("<file_prefix>") ||
    line.includes("</file_prefix>") ||
    line.includes("<file_suffix>") ||
    line.includes("</file_suffix>") ||
    line.includes("<user_request>") ||
    line.includes("</user_request>") ||
    line.includes("<code_to_edit>")
  );
}

const EditSlashCommand: SlashCommand = {
  name: "edit",
  description: "Edit selected code",
  run: async function* ({ ide, llm, input, history, contextItems, params }) {
    let contextItemToEdit = contextItems.find(
      (item: ContextItemWithId) =>
        item.editing && item.id.providerTitle === "code",
    );
    if (!contextItemToEdit) {
      contextItemToEdit = contextItems.find(
        (item: ContextItemWithId) => item.id.providerTitle === "code",
      );
    }

    if (!contextItemToEdit) {
      yield "Select (highlight and press `cmd+shift+M` (MacOS) / `ctrl+shift+M` (Windows)) the code that you want to edit first";
      return;
    }

    // Strip unecessary parts of the input (the fact that you have to do this is suboptimal, should be refactored away)
    let content = history[history.length - 1].content;
    if (typeof content !== "string") {
      content.forEach((part) => {
        if (part.text && part.text.startsWith("/edit")) {
          part.text = part.text.replace("/edit", "").trimStart();
        }
      });
    }
    let userInput = stripImages(content).replace(
      `\`\`\`${contextItemToEdit.name}\n${contextItemToEdit.content}\n\`\`\`\n`,
      "",
    );

    const rif: RangeInFileWithContents =
      contextItemToRangeInFileWithContents(contextItemToEdit);

    await ide.saveFile(rif.filepath);
    let fullFileContents = await ide.readFile(rif.filepath);

    let { filePrefix, contents, fileSuffix, maxTokens } = await getPromptParts(
      rif,
      fullFileContents,
      llm,
      userInput,
      params?.tokenLimit,
    );
    const [dedentedContents, commonWhitespace] =
      dedentAndGetCommonWhitespace(contents);
    contents = dedentedContents;

    let prompt = compilePrompt(filePrefix, contents, fileSuffix, userInput);
    let fullFileContentsLines = fullFileContents.split("\n");
    let fullPrefixLines = fullFileContentsLines.slice(
      0,
      Math.max(0, rif.range.start.line - 1),
    );
    let fullSuffixLines = fullFileContentsLines.slice(rif.range.end.line);

    let linesToDisplay: string[] = [];

    async function sendDiffUpdate(lines: string[], final: boolean = false) {
      let completion = lines.join("\n");

      // Don't do this at the very end, just show the inserted code
      if (final) {
        linesToDisplay = [];
      }

      // Only recalculate at every new-line, because this is sort of expensive
      else if (completion.endsWith("\n")) {
        let contentsLines = rif.contents.split("\n");
        let rewrittenLines = 0;
        for (let line of lines) {
          for (let i = rewrittenLines; i < contentsLines.length; i++) {
            if (
              //   difflib.SequenceMatcher(
              //     null, line, contentsLines[i]
              //   ).ratio()
              //   > 0.7
              line.trim() === contentsLines[i].trim() && // Temp replacement for difflib (TODO)
              contentsLines[i].trim() !== ""
            ) {
              rewrittenLines = i + 1;
              break;
            }
          }
        }
        linesToDisplay = contentsLines.slice(rewrittenLines);
      }

      let newFileContents =
        fullPrefixLines.join("\n") +
        "\n" +
        completion +
        "\n" +
        (linesToDisplay.length > 0 ? linesToDisplay.join("\n") + "\n" : "") +
        fullSuffixLines.join("\n");

      let stepIndex = history.length - 1;

      await ide.showDiff(rif.filepath, newFileContents, stepIndex);
    }

    // Important state variables
    // -------------------------
    let originalLines = rif.contents === "" ? [] : rif.contents.split("\n");
    // In the actual file, taking into account block offset
    let currentLineInFile = rif.range.start.line;
    let currentBlockLines: string[] = [];
    let originalLinesBelowPreviousBlocks = originalLines;
    // The start of the current block in file, taking into account block offset
    let currentBlockStart = -1;
    let offsetFromBlocks = 0;

    // Don't end the block until you've matched N simultaneous lines
    // This helps avoid many tiny blocks
    const LINES_TO_MATCH_BEFORE_ENDING_BLOCK = 2;
    // If a line has been matched at the end of the block, this is its index within originalLinesBelowPreviousBlocks
    // Except we are keeping track of multiple potentialities, so it's a list
    // We always check the lines following each of these leads, but if multiple make it out at the end, we use the first one
    // This is a tuple of (index_of_last_matched_line, number_of_lines_matched)
    let indicesOfLastMatchedLines: [number, number][] = [];

    async function handleGeneratedLine(line: string) {
      if (currentBlockLines.length === 0) {
        // Set this as the start of the next block
        currentBlockStart =
          rif.range.start.line +
          originalLines.length -
          originalLinesBelowPreviousBlocks.length +
          offsetFromBlocks;
        if (
          originalLinesBelowPreviousBlocks.length > 0 &&
          line === originalLinesBelowPreviousBlocks[0]
        ) {
          // Line is equal to the next line in file, move past this line
          originalLinesBelowPreviousBlocks =
            originalLinesBelowPreviousBlocks.slice(1);
          return;
        }
      }

      // In a block, and have already matched at least one line
      // Check if the next line matches, for each of the candidates
      let matchesFound: any[] = [];
      let firstValidMatch: any = null;
      for (let [
        index_of_last_matched_line,
        num_lines_matched,
      ] of indicesOfLastMatchedLines) {
        if (
          index_of_last_matched_line + 1 <
            originalLinesBelowPreviousBlocks.length &&
          line ===
            originalLinesBelowPreviousBlocks[index_of_last_matched_line + 1]
        ) {
          matchesFound.push([
            index_of_last_matched_line + 1,
            num_lines_matched + 1,
          ]);
          if (
            firstValidMatch === null &&
            num_lines_matched + 1 >= LINES_TO_MATCH_BEFORE_ENDING_BLOCK
          ) {
            firstValidMatch = [
              index_of_last_matched_line + 1,
              num_lines_matched + 1,
            ];
          }
        }
      }
      indicesOfLastMatchedLines = matchesFound;

      if (firstValidMatch !== null) {
        // We've matched the required number of lines, insert suggestion!

        // We added some lines to the block that were matched (including maybe some blank lines)
        // So here we will strip all matching lines from the end of currentBlockLines
        let linesStripped: string[] = [];
        let indexOfLastLineInBlock: number = firstValidMatch[0];
        while (
          currentBlockLines.length > 0 &&
          currentBlockLines[currentBlockLines.length - 1] ===
            originalLinesBelowPreviousBlocks[indexOfLastLineInBlock - 1]
        ) {
          linesStripped.push(currentBlockLines.pop() as string);
          indexOfLastLineInBlock -= 1;
        }

        // Reset current block / update variables
        currentLineInFile += 1;
        offsetFromBlocks += currentBlockLines.length;
        originalLinesBelowPreviousBlocks =
          originalLinesBelowPreviousBlocks.slice(indexOfLastLineInBlock + 1);
        currentBlockLines = [];
        currentBlockStart = -1;
        indicesOfLastMatchedLines = [];

        return;
      }

      // Always look for new matching candidates
      let newMatches: any[] = [];
      for (let i = 0; i < originalLinesBelowPreviousBlocks.length; i++) {
        let ogLine = originalLinesBelowPreviousBlocks[i];
        // TODO: It's a bit sus to be disqualifying empty lines.
        // What you ideally do is find ALL matches, and then throw them out as you check the following lines
        if (ogLine === line) {
          // and og_line.trim() !== "":
          newMatches.push([i, 1]);
        }
      }
      indicesOfLastMatchedLines = indicesOfLastMatchedLines.concat(newMatches);

      // Make sure they are sorted by index
      indicesOfLastMatchedLines = indicesOfLastMatchedLines.sort(
        (a, b) => a[0] - b[0],
      );

      currentBlockLines.push(line);
    }

    let messages = history;
    messages[messages.length - 1] = { role: "user", content: prompt };

    let linesOfPrefixCopied = 0;
    let lines = [];
    let unfinishedLine: string = "";
    let completionLinesCovered = 0;
    let repeatingFileSuffix = false;
    let lineBelowHighlightedRange = fileSuffix.trim().split("\n")[0];

    // Use custom templates defined by the model
    const template = llm.promptTemplates?.edit;
    let generator: AsyncGenerator<string>;
    if (template) {
      let rendered = renderPromptTemplate(
        template,
        // typeof template === 'string' ? template : template.prompt,
        messages.slice(0, messages.length - 1),
        {
          codeToEdit: rif.contents,
          userInput,
          filePrefix: filePrefix,
          fileSuffix: fileSuffix,
          systemMessage: llm.systemMessage || "",
          // "contextItems": (await sdk.getContextItemChatMessages()).map(x => x.content || "").join("\n\n"),
        },
      );
      if (typeof rendered === "string") {
        messages = [
          {
            role: "user",
            content: rendered,
          },
        ];
      } else {
        messages = rendered;
      }

      const completion = llm.streamComplete(rendered as string, {
        maxTokens: Math.min(maxTokens, Math.floor(llm.contextLength / 2), 4096),
        raw: true,
      });
      let lineStream = streamLines(completion);

      lineStream = filterEnglishLinesAtStart(lineStream);

      lineStream = filterEnglishLinesAtEnd(filterCodeBlockLines(lineStream));

      generator = streamWithNewLines(
        fixCodeLlamaFirstLineIndentation(lineStream),
      );
    } else {
      async function* gen() {
        for await (let chunk of llm.streamChat(messages, {
          temperature: 0.5, // TODO
          maxTokens: Math.min(
            maxTokens,
            Math.floor(llm.contextLength / 2),
            4096,
          ),
        })) {
          yield stripImages(chunk.content);
        }
      }

      generator = gen();
    }

    for await (let chunk of generator) {
      // Stop early if it is repeating the fileSuffix or the step was deleted
      if (repeatingFileSuffix) {
        break;
      }

      // Allow stopping breakpoints
      yield undefined;

      // Accumulate lines
      let chunkLines = chunk.split("\n");
      chunkLines[0] = unfinishedLine + chunkLines[0];
      if (chunk.endsWith("\n")) {
        unfinishedLine = "";
        chunkLines.pop(); // because this will be an empty string
      } else {
        unfinishedLine = chunkLines.pop() || "";
      }

      // Deal with newly accumulated lines
      for (let i = 0; i < chunkLines.length; i++) {
        // Trailing whitespace doesn't matter
        chunkLines[i] = chunkLines[i].trimEnd();
        chunkLines[i] = commonWhitespace + chunkLines[i];

        // Lines that should signify the end of generation
        if (isEndLine(chunkLines[i])) {
          break;
        }
        // Lines that should be ignored, like the <> tags
        else if (lineToBeIgnored(chunkLines[i], completionLinesCovered === 0)) {
          continue; // noice
        }
        // Check if we are currently just copying the prefix
        else if (
          (linesOfPrefixCopied > 0 || completionLinesCovered === 0) &&
          linesOfPrefixCopied < filePrefix.split("\n").length &&
          chunkLines[i] === fullPrefixLines[linesOfPrefixCopied]
        ) {
          // This is a sketchy way of stopping it from repeating the filePrefix. Is a bug if output happens to have a matching line
          linesOfPrefixCopied += 1;
          continue; // also nice
        }
        // Because really short lines might be expected to be repeated, this is only a !heuristic!
        // Stop when it starts copying the fileSuffix
        else if (
          chunkLines[i].trim() === lineBelowHighlightedRange.trim() &&
          chunkLines[i].trim().length > 4 &&
          !(
            originalLinesBelowPreviousBlocks.length > 0 &&
            chunkLines[i].trim() === originalLinesBelowPreviousBlocks[0].trim()
          )
        ) {
          repeatingFileSuffix = true;
          break;
        }

        lines.push(chunkLines[i]);
        completionLinesCovered += 1;
        currentLineInFile += 1;
      }

      await sendDiffUpdate(
        lines.concat([
          unfinishedLine?.startsWith("<")
            ? commonWhitespace
            : commonWhitespace + unfinishedLine,
        ]),
      );
    }

    // Add the unfinished line
    if (
      unfinishedLine !== "" &&
      !lineToBeIgnored(unfinishedLine, completionLinesCovered === 0) &&
      !isEndLine(unfinishedLine)
    ) {
      unfinishedLine = commonWhitespace + unfinishedLine;
      lines.push(unfinishedLine);
      await handleGeneratedLine(unfinishedLine);
      completionLinesCovered += 1;
      currentLineInFile += 1;
    }

    await sendDiffUpdate(lines, true);

    if (params?.recap) {
      const prompt = `This is the code before editing:
\`\`\`
${contents}
\`\`\`

This is the code after editing:

\`\`\`
${lines.join("\n")}
\`\`\`

Please briefly explain the changes made to the code above. Give no more than 2-3 sentences, and use markdown bullet points:`;

      for await (const update of llm.streamComplete(prompt)) {
        yield update;
      }
    }
  },
};

export default EditSlashCommand;
