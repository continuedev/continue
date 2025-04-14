import { Tiktoken, encodingForModel as _encodingForModel } from "js-tiktoken";

import {
  ChatMessage,
  MessageContent,
  MessagePart,
  Tool,
  UserChatMessage,
} from "../index.js";

import { Rule } from "@continuedev/config-yaml";
import { renderChatMessage } from "../util/messageContent.js";
import {
  AsyncEncoder,
  GPTAsyncEncoder,
  LlamaAsyncEncoder,
} from "./asyncEncoder.js";
import { autodetectTemplateType } from "./autodetect.js";
import llamaTokenizer from "./llamaTokenizer.js";
import { isRuleActive } from "./rules/isRuleActive.js";
import { extractPathsFromCodeBlocks } from "./utils/extractPathsFromCodeBlocks.js";
interface Encoding {
  encode: Tiktoken["encode"];
  decode: Tiktoken["decode"];
}

class LlamaEncoding implements Encoding {
  encode(text: string): number[] {
    return llamaTokenizer.encode(text);
  }

  decode(tokens: number[]): string {
    return llamaTokenizer.decode(tokens);
  }
}

class NonWorkerAsyncEncoder implements AsyncEncoder {
  constructor(private readonly encoding: Encoding) {}

  async close(): Promise<void> {}

  async encode(text: string): Promise<number[]> {
    return this.encoding.encode(text);
  }

  async decode(tokens: number[]): Promise<string> {
    return this.encoding.decode(tokens);
  }
}

let gptEncoding: Encoding | null = null;
const gptAsyncEncoder = new GPTAsyncEncoder();
const llamaEncoding = new LlamaEncoding();
const llamaAsyncEncoder = new LlamaAsyncEncoder();

function asyncEncoderForModel(modelName: string): AsyncEncoder {
  // Temporary due to issues packaging the worker files
  if (process.env.IS_BINARY) {
    const encoding = encodingForModel(modelName);
    return new NonWorkerAsyncEncoder(encoding);
  }

  const modelType = autodetectTemplateType(modelName);
  if (!modelType || modelType === "none") {
    return gptAsyncEncoder;
  }
  return llamaAsyncEncoder;
}

function encodingForModel(modelName: string): Encoding {
  const modelType = autodetectTemplateType(modelName);

  if (!modelType || modelType === "none") {
    if (!gptEncoding) {
      gptEncoding = _encodingForModel("gpt-4");
    }

    return gptEncoding;
  }

  return llamaEncoding;
}

function countImageTokens(content: MessagePart): number {
  if (content.type === "imageUrl") {
    return 85;
  }
  throw new Error("Non-image content type");
}

async function countTokensAsync(
  content: MessageContent,
  // defaults to llama2 because the tokenizer tends to produce more tokens
  modelName = "llama2",
): Promise<number> {
  const encoding = asyncEncoderForModel(modelName);
  if (Array.isArray(content)) {
    const promises = content.map(async (part) => {
      if (part.type === "imageUrl") {
        return countImageTokens(part);
      }
      return (await encoding.encode(part.text ?? "")).length;
    });
    return (await Promise.all(promises)).reduce((sum, val) => sum + val, 0);
  }
  return (await encoding.encode(content ?? "")).length;
}

function countTokens(
  content: MessageContent,
  // defaults to llama2 because the tokenizer tends to produce more tokens
  modelName = "llama2",
): number {
  const encoding = encodingForModel(modelName);
  if (Array.isArray(content)) {
    return content.reduce((acc, part) => {
      return (
        acc +
        (part.type === "text"
          ? encoding.encode(part.text ?? "", "all", []).length
          : countImageTokens(part))
      );
    }, 0);
  } else {
    return encoding.encode(content ?? "", "all", []).length;
  }
}

function messageHasToolCalls(msg: ChatMessage): boolean {
  return msg.role === "assistant" && !!msg.toolCalls;
}

export function flattenMessages(msgs: ChatMessage[]): ChatMessage[] {
  const flattened: ChatMessage[] = [];

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];

    if (
      flattened.length > 0 &&
      flattened[flattened.length - 1].role === msg.role &&
      !messageHasToolCalls(msg) &&
      !messageHasToolCalls(flattened[flattened.length - 1])
    ) {
      flattened[flattened.length - 1].content += `\n\n${msg.content || ""}`;
    } else {
      flattened.push(msg);
    }
  }

  return flattened;
}

