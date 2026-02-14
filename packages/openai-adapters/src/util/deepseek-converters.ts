import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption
} from "openai/resources/index";

import { FimCreateParamsStreaming } from "../apis/base.js";
import {
  BaseDeepSeekRequestBody,
  ChatDeepSeekRequestBody,
  DeepSeekMessage,
  DeepSeekResponseFormat,
  DeepSeekTool,
  DeepSeekToolCall,
  DeepSeekToolChoice,
  FimDeepSeekRequestBody
} from "./deepseek-types.js";

// Converts valid OpenAI request body to DeepSeek request body

// Type utilities
/**
 * Represents possible content types in OpenAI messages
 */
type OpenAIContent = 
  | string 
  | null 
  | undefined
  | Array<{ type: string; text?: string; image_url?: any }>;

/**
 * Represents a message that could come from OpenAI API
 */
type OpenAICompatibleMessage = ChatCompletionMessageParam & {
  content?: OpenAIContent;
  reasoning?: string;
  reasoning_content?: string;
  prefix?: boolean;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

/**
 * Validation utilities for DeepSeek API requests
 */

/**
 * Filters message content to only include text parts
 */
export function validateAndFilterContent(
  content: OpenAIContent,
  warnings: string[] = [],
): string | Array<{ type: "text"; text: string }> | null {
  if (content === undefined) {
    return null;
  }
  
  if (Array.isArray(content)) {
    const filtered = content.filter((part): part is { type: "text"; text: string } => {
      return part.type === "text" && typeof part.text === "string";
    });

    if (filtered.length !== content.length) {
      warnings.push("Non-text content parts were filtered out");
    }

    return filtered.length > 0 ? filtered : "";
  }

  return content;
}

/**
 * Validates the response format parameter
 */
export function validateResponseFormat(
  responseFormat: any,
  warnings: string[] = [],
): DeepSeekResponseFormat | undefined {
  if (!responseFormat?.type) return undefined;

  if (!["text", "json_object"].includes(responseFormat.type)) {
    warnings.push(
      `Invalid response_format.type: ${responseFormat.type}. Must be 'text' or 'json_object'.`,
    );
    return undefined;
  }

  return responseFormat as DeepSeekResponseFormat;
}

/**
 * Validates the top_logprobs parameter
 */
export function validateLogprobs(
  logprobs: boolean | null | undefined,
  top_logprobs: number | null | undefined,
  isReasoning: boolean,
  warnings: string[],
): {
  logprobs: boolean | null | undefined;
  top_logprobs: number | null | undefined;
} {
  if (isReasoning) {
    if (logprobs !== undefined) {
      warnings.push("logprobs is not supported for deepseek reasoner models.");
    }

    if (top_logprobs !== undefined) {
      warnings.push(
        "top_logprobs is not supported for deepseek reasoner models.",
      );
    }

    return { top_logprobs: undefined, logprobs: undefined };
  }

  return { logprobs: logprobs, top_logprobs: top_logprobs };
}



/**
 * Validates and prepares tools for the API request
 */
export function validateAndFilterTools(
  tools: ChatCompletionTool[] | undefined,
  warnings: string[] = [],
): DeepSeekTool[] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  let filteredTools = tools.filter((tool) => tool.type === "function");
  const ignoredCount = tools.length - filteredTools.length;
  
  if (ignoredCount > 0) {
    warnings.push(
      `DeepSeek API supports only function tools. Ignoring ${ignoredCount} tools.`,
    );
  }

  if (filteredTools.length > 128) {
    warnings.push(
      `DeepSeek API supports maximum 128 tools. Using first 128 and ignoring ${filteredTools.length - 128} tools.`,
    );
    filteredTools = filteredTools.slice(0, 127);
  }

  // Transform tools to DeepSeek format (strict must be boolean | undefined, not null)
  return filteredTools.map(tool => {
    const funcTool = tool as any; // ChatCompletionFunctionTool
    const result: DeepSeekTool = {
      type: "function",
      function: {
        name: funcTool.function.name,
        ...(funcTool.function.description && { description: funcTool.function.description }),
        ...(funcTool.function.parameters && { parameters: funcTool.function.parameters }),
        ...(funcTool.function.strict !== null && funcTool.function.strict !== undefined && 
          { strict: funcTool.function.strict }),
      }
    };
    return result;
  });
}

/**
 * Validates and processes stop sequences
 */
export function validateStopSequences(
  stop: string | string[] | null | undefined,
  warnings: string[],
): string | string[] | undefined {
  if (!stop) return undefined;

  if (Array.isArray(stop) && stop.length > 16) {
    warnings.push(
      `DeepSeek API supports maximum 16 stop sequences. Got ${stop.length}. Using first 16.`,
    );
    return stop.slice(0, 16);
  }

  return stop;
}

// FIM-specific validation functions

/**
 * Type guard to check if input is a token array (number[] or number[][])
 */
function isTokenArray(
  prompt: string | string[] | number[] | number[][] | null | undefined,
): prompt is number[] | number[][] {
  return (
    Array.isArray(prompt) &&
    prompt.length > 0 &&
    (typeof prompt[0] === "number" ||
      (Array.isArray(prompt[0]) &&
        prompt[0].length > 0 &&
        typeof prompt[0][0] === "number"))
  );
}

/**
 * Validates the prompt parameter for FIM completion
 */
