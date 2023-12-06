import { ChatMessage } from "../types";

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
    system = msgs.shift()!.content;
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

export {
  anthropicTemplateMessages,
  zephyrTemplateMessages,
  chatmlTemplateMessages,
  templateAlpacaMessages,
  deepseekTemplateMessages,
  phindTemplateMessages,
};
