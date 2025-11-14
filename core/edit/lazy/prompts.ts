import { ChatMessage } from "../..";
import { dedent } from "../../util";

export const UNCHANGED_CODE = "UNCHANGED CODE";

type LazyApplyPrompt = (
  oldCode: string,
  filename: string,
  newCode: string,
) => ChatMessage[];

const RULES = [
  "Your response should be a code block containing a rewritten version of the file.",
  `Whenever any part of the code is the same as before, you may simply indicate this with a comment that says "${UNCHANGED_CODE}" instead of rewriting.`,
  "You must keep at least one line above and below from the original code, so that we can identify what the previous code was.",
  `Do not place miscellaneous "${UNCHANGED_CODE}" comments at the top or bottom of the file when there is nothing to replace them.`,
  "Leave existing comments in place unless changes require modifying them.",
  // `You should write "${UNCHANGED_CODE}" at least for each function that is unchanged, rather than grouping them into a single comment.`,
  // `You should lean toward using a smaller number of these comments rather than rewriting it for every function if all of them are unchanged.`,
  // `You may do this for imports as well if needed.`,
  // `Do not explain your changes either before or after the code block.`,
  "The code should always be syntactically valid, even with the comments.",
];

function claudeSonnetLazyApplyPrompt(
  ...args: Parameters<LazyApplyPrompt>
): ReturnType<LazyApplyPrompt> {
  const userContent = dedent`
    ORIGINAL CODE:
    \`\`\`${args[1]}
    ${args[0]}
    \`\`\`

    NEW CODE:
    \`\`\`
    ${args[2]}
    \`\`\`

    Above is a code block containing the original version of a file (ORIGINAL CODE) and below it is a code snippet (NEW CODE) that was suggested as modification to the original file. Your task is to apply the NEW CODE to the ORIGINAL CODE and show what the entire file would look like after it is applied.
    - ${RULES.join("\n- ")}
  `;

  const assistantContent = dedent`
    Sure! Here's the modified version of the file after applying the new code:
    \`\`\`${args[1]}
  `;

  return [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ];
}

export function lazyApplyPromptForModel(
  model: string,
  provider: string,
): LazyApplyPrompt | undefined {
  if (model.includes("sonnet")) {
    return claudeSonnetLazyApplyPrompt;
  }

  return undefined;
}
