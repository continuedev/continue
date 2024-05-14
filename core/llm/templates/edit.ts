import { ChatMessage, PromptTemplate } from "../../index.js";

const simplifiedEditPrompt = `Consider the following code:
\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`
Edit the code to perfectly satisfy the following user request:
{{{userInput}}}
Output nothing except for the code. No code block, no English explanation, no start/end tags.`;

const simplestEditPrompt = `Here is the code before editing:
\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`

Here is the edit requested:
"{{{userInput}}}"

Here is the code after editing:`;

const gptEditPrompt: PromptTemplate = (_, otherData) => {
  if (otherData?.codeToEdit?.trim().length === 0) {
    return `\
\`\`\`${otherData.language}
${otherData.prefix}[BLANK]${otherData.codeToEdit}${otherData.suffix}
\`\`\`

Given the user's request: "${otherData.userInput}"

Here is the code that should fill in the [BLANK]:`;
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

const codellamaInfillEditPrompt = "{{filePrefix}}<FILL>{{fileSuffix}}";

const START_TAG = "<START EDITING HERE>";
const osModelsEditPrompt: PromptTemplate = (history, otherData) => {
  // "No sufix" means either there is no suffix OR
  // it's a clean break at end of function or something
  // (what we're trying to avoid is just the language model trying to complete the closing brackets of a function or something)
  const firstCharOfFirstLine = otherData.suffix?.split("\n")[0]?.[0]?.trim();
  const isSuffix =
    otherData.suffix?.trim() !== "" &&
    // First character of first line is whitespace
    // Otherwise we assume it's a clean break
    !firstCharOfFirstLine;
  const suffixTag = isSuffix ? "<STOP EDITING HERE>" : "";
  const suffixExplanation = isSuffix
    ? " When you get to \"<STOP EDITING HERE>\", end your response."
    : "";

  // If neither prefilling nor /v1/completions are supported, we have to use a chat prompt without putting words in the model's mouth
  if (
    otherData.supportsCompletions !== "true" &&
    otherData.supportsPrefill !== "true"
  ) {
    return gptEditPrompt(history, otherData);
  }

  // Use a different prompt when there's neither prefix nor suffix
  if (otherData.prefix?.trim() === "" && otherData.suffix?.trim() === "") {
    return [
      {
        role: "user",
        content: `\`\`\`${otherData.language}
${otherData.codeToEdit}
${suffixTag}
\`\`\`

Please rewrite the entire code block above in order to satisfy the following request: "${otherData.userInput}".${suffixExplanation}`,
      },
      {
        role: "assistant",
        content: `Sure! Here's the entire rewritten code block:
\`\`\`${otherData.language}
`,
      },
    ];
  }

  return [
    {
      role: "user",
      content: `\`\`\`${otherData.language}
${otherData.prefix}${START_TAG}
${otherData.codeToEdit}
${suffixTag}
\`\`\`

Please rewrite the entire code block above, editing the portion below "${START_TAG}" in order to satisfy the following request: "${otherData.userInput}".${suffixExplanation}
`,
    },
    {
      role: "assistant",
      content: `Sure! Here's the entire code block, including the rewritten portion:
\`\`\`${otherData.language}
${otherData.prefix}${START_TAG}
`,
    },
  ];
};

const mistralEditPrompt = `[INST] You are a helpful code assistant. Your task is to rewrite the following code with these instructions: "{{{userInput}}}"
\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`

Just rewrite the code without explanations: [/INST]
\`\`\`{{{language}}}`;

const alpacaEditPrompt = `Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction: Rewrite the code to satisfy this request: "{{{userInput}}}"

### Input:

\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`

### Response:

Sure! Here's the code you requested:
\`\`\`{{{language}}}
`;

const phindEditPrompt = `### System Prompt
You are an expert programmer and write code on the first attempt without any errors or fillers.

### User Message:
Rewrite the code to satisfy this request: "{{{userInput}}}"

\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`

### Assistant:
Sure! Here's the code you requested:

\`\`\`{{{language}}}
`;

const deepseekEditPrompt = `### System Prompt
You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and you only answer questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will refuse to answer.
### Instruction:
Rewrite the code to satisfy this request: "{{{userInput}}}"

\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`<|EOT|>
### Response:
Sure! Here's the code you requested:

\`\`\`{{{language}}}
`;

const zephyrEditPrompt = `<|system|>
You are an expert programmer and write code on the first attempt without any errors or fillers.</s>
<|user|>
Rewrite the code to satisfy this request: "{{{userInput}}}"

\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`</s>
<|assistant|>
Sure! Here's the code you requested:

\`\`\`{{{language}}}
`;

const openchatEditPrompt = `GPT4 Correct User: You are an expert programmer and personal assistant. You are asked to rewrite the following code in order to {{{userInput}}}.
\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`
Please only respond with code and put it inside of a markdown code block. Do not give any explanation, but your code should perfectly satisfy the user request.<|end_of_turn|>GPT4 Correct Assistant: Sure thing! Here is the rewritten code that you requested:
\`\`\`{{{language}}}
`;

const xWinCoderEditPrompt = `<system>: You are an AI coding assistant that helps people with programming. Write a response that appropriately completes the user's request.
<user>: Please rewrite the following code with these instructions: "{{{userInput}}}"
\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`

Just rewrite the code without explanations:
<AI>:
\`\`\`{{{language}}}`;

const neuralChatEditPrompt = `### System:
You are an expert programmer and write code on the first attempt without any errors or fillers.
### User:
Rewrite the code to satisfy this request: "{{{userInput}}}"

\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`
### Assistant:
Sure! Here's the code you requested:

\`\`\`{{{language}}}
`;

const codeLlama70bEditPrompt = `<s>Source: system\n\n You are an expert programmer and write code on the first attempt without any errors or fillers. <step> Source: user\n\n Rewrite the code to satisfy this request: "{{{userInput}}}"

\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\` <step> Source: assistant\nDestination: user\n\n `;

const claudeEditPrompt: PromptTemplate = (
  history: ChatMessage[],
  otherData: Record<string, string>,
) => [
  {
    role: "user",
    content: `\
\`\`\`${otherData.language}
${otherData.codeToEdit}
\`\`\`

You are an expert programmer. You will rewrite the above code to do the following:

${otherData.userInput}

Output only a code block with the rewritten code:
`,
  },
  {
    role: "assistant",
    content: `Sure! Here is the rewritten code:
\`\`\`${otherData.language}`,
  },
];

const llama3EditPrompt: PromptTemplate = `<|begin_of_text|><|start_header_id|>user<|end_header_id|>
\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`

Rewrite the above code to satisfy this request: "{{{userInput}}}"<|eot_id|><|start_header_id|>assistant<|end_header_id|>
Sure! Here's the code you requested:
\`\`\`{{{language}}}`;

const gemmaEditPrompt = `<start_of_turn>user
You are an expert programmer and write code on the first attempt without any errors or fillers. Rewrite the code to satisfy this request: "{{{userInput}}}"

\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`<end_of_turn>
<start_of_turn>model
Sure! Here's the code you requested:

\`\`\`{{{language}}}
`;

export {
  alpacaEditPrompt,
  claudeEditPrompt,
  codeLlama70bEditPrompt,
  codellamaInfillEditPrompt,
  deepseekEditPrompt,
  gemmaEditPrompt,
  gptEditPrompt,
  llama3EditPrompt,
  mistralEditPrompt,
  neuralChatEditPrompt,
  openchatEditPrompt,
  osModelsEditPrompt,
  phindEditPrompt,
  simplestEditPrompt,
  simplifiedEditPrompt,
  xWinCoderEditPrompt,
  zephyrEditPrompt,
};
