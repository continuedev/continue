import { ChatMessage } from "../..";
import { stripImages } from "../countTokens";

function templateFactory(
  systemMessage: (msg: ChatMessage) => string,
  userPrompt: string,
  assistantPrompt: string,
  separator: string,
  prefix?: string,
  emptySystemMessage?: string,
): (msgs: ChatMessage[]) => string {
  return (msgs: ChatMessage[]) => {
    let prompt = prefix ?? "";

    // Skip assistant messages at the beginning
    while (msgs.length > 0 && msgs[0].role === "assistant") {
      msgs.shift();
    }

    if (msgs.length > 0 && msgs[0].role === "system") {
      prompt += systemMessage(msgs.shift()!);
    } else if (emptySystemMessage) {
      prompt += emptySystemMessage;
    }

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      prompt += msg.role === "user" ? userPrompt : assistantPrompt;
      prompt += msg.content;
      if (i < msgs.length - 1) {
        prompt += separator;
      }
    }

    if (msgs.length > 0 && msgs[msgs.length - 1].role === "user") {
      prompt += separator;
      prompt += assistantPrompt;
    }

    return prompt;
  };
}

/**
 * @description Template for LLAMA2 messages:
 *
 * <s>[INST] <<SYS>>
 * {{ system_prompt }}
 * <</SYS>>
 *
 * {{ user_msg_1 }} [/INST] {{ model_answer_1 }} </s><s>[INST] {{ user_msg_2 }} [/INST] {{ model_answer_2 }} </s><s>[INST] {{ user_msg_3 }} [/INST]
 */
function llama2TemplateMessages(msgs: ChatMessage[]): string {
  if (msgs.length === 0) {
    return "";
  }

  if (msgs[0].role === "assistant") {
    // These models aren't trained to handle assistant message coming first,
    // and typically these are just introduction messages from Continue
    msgs.shift();
  }

  let prompt = "";
  let hasSystem = msgs[0].role === "system";

  if (hasSystem && stripImages(msgs[0].content).trim() === "") {
    hasSystem = false;
    msgs = msgs.slice(1);
  }

  if (hasSystem) {
    const systemMessage = `<<SYS>>\n ${msgs[0].content}\n<</SYS>>\n\n`;
    if (msgs.length > 1) {
      prompt += `<s>[INST] ${systemMessage} ${msgs[1].content} [/INST]`;
    } else {
      prompt += `[INST] ${systemMessage} [/INST]`;
      return prompt;
    }
  }

  for (let i = hasSystem ? 2 : 0; i < msgs.length; i++) {
    if (msgs[i].role === "user") {
      prompt += `[INST] ${msgs[i].content} [/INST]`;
    } else {
      prompt += msgs[i].content;
      if (i < msgs.length - 1) {
        prompt += "</s>\n<s>";
      }
    }
  }

  return prompt;
}

function anthropicTemplateMessages(messages: ChatMessage[]): string {
  const HUMAN_PROMPT = "\n\nHuman:";
  const AI_PROMPT = "\n\nAssistant:";
  let prompt = "";

  // Anthropic prompt must start with a Human turn
  if (
    messages.length > 0 &&
    messages[0].role !== "user" &&
    messages[0].role !== "system"
  ) {
    prompt += `${HUMAN_PROMPT} Hello.`;
  }
  for (const msg of messages) {
    prompt += `${
      msg.role === "user" || msg.role === "system" ? HUMAN_PROMPT : AI_PROMPT
    } ${msg.content} `;
  }

  prompt += AI_PROMPT;
  return prompt;
}

`A chat between a curious user and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the user's questions.
USER: <image>{prompt}
ASSISTANT:`;
const llavaTemplateMessages = templateFactory(
  () => "",
  "USER: <image>",
  "ASSISTANT: ",
  "\n",
  "A chat between a curious user and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the user's questions.",
);

const zephyrTemplateMessages = templateFactory(
  (msg) => `<|system|>${msg.content}</s>\n`,
  "<|user|>\n",
  "<|assistant|>\n",
  "</s>\n",
  undefined,
  "<|system|> </s>\n",
);

const chatmlTemplateMessages = templateFactory(
  (msg) => `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`,
  "<|im_start|>user\n",
  "<|im_start|>assistant\n",
  "<|im_end|>\n",
);

