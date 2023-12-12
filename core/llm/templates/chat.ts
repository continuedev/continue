import { ChatMessage } from "../types";

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

  if (hasSystem && msgs[0].content.trim() === "") {
    hasSystem = false;
    msgs = msgs.slice(1);
  }

  if (hasSystem) {
    const systemMessage = `
          <<SYS>>
          ${msgs[0].content}
          <</SYS>>

      `;
    if (msgs.length > 1) {
      prompt += `[INST] ${systemMessage}${msgs[1].content} [/INST]`;
    } else {
      prompt += `[INST] ${systemMessage} [/INST]`;
      return prompt;
    }
  }

  for (let i = hasSystem ? 2 : 0; i < msgs.length; i++) {
    if (msgs[i].role === "user") {
      prompt += `[INST] ${msgs[i].content} [/INST]`;
    } else {
      prompt += msgs[i].content + " ";
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
  llama2TemplateMessages,
  anthropicTemplateMessages,
  zephyrTemplateMessages,
  chatmlTemplateMessages,
  templateAlpacaMessages,
  deepseekTemplateMessages,
  phindTemplateMessages,
};
