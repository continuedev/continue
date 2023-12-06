const simplifiedEditPrompt = `Consider the following code:
\`\`\`
{{{codeToEdit}}}
\`\`\`
Edit the code to perfectly satisfy the following user request:
{{{userInput}}}
Output nothing except for the code. No code block, no English explanation, no start/end tags.`;

const simplestEditPrompt = `Here is the code before editing:
\`\`\`
{{{codeToEdit}}}
\`\`\`

Here is the edit requested:
"{{{userInput}}}"

Here is the code after editing:`;

const codellamaInfillEditPrompt = "{{filePrefix}}<FILL>{{fileSuffix}}";

const codellamaEditPrompt = `[CODE]
{{{codeToEdit}}}
[/CODE]
[INST]
You are an expert programmer and personal assistant, here is your task: "Rewrite the above code in order to {{{userInput}}}"

Your answer should start with a [CODE] tag and end with a [/CODE] tag.
[/INST] Sure! Here's the code you requested:
[CODE]`;

const alpacaEditPrompt = `Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction: Rewrite the code to satisfy this request: "{{{userInput}}}"

### Input:

\`\`\`
{{{codeToEdit}}}
\`\`\`

### Response:

Sure! Here's the code you requested:
\`\`\`
`;

const phindEditPrompt = `### System Prompt
You are an expert programmer and write code on the first attempt without any errors or fillers.

### User Message:
Rewrite the code to satisfy this request: "{{{userInput}}}"

\`\`\`
{{{codeToEdit}}}
\`\`\`

### Assistant:
Sure! Here's the code you requested:

\`\`\`
`;

const deepseekEditPrompt = `### System Prompt
You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and you only answer questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will refuse to answer.
### Instruction:
Rewrite the code to satisfy this request: "{{{userInput}}}"

\`\`\`
{{{codeToEdit}}}
\`\`\`<|EOT|>
### Response:
Sure! Here's the code you requested:

\`\`\`
`;

const zephyrEditPrompt = `<|system|>
You are an expert programmer and write code on the first attempt without any errors or fillers.</s>
<|user|>
Rewrite the code to satisfy this request: "{{{userInput}}}"

\`\`\`
{{{codeToEdit}}}
\`\`\`</s>
<|assistant|>
Sure! Here's the code you requested:

\`\`\`
`;

export {
  simplifiedEditPrompt,
  simplestEditPrompt,
  codellamaInfillEditPrompt,
  codellamaEditPrompt,
  alpacaEditPrompt,
  phindEditPrompt,
  deepseekEditPrompt,
  zephyrEditPrompt,
};