// https://community.openai.com/t/how-to-calculate-the-tokens-when-using-function-call/266573/10
function countToolsTokens(tools: Tool[], modelName: string): number {
  const count = (value: string) =>
    encodingForModel(modelName).encode(value).length;

  let numTokens = 12;

  for (const tool of tools) {
    let functionTokens = count(tool.function.name);
    if (tool.function.description) {
      functionTokens += count(tool.function.description);
    }
    const props = tool.function.parameters?.properties;
    if (props) {
      for (const key in props) {
        functionTokens += count(key);
        const fields = props[key];
        if (fields) {
          const fieldType = fields["type"];
          const fieldDesc = fields["description"];
          const fieldEnum = fields["enum"];
          if (fieldType && typeof fieldType === "string") {
            functionTokens += 2;
            functionTokens += count(fieldType);
          }
          if (fieldDesc && typeof fieldDesc === "string") {
            functionTokens += 2;
            functionTokens += count(fieldDesc);
          }
          if (fieldEnum && Array.isArray(fieldEnum)) {
            functionTokens -= 3;
            for (const e of fieldEnum) {
              functionTokens += 3;
              functionTokens += typeof e === "string" ? count(e) : 5;
            }
          }
        }
      }
    }
    numTokens += functionTokens;
  }

  return numTokens + 12;
}

function countChatMessageTokens(
  modelName: string,
  chatMessage: ChatMessage,
): number {
  // Doing simpler, safer version of what is here:
  // https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
  // every message follows <|im_start|>{role/name}\n{content}<|end|>\n
  const BASE_TOKENS = 4;
  const TOOL_CALL_EXTRA_TOKENS = 10;
  const TOOL_OUTPUT_EXTRA_TOKENS = 10;
  let tokens = BASE_TOKENS;

  if (chatMessage.content) {
    tokens += countTokens(chatMessage.content, modelName);
  }

  if ("toolCalls" in chatMessage && chatMessage.toolCalls) {
    for (const call of chatMessage.toolCalls) {
      tokens += TOOL_CALL_EXTRA_TOKENS;
      tokens += countTokens(JSON.stringify(call), modelName); // TODO hone this
    }
  }

  if (chatMessage.role === "thinking") {
    if (chatMessage.redactedThinking) {
      tokens += countTokens(chatMessage.redactedThinking, modelName);
    }
    if (chatMessage.signature) {
      tokens += countTokens(chatMessage.signature, modelName);
    }
  }

  if (chatMessage.role === "tool") {
    tokens += TOOL_OUTPUT_EXTRA_TOKENS; // safety
    if (chatMessage.toolCallId) {
      tokens += countTokens(chatMessage.toolCallId, modelName);
    }
  }
  return tokens;
}

function pruneLinesFromTop(
  prompt: string,
  maxTokens: number,
  modelName: string,
): string {
  let totalTokens = countTokens(prompt, modelName);
  const lines = prompt.split("\n");
  while (totalTokens > maxTokens && lines.length > 0) {
    totalTokens -= countTokens(lines.shift()!, modelName);
  }

  return lines.join("\n");
}

function pruneLinesFromBottom(
  prompt: string,
  maxTokens: number,
  modelName: string,
): string {
  let totalTokens = countTokens(prompt, modelName);
  const lines = prompt.split("\n");
  while (totalTokens > maxTokens && lines.length > 0) {
    totalTokens -= countTokens(lines.pop()!, modelName);
  }

  return lines.join("\n");
}

function pruneStringFromBottom(
  modelName: string,
  maxTokens: number,
  prompt: string,
): string {
  const encoding = encodingForModel(modelName);

  const tokens = encoding.encode(prompt, "all", []);
  if (tokens.length <= maxTokens) {
    return prompt;
  }

  return encoding.decode(tokens.slice(0, maxTokens));
}

function pruneStringFromTop(
  modelName: string,
  maxTokens: number,
  prompt: string,
): string {
  const encoding = encodingForModel(modelName);

  const tokens = encoding.encode(prompt, "all", []);
  if (tokens.length <= maxTokens) {
    return prompt;
  }

  return encoding.decode(tokens.slice(tokens.length - maxTokens));
}

const MAX_TOKEN_SAFETY_BUFFER = 1000;
const TOKEN_BUFFER_PROPORTION = 0.07;
function getTokenBufferSafety(contextLength: number) {
  return Math.min(
    MAX_TOKEN_SAFETY_BUFFER,
    contextLength * TOKEN_BUFFER_PROPORTION,
  );
}

