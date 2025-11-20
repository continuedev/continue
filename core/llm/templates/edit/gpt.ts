import { PromptTemplateFunction } from "../../..";
import { dedent } from "../../../util";

const gptInsertionEditPrompt: PromptTemplateFunction = (_, otherData) => {
  return dedent`
    \`\`\`${otherData.language}
    ${otherData.prefix}[BLANK]${otherData.codeToEdit}${otherData.suffix}
    \`\`\`

    Above is the file of code that the user is currently editing in. Their cursor is located at the "[BLANK]". They have requested that you fill in the "[BLANK]" with code that satisfies the following request:

    "${otherData.userInput}"

    Please generate this code. Your output will be only the code that should replace the "[BLANK]", without repeating any of the prefix or suffix, without any natural language explanation, and without messing up indentation. Here is the code that will replace the "[BLANK]":`;
};

const gptFullFileEditPrompt: PromptTemplateFunction = (_, otherData) => {
  return dedent`
    \`\`\`${otherData.language}
    ${otherData.codeToEdit}
    \`\`\`

    Please rewrite the above file to address the following request:

    ${otherData.userInput}

    You should rewrite the entire file without any natural language explanation. DO NOT surround the code in a code block and DO NOT explain yourself.`;
};

export const gptEditPrompt: PromptTemplateFunction = (history, otherData) => {
  if (otherData?.codeToEdit?.trim().length === 0) {
    return gptInsertionEditPrompt(history, otherData);
  } else if (
    otherData?.prefix?.trim().length === 0 &&
    otherData?.suffix?.trim().length === 0
  ) {
    return gptFullFileEditPrompt(history, otherData);
  }

  const paragraphs = [
    "The user has requested a section of code in a file to be rewritten.",
  ];

  if (otherData.prefix?.trim().length > 0) {
    paragraphs.push(dedent`
        This is the prefix of the file:
        \`\`\`${otherData.language}
        ${otherData.prefix}
        \`\`\``);
  }

  if (otherData.suffix?.trim().length > 0) {
    paragraphs.push(dedent`
        This is the suffix of the file:
        \`\`\`${otherData.language}
        ${otherData.suffix}
        \`\`\``);
  }

  paragraphs.push(dedent`
        This is the code to rewrite:
        \`\`\`${otherData.language}
        ${otherData.codeToEdit}
        \`\`\`

        The user's request is: "${otherData.userInput}"
        
        DO NOT output any natural language, only output the code changes.

        Here is the rewritten code:`);

  return paragraphs.join("\n\n");
};

export const defaultApplyPrompt: PromptTemplateFunction = (
  history,
  otherData,
) => {
  return `${otherData.original_code}\n\nThe following code was suggested as an edit:\n\`\`\`\n${otherData.new_code}\n\`\`\`\nPlease apply it to the previous code. Leave existing comments in place unless changes require modifying them.`;
};