const templateAlpacaMessages = templateFactory(
  (msg) => `${msg.content}\n\n`,
  "### Instruction:\n",
  "### Response:\n",
  "\n\n",
  undefined,
  "Below is an instruction that describes a task. Write a response that appropriately completes the request.\n\n",
);

function deepseekTemplateMessages(msgs: ChatMessage[]): string {
  let prompt = "";
  let system: string | null = null;
  prompt +=
    "You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and you only answer questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will refuse to answer.\n";
  if (msgs[0].role === "system") {
    system = stripImages(msgs.shift()!.content);
  }

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    prompt += msg.role === "user" ? "### Instruction:\n" : "### Response:\n";

    if (system && msg.role === "user" && i === msgs.length - 1) {
      prompt += system + "\n";
    }

    prompt += `${msg.content}`;

    if (i < msgs.length - 1) {
      prompt += msg.role === "user" ? "\n" : "<|EOT|>\n";
    }
  }

  if (msgs.length > 0 && msgs[msgs.length - 1].role === "user") {
    prompt += "\n";
    prompt += "### Response:\n";
  }

  return prompt;
}

// See https://huggingface.co/microsoft/phi-2#qa-format
const phi2TemplateMessages = templateFactory(
  (msg) => `\n\nInstruct: ${msg.content} `,
  "\n\nInstruct: ",
  "\n\nOutput: ",
  " ",
);

const phindTemplateMessages = templateFactory(
  (msg) => `### System Prompt\n${msg.content}\n\n`,
  "### User Message\n",
  "### Assistant\n",
  "\n",
);

/**
 * OpenChat Template, used by CodeNinja
 * GPT4 Correct User: Hello<|end_of_turn|>GPT4 Correct Assistant: Hi<|end_of_turn|>GPT4 Correct User: How are you today?<|end_of_turn|>GPT4 Correct Assistant:
 */
const openchatTemplateMessages = templateFactory(
  () => "",
  "GPT4 Correct User: ",
  "GPT4 Correct Assistant: ",
  "<|end_of_turn|>",
);

/**
 * Chat template used by https://huggingface.co/TheBloke/XwinCoder-13B-GPTQ
 *

<system>: You are an AI coding assistant that helps people with programming. Write a response that appropriately completes the user's request.
<user>: {prompt}
<AI>:
 */
const xWinCoderTemplateMessages = templateFactory(
  (msg) => `<system>: ${msg.content}`,
  "\n<user>: ",
  "\n<AI>: ",
  "",
  undefined,
  "<system>: You are an AI coding assistant that helps people with programming. Write a response that appropriately completes the user's request.",
);

/**
 * NeuralChat Template
 * ### System:\n{system_input}\n### User:\n{user_input}\n### Assistant:\n
 */
const neuralChatTemplateMessages = templateFactory(
  (msg) => `### System:\n${msg.content}\n`,
  "### User:\n",
  "### Assistant:\n",
  "\n",
);

/**
'<s>Source: system\n\n System prompt <step> Source: user\n\n First user query <step> Source: assistant\n\n Model response to first query <step> Source: user\n\n Second user query <step> Source: assistant\nDestination: user\n\n '
 */
function codeLlama70bTemplateMessages(msgs: ChatMessage[]): string {
  let prompt = "<s>";

  for (const msg of msgs) {
    prompt += `Source: ${msg.role}\n\n ${stripImages(msg.content).trim()}`;
    prompt += " <step> ";
  }

  prompt += "Source: assistant\nDestination: user\n\n";

  return prompt;
}

/**
 <start_of_turn>user
 What is Cramer's Rule?<end_of_turn>
 <start_of_turn>model
 */
const gemmaTemplateMessage = templateFactory(
  () => "",
  "<start_of_turn>user\n",
  "<start_of_turn>model\n",
  "<end_of_turn>\n",
);

export {
  anthropicTemplateMessages,
  chatmlTemplateMessages,
  codeLlama70bTemplateMessages,
  deepseekTemplateMessages,
  gemmaTemplateMessage,
  llama2TemplateMessages,
  llavaTemplateMessages,
  neuralChatTemplateMessages,
  openchatTemplateMessages,
  phi2TemplateMessages,
  phindTemplateMessages,
  templateAlpacaMessages,
  xWinCoderTemplateMessages,
  zephyrTemplateMessages,
};