function pruneRawPromptFromTop(
  modelName: string,
  contextLength: number,
  prompt: string,
  tokensForCompletion: number,
): string {
  const maxTokens =
    contextLength - tokensForCompletion - getTokenBufferSafety(contextLength);
  return pruneStringFromTop(modelName, maxTokens, prompt);
}

// function pruneRawPromptFromBottom(
//   modelName: string,
//   contextLength: number,
//   prompt: string,
//   tokensForCompletion: number,
// ): string {
//   const maxTokens =
//     contextLength - tokensForCompletion - TOKEN_BUFFER_FOR_SAFETY;
//   return pruneStringFromBottom(modelName, maxTokens, prompt);
// }

function summarize(message: ChatMessage): string {
  return `(Truncated message): ${renderChatMessage(message).substring(0, 100)}...`;
}

function pruneChatHistory(
  modelName: string,
  chatHistory: ChatMessage[],
  inputTokensAvailable: number,
): ChatMessage[] {
  let currentTokens = 0;
  const messagesWithTokens = chatHistory.map((message) => {
    const tokens = countChatMessageTokens(modelName, message);
    currentTokens += tokens;
    return {
      ...message,
      tokens,
    };
  });

  const sysMessage = messagesWithTokens.find((msg) => msg.role === "system");
  const sysMessageTokens = sysMessage?.tokens ?? 0;

  const lastUserMessage = messagesWithTokens.at(-1);
  // if (lastMessage?.role === "user")
  // General strategy:
  // Walk from the oldest messages forward to last 5, removing while still above token limit
  // Once at the last 5, attempt to summarize if summarizable
  // Then, double check no latent tool responses that don't have their preceding calls
  // Until under token count

  // 1. Remove entire messages until the last 5
  while (
    messagesWithTokens.length > 5 &&
    currentTokens > inputTokensAvailable
  ) {
    const message = messagesWithTokens.shift()!;
    currentTokens -= message.tokens;
  }

  // At this point make sure no latent tool response without corresponding call
  while (messagesWithTokens[0]?.role === "tool") {
    const message = messagesWithTokens.shift()!;
    currentTokens -= message.tokens;
  }

  // 3. Truncate message in the last 5, except last 1
  let i = 0;
  while (
    totalTokens > inputTokensAvailable &&
    messagesWithTokens.length > 0 &&
    i < messagesWithTokens.length - 1
  ) {
    const message = messagesWithTokens[i];
    totalTokens -= message.tokens;
    totalTokens += countTokens(summarize(message), modelName);
    message.content = summarize(message);
    i++;
  }

  // 4. Remove entire messages in the last 5, except last 1
  while (totalTokens > inputTokensAvailable && messagesWithTokens.length > 1) {
    // If tool call/response detected prune both (can't have response with no call)
    // TODO prune lines from tool response before pruning both messages
    if (
      messagesWithTokens.length > 2 &&
      messageHasToolCalls(messagesWithTokens[0]) &&
      messagesWithTokens[1].role === "tool"
    ) {
      const firstMessage = messagesWithTokens.shift()!;
      const secondMessage = messagesWithTokens.shift()!;
      totalTokens -= firstMessage.tokens;
      totalTokens -= secondMessage.tokens;
    } else {
      const message = messagesWithTokens.shift()!;
      totalTokens -= message.tokens;
    }
  }

  if (currentTokens > inputTokensAvailable) {
    throw new Error(
      "Unable to prune chat history to fit into model's context window",
    );
  }

  if (messagesWithTokens.length === 0) {
    throw new Error("Error processing chat history");
  }

  return messagesWithTokens.map((msg) => {
    const { tokens, ...rest } = msg;
    return rest;
  });
}

function messageIsEmpty(message: ChatMessage): boolean {
  if (typeof message.content === "string") {
    return message.content.trim() === "";
  }
  if (Array.isArray(message.content)) {
    return message.content.every(
      (item) => item.type === "text" && item.text?.trim() === "",
    );
  }
  return false;
}

function addSpaceToAnyEmptyMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (messageIsEmpty(message)) {
      message.content = " ";
    }
    return message;
  });
}

function chatMessageIsEmpty(message: ChatMessage): boolean {
  switch (message.role) {
    case "system":
    case "user":
      return (
        typeof message.content === "string" && message.content.trim() === ""
      );
    case "assistant":
      return (
        typeof message.content === "string" &&
        message.content.trim() === "" &&
        !message.toolCalls
      );
    case "thinking":
    case "tool":
      return false;
  }
}

