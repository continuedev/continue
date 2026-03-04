import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
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
  FimDeepSeekRequestBody,
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
export type OpenAICompatibleMessage = ChatCompletionMessageParam & {
  content?: OpenAIContent;
  reasoning?: string;
  reasoning_content?: string;
  prefix?: boolean;
  tool_calls?: ChatCompletionMessageToolCall[];
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
    const filtered = content.filter(
      (part): part is { type: "text"; text: string } => {
        return part.type === "text" && typeof part.text === "string";
      },
    );

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
  responseFormat: unknown,
  warnings: string[] = [],
): DeepSeekResponseFormat | undefined {
  // Check if responseFormat is an object with a type property
  if (
    !responseFormat ||
    typeof responseFormat !== 'object' ||
    !('type' in responseFormat) ||
    typeof (responseFormat as any).type !== 'string'
  ) {
    return undefined;
  }
  const type = (responseFormat as any).type;
  if (!["text", "json_object"].includes(type)) {
    warnings.push(
      `Invalid response_format.type: ${type}. Must be 'text' or 'json_object'.`,
    );
    return undefined;
  }
  return { type: type as "text" | "json_object" };
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
    filteredTools = filteredTools.slice(0, 128);
  }

  return filteredTools.map((tool) => {
    // ChatCompletionTool's function property is of type FunctionDefinition
    // We need to handle the strict field which may be present as a DeepSeek extension
    const func = tool.function;
    // Access strict via type assertion since it's not part of standard FunctionDefinition
    const strict = (func as any).strict;
    const result: DeepSeekTool = {
      type: "function",
      function: {
        name: func.name,
        ...(func.description && { description: func.description }),
        ...(func.parameters && { parameters: func.parameters }),
        // DeepSeek API expects strict to be boolean | undefined, not null
        ...(strict !== null && strict !== undefined && { strict }),
      },
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
    if (
      toolChoice === "none" ||
      toolChoice === "auto" ||
      toolChoice === "required"
    ) {
      return toolChoice as "none" | "auto" | "required";
    }
    warnings.push(
      `Unsupported tool_choice value: ${toolChoice}. Must be one of: 'none', 'auto', 'required'`,
    );
    return undefined;
  }

  // Handle object format { type: 'function', function: { name: string } }
  if (toolChoice.type === "function" && toolChoice.function?.name) {
    return toolChoice as { type: "function"; function: { name: string } };
  }

  warnings.push(
    `Invalid tool_choice format: ${JSON.stringify(toolChoice)}. Must be one of: 'none', 'auto', 'required' or ChatCompletionNamedToolChoice`,
  );
  return undefined;
}

// Extends the standard OpenAI ChatCompletionCreateParams with DeepSeek-specific options
export interface ChatCompletionCreateParamsNonStreamingExt
  extends ChatCompletionCreateParamsNonStreaming {
  thinking?: { type: "enabled" | "disabled" } | null;
}

// Extended streaming chat completion parameters for DeepSeek-specific features
export interface ChatCompletionCreateParamsStreamingExt
  extends ChatCompletionCreateParamsStreaming {
  thinking?: { type: "enabled" | "disabled" } | null;
}

// Union type for both streaming and non-streaming extended parameters
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
    // Force prefix to true for assistant messages in prefix completion mode
    chatBody.messages[chatBody.messages.length - 1].prefix = true;
  }

  return chatBody;
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

  const model = validateFIMModel(body.model, warnings);

  return {
    ...coreBody,
    model,
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

  // Process messages in reverse to preserve reasoning content for current conversation turn
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const prepared = prepareMessage(msg, i, warnings);

    if (prepared) {
      if (prepared.role === "user" || prepared.role === "system") {
        firstUserMsgPassed = true;
      }

      // !!!!! DEEPSEEK test ist falsch, die logik hier ist korrekt !!!!!!!
      // korrigiere den test, nicht den converter!
      // Copy reasoning content if reasoning mode and after last user/system message boundary
      if (
        isReasoningMode &&
        !firstUserMsgPassed &&
        prepared.role === "assistant"
      ) {
        const reasoningContent = getReasoning(msg);
        if (reasoningContent !== undefined) {
          // Reasoning field exists (could be empty string) - preserve it
          prepared.reasoning_content = reasoningContent;
        } else {
          // In reasoning mode, every assistant message in current turn must have reasoning_content
          prepared.reasoning_content = "";
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

/**
 * Converts a single OpenAI message to DeepSeek format.
 * Filters invalid roles, handles developer→system conversion, and preserves tool calls.
 * Returns undefined if role is invalid.
 */
export function prepareMessage(
  msg: OpenAICompatibleMessage,
  index: number,
  warnings: string[] = [],
): DeepSeekMessage | undefined {
  if (!msg) return undefined;

  // DeepSeek supports: system, user, assistant, tool (developer is converted to system)
  const validDeepSeekRoles = ["system", "user", "assistant", "tool"];

  const role = msg.role === "developer" ? "system" : msg.role;

  if (!validDeepSeekRoles.includes(role as DeepSeekMessage['role'])) {
    warnings.push(`Invalid message role: ${msg.role} at index ${index}. (removed from request)`);
    return undefined;
  }

  // Prepare base message object
  const baseMessage: DeepSeekMessage = {
    role: role as DeepSeekMessage["role"],
    content: validateAndFilterContent(msg.content, warnings),
    ...(msg.name && { name: msg.name }),
    ...(role === "tool" &&
      msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
  };

  // Add tool_calls if present (only for assistant role)
  if (role === "assistant" && Array.isArray(msg.tool_calls)) {
    baseMessage.tool_calls = msg.tool_calls as DeepSeekToolCall[];
  }

  return baseMessage;
}

export function isReasoningEnabled(
  body: ChatCompletionCreateParamsExt,
): boolean {
  // Reasoning is enabled for deepseek-reasoner model or when explicitly set
  return (
    body.thinking?.type === "enabled" || body.model === "deepseek-reasoner"
  );
}

/** Extracts reasoning content from a message, checking both possible field names. */
function getReasoning(msg: OpenAICompatibleMessage): string | undefined {
  return msg.reasoning_content ?? msg.reasoning;
}

/**
 * Validates FIM model name, defaulting to 'deepseek-chat'.
 * Warns if a different model is requested, as only deepseek-chat supports FIM.
 */
function validateFIMModel(
  model: string | undefined,
  warnings: string[] = [],
): string {
  const modelName = "deepseek-chat";
  if (model && model !== modelName) {
    warnings.push("FIM models other than deepseek-chat are not supported");
  }
  return model || modelName;
}
