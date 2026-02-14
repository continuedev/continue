import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/index";

import { FimCreateParamsStreaming } from "../apis/base.js";
import {
  BaseDeepSeekRequestBody,
  ChatDeepSeekRequestBody,
  DeepSeekMessage,
  FimDeepSeekRequestBody,
} from "./deepseek-types.js";
import {
  validateAndFilterContent,
  validateAndFilterTools,
  validateFimPrompt,
  validateLogprobs,
  validateResponseFormat,
  validateStopSequences,
  validateToolChoice,
} from "./deepseek-validators.js";

// Converts calid OpenAI request body to DeepSeek request body

/**
 * Extended chat completion parameters for DeepSeek-specific features
 * Extends the standard OpenAI ChatCompletionCreateParams with DeepSeek-specific options
 */
export interface ChatCompletionCreateParamsNonStreamingExt
  extends ChatCompletionCreateParamsNonStreaming {
  thinking?: { type: "enabled" | "disabled" } | null;
}

/**
 * Extended streaming chat completion parameters for DeepSeek-specific features
 */
export interface ChatCompletionCreateParamsStreamingExt
  extends ChatCompletionCreateParamsStreaming {
  thinking?: { type: "enabled" | "disabled" } | null;
}

/**
 * Union type for both streaming and non-streaming extended parameters
 */
export type ChatCompletionCreateParamsExt =
  | ChatCompletionCreateParamsNonStreamingExt
  | ChatCompletionCreateParamsStreamingExt;

/**
 * Converts OpenAI chat completion parameters to DeepSeek format
 */
export function convertToChatDeepSeekRequestBody(
  body: ChatCompletionCreateParamsExt,
  warnings: string[] = [],
): ChatDeepSeekRequestBody {
  const coreBody = convertToBaseDeepSeekRequestBody(body, warnings);
  const responseFormat = validateResponseFormat(body.response_format, warnings);
  const validatedTools = validateAndFilterTools(body.tools, warnings);
  const validatedMessages = validateAndPrepareMessages(
    body.messages || [],
    warnings,
    isReasoningEnabled(body),
  );
  const validatedToolChoice = validateToolChoice(body.tool_choice, warnings);
  const { logprobs, top_logprobs } = validateLogprobs(
    body.logprobs,
    body.top_logprobs,
    isReasoningEnabled(body),
    warnings,
  );

  return {
    ...coreBody,
    messages: validatedMessages,
    ...(isReasoningEnabled(body) ? { thinking: { type: "enabled" } } : {}),
    ...(validatedToolChoice ? { tool_choice: validatedToolChoice } : {}),
    ...(validatedTools && validatedTools.length > 0
      ? { tools: validatedTools }
      : {}),
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...(logprobs ? { logprobs: logprobs } : {}),
    ...(top_logprobs ? { top_logprobs: top_logprobs } : {}),
    ...(body.stream_options?.include_usage
      ? { stream_options: { include_usage: true } }
      : {}),
  };
}

/**
 * Converts OpenAI completion parameters to DeepSeek prefix completion format
 */
export function convertToChatPrefixDeepSeekRequestBody(
  body: ChatCompletionCreateParamsExt,
  warnings: string[] = [],
): ChatDeepSeekRequestBody {
  const chatBody = convertToChatDeepSeekRequestBody(body, warnings);

  if (chatBody.messages[chatBody.messages.length - 1].role === "assistant") {
    chatBody.messages[chatBody.messages.length - 1].prefix = true; // it's save to force prefix to true
  }

  //validateChatPrefixCompletion(chatBody.messages, warnings);

  return chatBody;
}

/**
 * Converts a prompt to prefix completion messages format
 */
export function convertPromptToChatPrefix(
  prompt: string | string[] | number[] | number[][] | null | undefined,
  warnings: string[] = [],
): any[] {
  if (prompt === null || prompt === undefined) {
    return [];
  }

  if (
    Array.isArray(prompt) &&
    prompt.length > 0 &&
    (typeof prompt[0] === "number" ||
      (Array.isArray(prompt[0]) &&
        prompt[0].length > 0 &&
        typeof prompt[0][0] === "number"))
  ) {
    throw new Error(
      "DeepSeek API does not support token arrays (number[] or number[][]) as prompt input. " +
        "Please provide a string or string[].",
    );
  }

  const text = Array.isArray(prompt) ? prompt.join("") : String(prompt);

  if (!text.trim()) {
    return [];
  }

  return [
    {
      role: "assistant",
      content: text,
      prefix: true,
    },
  ];
}

