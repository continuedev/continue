import { PromptTemplateFunction } from "../../..";

export const claudeEditPrompt: PromptTemplateFunction = (_, otherData) => {
  if (otherData?.codeToEdit?.trim().length === 0) {
    return `\
\`\`\`${otherData.language}
${otherData.prefix}[BLANK]${otherData.codeToEdit}${otherData.suffix}
\`\`\`

Above is the file of code that the user is currently editing in. Their cursor is located at the "[BLANK]". They have requested that you fill in the "[BLANK]" with code that satisfies the following request:

"${otherData.userInput}"

Please generate this code. Your output will be only the code that should replace the "[BLANK]", without repeating any of the prefix or suffix, without any natural language explanation, and without messing up indentation. Here is the code that will replace the "[BLANK]":`;
  }

  const paragraphs = [
    "The user has requested a section of code in a file to be rewritten.",
  ];
  if (otherData.prefix?.trim().length > 0) {
    paragraphs.push(`This is the prefix of the file:
\`\`\`${otherData.language}
${otherData.prefix}
\`\`\``);
  }

  if (otherData.suffix?.trim().length > 0) {
    paragraphs.push(`This is the suffix of the file:
\`\`\`${otherData.language}
${otherData.suffix}
\`\`\``);
  }

  paragraphs.push(`This is the code to rewrite:
\`\`\`${otherData.language}
${otherData.codeToEdit}
\`\`\`

The user's request is: "${otherData.userInput}"

Here is the rewritten code:`);

  return paragraphs.join("\n\n");
};
