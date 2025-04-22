import { Tiktoken, encodingForModel as _encodingForModel } from "js-tiktoken";

import { ChatMessage, MessageContent, MessagePart, Tool } from "../index.js";

import { findLast } from "../util/findLast.js";
import { renderChatMessage } from "../util/messageContent.js";
import {
  AsyncEncoder,
  GPTAsyncEncoder,
  LlamaAsyncEncoder,
} from "./asyncEncoder.js";
import { autodetectTemplateType } from "./autodetect.js";
import llamaTokenizer from "./llamaTokenizer.js";
import {
  addSpaceToAnyEmptyMessages,
  chatMessageIsEmpty,
  flattenMessages,
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
const TOKEN_SAFETY_PROPORTION = 0.02;
function getTokenCountingBufferSafety(contextLength: number) {
  return Math.min(
    MAX_TOKEN_SAFETY_BUFFER,
    contextLength * TOKEN_SAFETY_PROPORTION,
  );
}

const MIN_RESPONSE_TOKENS = 1000;
function getMinResponseTokens(maxTokens: number) {
  return Math.min(MIN_RESPONSE_TOKENS, maxTokens);
}

function pruneRawPromptFromTop(
  modelName: string,
  contextLength: number,
  prompt: string,
  tokensForCompletion: number,
): string {
  const maxTokens =
    contextLength -
    tokensForCompletion -
    getTokenCountingBufferSafety(contextLength);
  return pruneStringFromTop(modelName, maxTokens, prompt);
}

/*
  Goal: reconcile chat messages with available context length
  Guidelines:
    - Always keep last user message, system message, and tools
    - Never allow tool output without the corresponding tool call 
    - Remove older messages first
*/
function compileChatMessages({
  modelName,
  msgs,
  contextLength,
  maxTokens,
  supportsImages,
  tools,
}: {
  modelName: string;
  msgs: ChatMessage[];
  contextLength: number;
  maxTokens: number;
  supportsImages: boolean;
  tools?: Tool[];
}): ChatMessage[] {
  let msgsCopy: ChatMessage[] = msgs.map((m) => ({ ...m }));

  // If images not supported, convert MessagePart[] to string
  if (!supportsImages) {
    for (const msg of msgsCopy) {
      if ("content" in msg && Array.isArray(msg.content)) {
        const content = renderChatMessage(msg);
        msg.content = content;
      }
    }
  }

  const lastUserMsg = findLast(msgsCopy, (msg) => msg.role === "user");
  if (!lastUserMsg) {
    throw new Error("Error parsing chat history: no user message found"); // should never happen
  }

  msgsCopy = msgsCopy.filter((msg) => !chatMessageIsEmpty(msg));

  msgsCopy = addSpaceToAnyEmptyMessages(msgsCopy);

  // Remove any last messages that aren't user
  // Then pop the user message too since we've already grabbed it
  while (msgsCopy.at(-1)?.role !== "user") {
    msgsCopy.pop();
  }
  msgsCopy.pop();

  // System message
  let systemMsgTokens = 0;
  const systemMsg = msgsCopy.find((msg) => msg.role === "system");
  if (systemMsg) {
    systemMsgTokens = countChatMessageTokens(modelName, systemMsg);
  }
  msgsCopy = msgsCopy.filter((msg) => msg.role !== "system");

  // Tools
  let toolTokens = 0;
  if (tools) {
    toolTokens = countToolsTokens(tools, modelName);
  }

  // Last user message
  const lastUserMsgTokens = countChatMessageTokens(modelName, lastUserMsg);

  const countingSafetyBuffer = getTokenCountingBufferSafety(contextLength);
  const minOutputTokens = getMinResponseTokens(maxTokens);
  let inputTokensAvailable =
    contextLength - countingSafetyBuffer - minOutputTokens;

  inputTokensAvailable -= toolTokens;
  inputTokensAvailable -= systemMsgTokens;
  inputTokensAvailable -= lastUserMsgTokens;

  // Make sure there's enough context for the non-excludable items
  if (inputTokensAvailable < 0) {
    throw new Error(
      `Not enough context available to include the system message, last user message, and tools.
      There must be at least ${minOutputTokens} tokens remaining for output.
      Request had the following properties:
      - contextLength: ${contextLength}
      - token counting safety buffer: ${countingSafetyBuffer}
      - toolTokens: ~${toolTokens}
      - systemMsgTokens: ~${systemMsgTokens}
      - lastUserMsgTokens: ~${lastUserMsgTokens}
      - maxTokens: ${maxTokens}`,
    );
  }

  // Now remove messages till we're under the limit
  let currentTotal = 0;
  const historyWithTokens = msgsCopy.map((message) => {
    const tokens = countChatMessageTokens(modelName, message);
    currentTotal += tokens;
    return {
      ...message,
      tokens,
    };
  });

  while (historyWithTokens.length > 0 && currentTotal > inputTokensAvailable) {
    const message = historyWithTokens.shift()!;

    // At this point make sure no latent tool response without corresponding call
    while (historyWithTokens[0]?.role === "tool") {
      const message = historyWithTokens.shift()!;
      currentTotal -= message.tokens;
    }

    currentTotal -= message.tokens;
  }

  // Now reassemble
  const reassembled: ChatMessage[] = [
    ...historyWithTokens.map(({ tokens, ...rest }) => rest),
    lastUserMsg,
  ];
  if (systemMsg) {
    reassembled.unshift(systemMsg);
  }

  const flattenedHistory = flattenMessages(reassembled);

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