/**
 * Converts OpenAI FIM completion parameters to DeepSeek format
 */
export function convertToFimDeepSeekRequestBody(
  body: FimCreateParamsStreaming, // with optional messages
  warnings: string[],
): FimDeepSeekRequestBody {
  const coreBody = convertToBaseDeepSeekRequestBody(body, warnings);
  const validatedPrompt = validateFimPrompt(body.prompt, warnings);

  return {
    ...coreBody,
    model: body.model,
    prompt: validatedPrompt,
    ...(body.suffix !== undefined ? { suffix: body.suffix } : {}),
    ...(body.logprobs !== undefined ? { logprobs: body.logprobs } : {}),
    ...(body.echo !== undefined ? { echo: body.echo } : {}),
    ...(body.stream_options?.include_usage
      ? { stream_options: { include_usage: true } }
      : {}),
  };
}

/**
 * Converts common parameters to base DeepSeek request body
 */
export function convertToBaseDeepSeekRequestBody(
  body: ChatCompletionCreateParamsExt | FimCreateParamsStreaming,
  warnings: string[] = [],
): BaseDeepSeekRequestBody {
  const validatedStop = validateStopSequences(body.stop, warnings);

  return {
    model: body.model,
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    top_p: body.top_p,
    frequency_penalty: body.frequency_penalty,
    presence_penalty: body.presence_penalty,
    stop: validatedStop,
    stream: body.stream,
  };
}

/**
 * Type guard to check if a request is for streaming
 */
export function isStreamingRequest(body: any): boolean {
  return body.stream === true;
}

/**
 * Type guard to check if tools are provided
 */
export function hasTools(tools?: any[]): boolean {
  return tools !== undefined && Array.isArray(tools) && tools.length > 0;
}

/**
 * Type guard to check if tool choice is specified
 */
export function hasToolChoice(toolChoice?: any): boolean {
  return toolChoice !== undefined && toolChoice !== null;
}

/**
 * Validates and prepares an array of messages for the API request
 */
export function validateAndPrepareMessages(
  messages: any[],
  warnings: string[] = [],
  isReasoningMode: boolean = false,
): DeepSeekMessage[] {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages array must contain at least one message");
  }
  const result: DeepSeekMessage[] = [];

  // Process messages in reverse to preserve reasoning content
  let firstUserMsgPassed = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const prepared = prepareMessage(msg, i, warnings);

    if (prepared) {
      if (prepared.role === "user" || prepared.role === "system")
        firstUserMsgPassed = true;

      // Copy reasoning content if reasoning mode and before first user message
      if (isReasoningMode && !firstUserMsgPassed) {
        const reasoningContent = getReasoning(msg);
        if (reasoningContent) {
          prepared.reasoning_content = reasoningContent;
        }
      }

      result.push(prepared);
    }
  }

  if (result.length === 0) {
    throw new Error("No valid messages found after preparation");
  }

  return result.reverse();
}

export function prepareMessage(
  msg: any,
  index: number,
  warnings: string[] = [],
): DeepSeekMessage | undefined {
  if (msg === null || msg === undefined) return undefined;

  // const OpenAIRoles = ['developer', 'system', 'user', 'assistant', 'tool'];
  const validDeepSeekRoles = ["system", "user", "assistant", "tool"];

  const role = msg.role === "developer" ? "system" : msg.role;

  if (!validDeepSeekRoles.includes(role)) {
    warnings.push(`Invalid message role: ${msg.role} at index ${index}`);
    return undefined;
  }

  // Prepare base message object
  const baseMessage: DeepSeekMessage = {
    role,
    content: validateAndFilterContent(msg.content, warnings),
    ...(msg.name ? { name: msg.name } : {}),
    ...(role === "tool" ? { tool_call_id: msg.tool_call_id } : {}),
  };

  // Add tool_calls if present (only for assistant role)
  if (role === "assistant" && Array.isArray(msg.tool_calls)) {
    baseMessage.tool_calls = msg.tool_calls;
  }

  return baseMessage;
}

function isReasoningEnabled(body: ChatCompletionCreateParamsExt): boolean {
  return (
    body.thinking?.type === "enabled" || body.model === "deepseek-reasoner"
  );
}

function getReasoning(msg: any): string | undefined {
  return msg.reasoning || msg.reasoning_content;
}