function addSystemMessage({
  messages,
  systemMessage,
  originalMessages,
}: {
  messages: ChatMessage[];
  systemMessage: string | undefined;
  originalMessages: ChatMessage[] | undefined;
}): ChatMessage[] {
  if (
    !(systemMessage && systemMessage.trim() !== "") &&
    originalMessages?.[0]?.role !== "system"
  ) {
    return messages;
  }

  let content = "";
  if (originalMessages?.[0]?.role === "system") {
    content = renderChatMessage(originalMessages[0]);
  }
  if (systemMessage && systemMessage.trim() !== "") {
    const shouldAddNewLines = content !== "";
    if (shouldAddNewLines) {
      content += "\n\n";
    }
    content += systemMessage;
  }

  const systemChatMsg: ChatMessage = {
    role: "system",
    content,
  };
  // Insert as second to last
  messages.splice(-1, 0, systemChatMsg);
  return messages;
}

function getMessageStringContent(message?: UserChatMessage): string {
  if (!message) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  // Handle MessagePart array
  return message.content
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("\n");
}

const getSystemMessage = ({
  userMessage,
  rules,
  currentModel,
}: {
  userMessage?: UserChatMessage;
  rules: Rule[];
  currentModel: string;
}) => {
  const messageStringContent = getMessageStringContent(userMessage);
  const filePathsFromMessage = extractPathsFromCodeBlocks(messageStringContent);

  return rules
    .filter((rule) => {
      return isRuleActive({
        rule,
        activePaths: filePathsFromMessage,
        currentModel,
      });
    })
    .map((rule) => {
      if (typeof rule === "string") {
        return rule;
      }
      return rule.rule;
    })
    .join("\n");
};

function getLastUserMessage(
  messages: ChatMessage[],
): UserChatMessage | undefined {
  // Iterate backwards through messages to find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i] as UserChatMessage;
    }
  }

  return undefined;
}

function compileChatMessages({
  modelName,
  msgs,
  contextLength,
  maxTokens,
  supportsImages,
  tools,
  systemMessage,
  rules,
}: {
  modelName: string;
  msgs: ChatMessage[] | undefined;
  contextLength: number;
  maxTokens: number;
  supportsImages: boolean;
  tools: Tool[] | undefined;
  systemMessage: string | undefined;
  rules: Rule[];
}): ChatMessage[] {
  let toolTokens = 0;
  if (tools) {
    toolTokens = countToolsTokens(tools, modelName);
  }

  const safetyBuffer = getTokenBufferSafety(contextLength);
  if (toolTokens + maxTokens + safetyBuffer >= contextLength) {
    throw new Error(
      `maxTokens (${maxTokens}) is too close to contextLength (${contextLength}), which doesn't leave room for response.${toolTokens ? toolTokens + "tools tokens included in the request may also cause this issue" : ""}`,
    );
  }

  let msgsCopy = msgs
    ? msgs
        .map((msg) => ({ ...msg }))
        .filter((msg) => !chatMessageIsEmpty(msg) && msg.role !== "system")
    : [];

  msgsCopy = addSpaceToAnyEmptyMessages(msgsCopy);

  const lastUserMessage = getLastUserMessage(msgsCopy);

  msgsCopy = addSystemMessage({
    messages: msgsCopy,
    systemMessage:
      systemMessage ??
      getSystemMessage({
        userMessage: lastUserMessage,
        rules,
        currentModel: modelName,
      }),
    originalMessages: msgs,
  });

  // If images not supported, convert MessagePart[] to string
  if (!supportsImages) {
    for (const msg of msgsCopy) {
      if ("content" in msg && Array.isArray(msg.content)) {
        const content = renderChatMessage(msg);
        msg.content = content;
      }
    }
  }

  const history = pruneChatHistory(
    modelName,
    msgsCopy,
    contextLength - toolTokens - maxTokens - safetyBuffer,
  );

  if (history.length >= 2 && history[history.length - 2].role === "system") {
    const movedSystemMessage = history.splice(-2, 1)[0];
    history.unshift(movedSystemMessage);
  }

  const flattenedHistory = flattenMessages(history);

  return flattenedHistory;
}

export {
  compileChatMessages,
  countTokens,
  countTokensAsync,
  pruneLinesFromBottom,
  pruneLinesFromTop,
  pruneRawPromptFromTop,
  pruneStringFromBottom,
  pruneStringFromTop,
};
