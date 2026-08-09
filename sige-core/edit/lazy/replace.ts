import { ILLM } from "../..";
import { filterLeadingNewline } from "../../autocomplete/filtering/streamTransforms/lineStream";
import { streamLines } from "../../diff/util";
import { dedent } from "../../util";

export const BUFFER_LINES_BELOW = 3;

const MATCH_LINES_ABOVE = 1;
export function getReplacementByMatching(
  oldCode: string,
  linesBefore: string[],
  linesAfter: string[],
): string | undefined {
  const oldLines = oldCode.split("\n");
  const linesToMatchAbove = MATCH_LINES_ABOVE;
  const linesToMatchBelow = Math.min(BUFFER_LINES_BELOW, linesAfter.length);

  // Get surrounding lines around the gap
  const beforeContext = linesBefore.slice(-linesToMatchAbove).join("\n");
  const afterContext = linesAfter.slice(0, linesToMatchBelow).join("\n");

  // Find the start index in the old code
  const startIndex = oldLines.findIndex((line, index) => {
    const chunk = oldLines.slice(index, index + linesToMatchAbove).join("\n");
    return chunk === beforeContext;
  });

  if (startIndex === -1) {
    return undefined; // Couldn't find matching start
  }

  // Find the end index in the old code
  const endIndex = oldLines.findIndex((line, index) => {
    if (index <= startIndex + linesToMatchBelow) {
      return false;
    }
    const chunk = oldLines.slice(index, index + linesToMatchBelow).join("\n");
    return chunk === afterContext;
  });

  if (endIndex === -1) {
    return undefined; // Couldn't find matching end
  }

  // Extract the replacement code
  const replacement = oldLines
    .slice(startIndex + linesToMatchAbove, endIndex)
    .join("\n");

  return replacement;
}

const REPLACE_HERE = "// REPLACE HERE //";
export async function* getReplacementWithLlm(
  oldCode: string,
  linesBefore: string[],
  linesAfter: string[],
  llm: ILLM,
  abortController: AbortController,
): AsyncGenerator<string> {
  const userPrompt = dedent`
    ORIGINAL CODE:
    \`\`\`
    ${oldCode}
    \`\`\`

    UPDATED CODE:
    \`\`\`
    ${linesBefore.join("\n")}
    ${REPLACE_HERE}
    ${linesAfter.join("\n")}
    \`\`\`

    Above is an original version of a file, followed by a newer version that is in the process of being written. The new version contains a section which is exactly the same as in the original code, and has been marked with "${REPLACE_HERE}". Your task is to give the exact snippet of code from the original code that should replace "${REPLACE_HERE}" in the new version.

    Your output should be a single code block. We will paste the contents of that code block directly into the new version, so make sure that it has correct indentation.
  `;

  const assistantPrompt = dedent`
    Here is the snippet of code that will replace "${REPLACE_HERE}" in the new version:
    \`\`\`
  `;

  const completion = await llm.streamChat(
    [
      { role: "user", content: userPrompt },
      { role: "assistant", content: assistantPrompt },
    ],
    abortController.signal,
    {
      raw: true,
      prediction: undefined,
      reasoning: false,
    },
  );

  let lines = streamLines(completion);
  lines = filterLeadingNewline(lines);
  // We want to retrive everything from the llm
  // then let the filterCodeBlocks function clean up for any trailing text.
  // if we stop here early, we run the risk of loosing inner markdown content.

  for await (const line of lines) {
    yield line;
  }
}
