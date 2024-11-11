import { SlashCommand } from "../..";
import { stripImages } from "../../llm/images";

const MultiFileEditSlashCommand: SlashCommand = {
  name: "multifile-edit",
  description: "Edit multiple files in the codebase at once",
  run: async function* ({ llm, contextItems, selectedCode, input, ide }) {
    // TODO: This is causing GUI builds to fail, so we're disabling it for now
    // const selectedCodeStr = (
    //   await Promise.all(
    //     selectedCode.map(async (item) => {
    //       // Split the range string from the filename, e.g. `filename.ts (1-2) -> [filename.ts, (1-2)]`
    //       const [filepath, rangeStr] = item.filepath.split(" ");
    //       const { getFullyQualifiedPath } = await import(
    //         "../../../extensions/vscode/src/util/util"
    //       );
    //       const fullPath = getFullyQualifiedPath(ide as any, filepath); // any = VsCodeIde here, but importing it breaks tests
    //       if (!fullPath) {
    //         return "";
    //       }
    //       const codeStr = await ide.readRangeInFile(fullPath, item.range);
    //       // Include the filepath so the model can map it correctly with codeblock outputs
    //       return `\`\`\`${fullPath} ${rangeStr}\n${codeStr}\`\`\``;
    //     }),
    //   )
    // ).join("\n");

    const fileContextItemsStr = contextItems
      .filter((item) => item.uri?.type === "file")
      .map((item) => item.content)
      .join("\n");

    const filesToEditStr = fileContextItemsStr + "\n"; // + selectedCodeStr;

    const additionalContextStr = contextItems
      .filter((item) => item.uri?.type !== "file")
      .map((item) => `${item.description}: ${item.content}`)
      .join("\n");

    const content = createPrompt(filesToEditStr, additionalContextStr, input);

    for await (const chunk of llm.streamChat([{ role: "user", content }])) {
      yield stripImages(chunk.content);
    }
  },
};

function createPrompt(
  filesToEditStr: string,
  additionalContextStr: string,
  input: string,
): string {
  return `
You are an AI assistant designed to help software engineers make multi-file edits in their codebase. Your task is to generate the necessary code changes for multiple files based on the engineer's request. Follow these guidelines:

1. Start with a brief introduction of the task you're about to perform. Do not start with any other preamble, such as "Certainly!"
2. When providing instructions, if a user needs to interact with a CLI, walk them through each step
2. Perform file edits in a logical, sequential ordering
3. For each file edit, provide a brief explanation of the changes
4. If the user submits a code block that contains a filename in the language specifier, always include the filename in any code block you generate based on that file. The filename should be on the same line as the language specifier in your code block.
  a. When creating new files, also inlcude the filname in the language specifier of the code block.
6. After providing all file changes, include a brief, sequential overview of the most important 3-5 edits

Remember to be concise and focus on the code changes and their impact.

Here's an example of how your response should be structured:

<example>
I'll make the following changes to implement feature X:

1. First, I'll modify file1.js to add a new function:
\`\`\`javascript /path/to/file1.js
// Entire content of file1.js or changes to be made
\`\`\`

2. Next, let's create a new test file:
\`\`\`javascript /path/to/file1.test.js
# Entire content of file2.py or changes to be made
\`\`\`

Summary:
- [Sequential overview of the most important 3-5 edits]
</example>

Now, let's make the changes based on the engineer's request:

<input>
${input}
</input>

Here are the files to base your edits on:

<files>
${filesToEditStr}
</files>

And here is any additional context the engineer has provided:

<context>
${additionalContextStr}
</context>

Please provide the multi-file edit details based on the engineer's request.
  `;
}

export default MultiFileEditSlashCommand;
