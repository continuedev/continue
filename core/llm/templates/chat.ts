import { ChatMessage } from "../..";
import { stripImages } from "../countTokens";

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
      prompt += msgs[i].content + "</s>\n<s>";
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

function llavaTemplateMessages(msgs: ChatMessage[]): string {
  `A chat between a curious user and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the user's questions.
USER: <image>{prompt}
ASSISTANT:`;

  let prompt =
    "A chat between a curious user and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the user's questions.";

  for (const msg of msgs) {
    prompt += msg.role === "user" ? "USER: <image>" : "ASSISTANT: ";
    prompt += msg.content;

    prompt += "\n";
  }

  prompt += "ASSISTANT: ";

  return prompt;
}

function zephyrTemplateMessages(msgs: ChatMessage[]): string {
  let prompt = "";

  if (msgs[0].role === "system") {
    prompt += `<|system|>${msgs[0].content}</s>\n`;
    msgs.shift();
  } else {
    prompt += "<|system|> </s>\n";
  }

  for (const msg of msgs) {
    prompt += msg.role === "user" ? "<|user|>\n" : "<|assistant|>\n";
    prompt += `${msg.content}</s>\n`;
  }

  prompt += "<|assistant|>\n";

  return prompt;
}

function chatmlTemplateMessages(messages: ChatMessage[]): string {
  let prompt = "";

  for (const msg of messages) {
    prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  }

  prompt += "<|im_start|>assistant\n";
  return prompt;
}

function templateAlpacaMessages(msgs: ChatMessage[]): string {
  let prompt = "";

  if (msgs[0].role === "system") {
    prompt += `${msgs[0].content}\n\n`;
    msgs.shift();
  } else {
    prompt +=
      "Below is an instruction that describes a task. Write a response that appropriately completes the request.\n\n";
  }

  for (const msg of msgs) {
    prompt += msg.role === "user" ? "### Instruction:\n" : "### Response:\n";
    prompt += `${msg.content}\n\n`;
  }

  prompt += "### Response:\n";

  return prompt;
}

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
    prompt += msg.role === "user" ? "\n" : "<|EOT|>\n";
  }

  return prompt + "### Response:\n";
}

// See https://huggingface.co/microsoft/phi-2#qa-format
function phi2TemplateMessages(msgs: ChatMessage[]): string {
  const HUMAN_PROMPT = "\n\nInstruct:";
  const AI_PROMPT = "\n\nOutput:";
  let prompt = "";

  for (const msg of msgs) {
    prompt += `${
      msg.role === "user" || msg.role === "system" ? HUMAN_PROMPT : AI_PROMPT
    } ${msg.content} `;
  }

  prompt += AI_PROMPT;
  return prompt;
}

function phindTemplateMessages(msgs: ChatMessage[]): string {
  let prompt = "";

  if (msgs[0].role === "system") {
    prompt += `### System Prompt\n${msgs[0].content}\n\n`;
    msgs.shift();
  }

  for (const msg of msgs) {
    prompt += msg.role === "user" ? "### User Message\n" : "### Assistant\n";
    prompt += `${msg.content}\n`;
  }

  prompt += "### Assistant\n";

  return prompt;
}

/**
 * OpenChat Template, used by CodeNinja
 * GPT4 Correct User: Hello<|end_of_turn|>GPT4 Correct Assistant: Hi<|end_of_turn|>GPT4 Correct User: How are you today?<|end_of_turn|>GPT4 Correct Assistant:
 */
function openchatTemplateMessages(msgs: ChatMessage[]): string {
  let prompt = "";

  for (const msg of msgs) {
    prompt +=
      msg.role === "user" ? "GPT4 Correct User: " : "GPT4 Correct Assistant: ";
    prompt += msg.content + "<|end_of_turn|>";
  }

  prompt += "GPT4 Correct Assistant: ";

  return prompt;
}

/**
 * Chat template used by https://huggingface.co/TheBloke/XwinCoder-13B-GPTQ
 *

<system>: You are an AI coding assistant that helps people with programming. Write a response that appropriately completes the user's request.
<user>: {prompt}
<AI>:
 */
function xWinCoderTemplateMessages(msgs: ChatMessage[]): string {
  let prompt = "<system>: ";
  if (msgs[0].role === "system") {
    prompt += msgs.shift()!.content;
  } else {
    prompt +=
      "You are an AI coding assistant that helps people with programming. Write a response that appropriately completes the user's request.";
  }

  for (let msg of msgs) {
    prompt += "\n";
    prompt += msg.role === "user" ? "<user>" : "<AI>";
    prompt += ": " + msg.content;
  }

  prompt += "<AI>: ";

  return prompt;
}

/**
 * NeuralChat Template
 * ### System:\n{system_input}\n### User:\n{user_input}\n### Assistant:\n
 */
function neuralChatTemplateMessages(msgs: ChatMessage[]): string {
  let prompt = "";

  if (msgs[0].role === "system") {
    prompt += `### System:\n${msgs[0].content}\n`;
    msgs.shift();
  }

  for (const msg of msgs) {
    prompt += msg.role === "user" ? "### User:\n" : "### Assistant:\n";
    prompt += `${msg.content}\n`;
  }

  prompt += "### Assistant:\n";

  return prompt;
}

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

export {
  anthropicTemplateMessages,
  chatmlTemplateMessages,
  codeLlama70bTemplateMessages,
  deepseekTemplateMessages,
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