export function validateFimPrompt(
  prompt: string | string[] | number[] | number[][] | null | undefined,
  warnings: string[] = [],
): string {
  if (prompt == null || prompt === "") {
    throw new Error("FIM completion requires a prompt");
  }

  if (isTokenArray(prompt)) {
    throw new Error(
      "DeepSeek API does not support token arrays (number[] or number[][]) as prompt input. " +
        "Please provide a string or string[].",
    );
  }

  const promptText = Array.isArray(prompt) ? prompt.join(" ") : prompt;

  if (!promptText.trim()) {
    throw new Error("FIM prompt cannot be empty");
  }

  return promptText;
}

/**
 * Validates and converts the tool_choice parameter to DeepSeek format
 */
export function validateToolChoice(
  toolChoice: ChatCompletionToolChoiceOption | null | undefined,
  warnings: string[] = [],
): DeepSeekToolChoice | undefined {
  if (!toolChoice) return undefined;

  // Handle string values
  if (typeof toolChoice === "string") {
    if (toolChoice === "none" || toolChoice === "auto" || toolChoice === "required") {
      return toolChoice as "none" | "auto" | "required";
    }
    warnings.push(
      `Unsupported tool_choice value: ${toolChoice}. Must be one of: 'none', 'auto', 'required'`,
    );
    return undefined;
  }

  // Handle object format { type: 'function', function: { name: string } }
  if (
    toolChoice.type === "function" &&
    toolChoice.function?.name
  ) {
    return toolChoice as { type: "function"; function: { name: string } };
  }

  warnings.push(
    `Invalid tool_choice format: ${JSON.stringify(toolChoice)}. Must be one of: 'none', 'auto', 'required' or ChatCompletionNamedToolChoice`,
  );
  return undefined;
}

/**
 * Validates prefix completion requirements
 */
export function validateChatPrefixCompletion(
  messages: DeepSeekMessage[],
  warnings: string[] = [],
): void {
  if (!messages?.length) {
    warnings.push("Prefix completion requires at least one message");
    return;
  }

  const lastMessage = messages[messages.length - 1];

  if (lastMessage.role !== "assistant") {
    throw new Error(
      'Prefix completion requires the last message to have role "assistant"',
    );
  }

  if (!lastMessage.prefix) {
    throw new Error(
      'Prefix completion requires the last message to have "prefix: true"',
    );
  }

  if (!lastMessage.content || lastMessage.content.toString().trim() === "") {
    warnings.push(
      "Prefix completion requires the assistant message to have non-empty content",
    );
  }
}

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
): OpenAICompatibleMessage[] {
  if (prompt == null) {
    return [];
  }

  // Check for token arrays (not supported)
  if (isTokenArray(prompt)) {
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
    } as OpenAICompatibleMessage,
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
export function isStreamingRequest(body: { stream?: boolean | null }): boolean {
  return body.stream === true;
}

/**
 * Type guard to check if tools are provided
 */
export function hasTools(tools?: ChatCompletionTool[]): boolean {
  return tools !== undefined && Array.isArray(tools) && tools.length > 0;
}

/**
 * Type guard to check if tool choice is specified
 */
export function hasToolChoice(toolChoice?: ChatCompletionToolChoiceOption | null): boolean {
  return toolChoice !== undefined && toolChoice !== null;
}

/**
 * Validates and prepares an array of messages for the API request
 */
export function validateAndPrepareMessages(
  messages: OpenAICompatibleMessage[],
  warnings: string[] = [],
  isReasoningMode: boolean = false,
): DeepSeekMessage[] {
  if (!messages?.length) {
    throw new Error("Messages array must contain at least one message");
  }

  const result: DeepSeekMessage[] = [];
  let firstUserMsgPassed = false;

  // Process messages in reverse to preserve reasoning content
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const prepared = prepareMessage(msg, i, warnings);

    if (prepared) {
      if (prepared.role === "user" || prepared.role === "system") {
        firstUserMsgPassed = true;
      }

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
  msg: OpenAICompatibleMessage,
  index: number,
  warnings: string[] = [],
): DeepSeekMessage | undefined {
  if (!msg) return undefined;

  // const OpenAIRoles = ['developer', 'system', 'user', 'assistant', 'tool'];
  const validDeepSeekRoles = ["system", "user", "assistant", "tool"];

  const role = msg.role === "developer" ? "system" : msg.role;

  if (!validDeepSeekRoles.includes(role as any)) {
    warnings.push(`Invalid message role: ${msg.role} at index ${index}`);
    return undefined;
  }

  // Prepare base message object
  const baseMessage: DeepSeekMessage = {
    role: role as DeepSeekMessage["role"],
    content: validateAndFilterContent(msg.content, warnings),
    ...(msg.name && { name: msg.name }),
    ...(role === "tool" && msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
  };

  // Add tool_calls if present (only for assistant role)
  if (role === "assistant" && Array.isArray(msg.tool_calls)) {
    baseMessage.tool_calls = msg.tool_calls as DeepSeekToolCall[];
  }

  return baseMessage;
}

function isReasoningEnabled(body: ChatCompletionCreateParamsExt): boolean {
  return (
    body.thinking?.type === "enabled" || body.model === "deepseek-reasoner"
  );
}

function getReasoning(msg: OpenAICompatibleMessage): string | undefined {
  return msg.reasoning || msg.reasoning_content;
}
