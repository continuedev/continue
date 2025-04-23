import { Tiktoken, encodingForModel as _encodingForModel } from "js-tiktoken";

import { ChatMessage, MessageContent, MessagePart } from "../index.js";

import { renderChatMessage } from "../util/messageContent.js";
import {
  AsyncEncoder,
  GPTAsyncEncoder,
  LlamaAsyncEncoder,
} from "./asyncEncoder.js";
import { autodetectTemplateType } from "./autodetect.js";
import { TOKEN_BUFFER_FOR_SAFETY } from "./constants.js";
import llamaTokenizer from "./llamaTokenizer.js";
import {
  addSpaceToAnyEmptyMessages,
  chatMessageIsEmpty,
  flattenMessages,
  messageHasToolCalls,
} from "./messages.js";
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

function countChatMessageTokens(
  modelName: string,
  chatMessage: ChatMessage,
): number {
  // Doing simpler, safer version of what is here:
  // https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
  // every message follows <|im_start|>{role/name}\n{content}<|end|>\n
  const TOKENS_PER_MESSAGE: number = 4;
  return countTokens(chatMessage.content, modelName) + TOKENS_PER_MESSAGE;
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

function pruneRawPromptFromTop(
  modelName: string,
  contextLength: number,
  prompt: string,
  tokensForCompletion: number,
): string {
  const maxTokens =
    contextLength - tokensForCompletion - TOKEN_BUFFER_FOR_SAFETY;
  return pruneStringFromTop(modelName, maxTokens, prompt);
}

function pruneRawPromptFromBottom(
  modelName: string,
  contextLength: number,
  prompt: string,
  tokensForCompletion: number,
): string {
  const maxTokens =
    contextLength - tokensForCompletion - TOKEN_BUFFER_FOR_SAFETY;
  return pruneStringFromBottom(modelName, maxTokens, prompt);
}

function summarize(message: ChatMessage): string {
  return `${renderChatMessage(message).substring(0, 100)}...`;
}

function pruneChatHistory(
  modelName: string,
  msgs: ChatMessage[],
  contextLength: number,
  tokensForCompletion: number,
): ChatMessage[] {
  // Move system message to 2nd to last to give it priority
  const systemMessage = msgs.find((msg) => msg.role === "system");
  const chatHistory: ChatMessage[] = msgs.filter(
    (msg) => msg.role !== "system",
  );
  if (systemMessage) {
    chatHistory.splice(-1, 0, systemMessage);
  }

  let totalTokens =
    tokensForCompletion +
    chatHistory.reduce((acc, message) => {
      return acc + countChatMessageTokens(modelName, message);
    }, 0);

  // 0. Prune any messages that take up more than 1/3 of the context length
  const zippedMessagesAndTokens: [ChatMessage, number][] = [];

  // Zipped ChatMessage with its token counts
  chatHistory.forEach((message) => {
    const zippedItem: [ChatMessage, number] = [
      message,
      countTokens(message.content, modelName),
    ];
    zippedMessagesAndTokens.push(zippedItem);
  });

  const zippedLongerThanOneThird = zippedMessagesAndTokens.filter(
    ([_message, tokens]: [ChatMessage, number]) => tokens > contextLength / 3,
  );

  zippedLongerThanOneThird.sort(
    (
      [_messageA, tokensA]: [ChatMessage, number],
      [_messageB, tokensB]: [ChatMessage, number],
    ) => {
      return tokensB - tokensA;
    },
  );

  const longerThanOneThird = zippedLongerThanOneThird.map(
    ([message, _token]: [ChatMessage, number]) => message,
  );
  const distanceFromThird = zippedLongerThanOneThird.map(
    ([_message, token]: [ChatMessage, number]) => token - contextLength / 3,
  );

  for (let i = 0; i < longerThanOneThird.length; i++) {
    // Prune line-by-line from the top
    const message = longerThanOneThird[i];
    const content = renderChatMessage(message);
    const deltaNeeded = totalTokens - contextLength;
    const delta = Math.min(deltaNeeded, distanceFromThird[i]);
    message.content = pruneStringFromTop(
      modelName,
      countTokens(message.content, modelName) - delta,
      content,
    );
    totalTokens -= delta;
  }

  // 1. Replace beyond last 5 messages with summary
  let i = 0;
  while (totalTokens > contextLength && i < chatHistory.length - 5) {
    const message = chatHistory[i];
    totalTokens -= countTokens(message.content, modelName);
    totalTokens += countTokens(summarize(message), modelName);
    message.content = summarize(message);
    i++;
  }

  // 2. Remove entire messages until the last 5
  while (chatHistory.length > 5 && totalTokens > contextLength) {
    const message = chatHistory.shift()!;
    totalTokens -= countTokens(message.content, modelName);
  }

  // 3. Truncate message in the last 5, except last 1
  i = 0;
  while (
    totalTokens > contextLength &&
    chatHistory.length > 0 &&
    i < chatHistory.length - 1
  ) {
    const message = chatHistory[i];
    totalTokens -= countTokens(message.content, modelName);
    totalTokens += countTokens(summarize(message), modelName);
    message.content = summarize(message);
    i++;
  }

  // 4. Remove entire messages in the last 5, except last 1
  while (totalTokens > contextLength && chatHistory.length > 1) {
    // If tool call/response detected prune both (can't have response with no call)
    // TODO prune lines from tool response before pruning both messages
    if (
      chatHistory.length > 2 &&
      messageHasToolCalls(chatHistory[0]) &&
      chatHistory[1].role === "tool"
    ) {
      const firstMessage = chatHistory.shift()!;
      const secondMessage = chatHistory.shift()!;
      totalTokens -= countTokens(firstMessage.content, modelName);
      totalTokens -= countTokens(secondMessage.content, modelName);
    } else {
      const message = chatHistory.shift()!;
      totalTokens -= countTokens(message.content, modelName);
    }
  }

  // 5. Truncate last message
  if (totalTokens > contextLength && chatHistory.length > 0) {
    const message = chatHistory[0];
    message.content = pruneRawPromptFromTop(
      modelName,
      contextLength,
      renderChatMessage(message),
      tokensForCompletion,
    );
    totalTokens = contextLength;
  }

  // put system message back if applicable
  if (
    chatHistory.length > 1 &&
    chatHistory[chatHistory.length - 2].role === "system"
  ) {
    const movedSystemMessage = chatHistory.splice(-2, 1)[0];
    chatHistory.unshift(movedSystemMessage);
  }

  return chatHistory;
}

function compileChatMessages({
  modelName,
  msgs,
  contextLength,
  maxTokens,
  supportsImages,
}: {
  modelName: string;
  msgs: ChatMessage[];
  contextLength: number;
  maxTokens: number;
  supportsImages: boolean;
}): ChatMessage[] {
  let msgsCopy: ChatMessage[] = msgs.map((m) => ({ ...m }));

  msgsCopy = msgsCopy.filter((msg) => !chatMessageIsEmpty(msg));

  msgsCopy = addSpaceToAnyEmptyMessages(msgsCopy);

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
    contextLength,
    maxTokens + TOKEN_BUFFER_FOR_SAFETY,
  );

  const flattenedHistory = flattenMessages(history);

  return flattenedHistory;
}

export {
  compileChatMessages,
  countTokens,
  countTokensAsync,
  flattenMessages,
  pruneLinesFromBottom,
  pruneLinesFromTop,
  pruneRawPromptFromTop,
  pruneStringFromBottom,
  pruneStringFromTop,
};
