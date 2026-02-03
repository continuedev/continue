import { ModelConfig } from "@continuedev/config-yaml";
import type { ChatHistoryItem } from "core/index.js";
import { encode } from "gpt-tokenizer";
import type { ChatCompletionTool } from "openai/resources/chat/completions.mjs";

import { logger } from "./logger.js";

const DEFAULT_MAX_TOKENS_RATIO = 0.35;
const MAX_MAX_TOKENS = 64_000;
// Default context length when model config doesn't specify one
export const DEFAULT_CONTEXT_LENGTH = 200_000;

/**
 * Get the context length limit for a model
 * @param modelName The model name
 * @returns The context length limit in tokens
 */
export function getModelContextLimit(model: ModelConfig): number {
  return (
    model.defaultCompletionOptions?.contextLength ?? DEFAULT_CONTEXT_LENGTH
  );
}

export function getModelMaxTokens(model: ModelConfig): number {
  const contextLimit = getModelContextLimit(model);
  const maxTokens = model.defaultCompletionOptions?.maxTokens;

  return maxTokens === undefined
    ? Math.ceil(
        Math.min(contextLimit * DEFAULT_MAX_TOKENS_RATIO, MAX_MAX_TOKENS),
      )
    : maxTokens;
}

// Importing a bunch of tokenizers can be very resource intensive (MB-scale per tokenizer)
// Using token counting APIs (e.g. for anthropic) can be complicated and unreliable in many environments
// So for now we will just use super fast gpt-tokenizer and apply safety buffers
// I'm using rough estimates from this article to apply safety buffers to common tokenizers
// which will have HIGHER token counts than gpt. Roughly using token ratio from article + 10%
// https://medium.com/@disparate-ai/not-all-tokens-are-created-equal-7347d549af4d
const ANTHROPIC_TOKEN_MULTIPLIER = 1.23;
const GEMINI_TOKEN_MULTIPLIER = 1.18;
const MISTRAL_TOKEN_MULTIPLIER = 1.26;

function getAdjustedTokenCountFromModel(
  baseTokens: number,
  model: ModelConfig,
) {
  let multiplier = 1;
  const modelName = model.model?.toLowerCase() ?? "";
  if (modelName.includes("claude")) {
    multiplier = ANTHROPIC_TOKEN_MULTIPLIER;
  } else if (modelName.includes("gemini")) {
    multiplier = GEMINI_TOKEN_MULTIPLIER;
  } else if (modelName.includes("stral")) {
    // devstral, mixtral, mistral, etc
    multiplier = MISTRAL_TOKEN_MULTIPLIER;
  }
  return Math.ceil(baseTokens * multiplier);
}

/**
 * Count tokens in message content (string or multimodal array)
 */
function countContentTokens(
  content: string | any[],
  model: ModelConfig,
): number {
  if (typeof content === "string") {
    const count = encode(content).length;
    return getAdjustedTokenCountFromModel(count, model);
  }

  if (Array.isArray(content)) {
    let tokenCount = 0;
    for (const part of content) {
      if (part.type === "text" && part.text) {
        tokenCount += encode(part.text).length;
      }
      if (part.type === "imageUrl") {
        tokenCount += 1024; // Rough estimate for image tokens
      }
    }
    return getAdjustedTokenCountFromModel(tokenCount, model);
  }

  return 0;
}

/**
 * Count tokens in a single tool call function
 */
function countToolCallFunctionTokens(
  toolCallFunction: { name?: string; arguments?: string } | undefined,
): number {
  if (!toolCallFunction) {
    return 0;
  }

  let tokenCount = 0;
  tokenCount += encode(toolCallFunction.name ?? "").length + 10; // Function name and structure overhead
  tokenCount += encode(toolCallFunction.arguments ?? "").length; // Arguments
  return tokenCount;
}

/**
 * Count tokens in tool call outputs
 */
function countToolOutputTokens(
  output: Array<{ content?: string; name?: string }> | undefined,
): number {
  if (!output) {
    return 0;
  }

  let tokenCount = 0;
  for (const item of output) {
    if (item.content) {
      tokenCount += encode(item.content).length;
    }
    // Note: item.name is not sent to the model, only used for internal tracking
    tokenCount += 5; // Output structure overhead
  }
  return tokenCount;
}

/**
 * Estimate the token count for a single ChatHistoryItem
 * @param historyItem The ChatHistoryItem to count tokens for
 * @returns The estimated token count
 */
export function countChatHistoryItemTokens(
  historyItem: ChatHistoryItem,
  model: ModelConfig,
): number {
  try {
    let tokenCount = 0;

    const message = historyItem.message;

    // Count tokens in content
    tokenCount += countContentTokens(message.content, model);

    // Add tokens for role (roughly 1-2 tokens)
    tokenCount += 2;

    // Add tokens for tool calls if present
    // Skip if toolCallStates exists to avoid double-counting (toolCallStates includes the tool calls)
    if (
      "toolCalls" in message &&
      message.toolCalls &&
      !historyItem.toolCallStates
    ) {
      for (const toolCall of message.toolCalls) {
        tokenCount += countToolCallFunctionTokens(toolCall.function);
      }
    }

    // Add tokens for tool call results
    if (message.role === "tool" && "content" in message) {
      tokenCount += 5; // Tool message structure overhead
    }

    // Add tokens for context items
    for (const contextItem of historyItem.contextItems) {
      tokenCount += encode(contextItem.content).length;
      tokenCount += encode(contextItem.name).length;
      tokenCount += 5; // Context item structure overhead
    }

    // Add tokens for tool call states (tool results/outputs)
    if (historyItem.toolCallStates) {
      for (const toolState of historyItem.toolCallStates) {
        // Count tokens in tool call function (name + arguments)
        tokenCount += countToolCallFunctionTokens(toolState.toolCall?.function);
        // Count tokens in tool outputs (can be very large - thousands of tokens)
        tokenCount += countToolOutputTokens(toolState.output);
      }
    }

    return tokenCount;
  } catch (error) {
    logger.error("Error counting tokens for history item", error);
    // Return a rough estimate based on character count
    const message = historyItem.message;
    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);
    // Add rough estimate for context items
    const contextContent = historyItem.contextItems
      .map((item) => item.content + item.name)
      .join("");
    return Math.ceil((content.length + contextContent.length) / 4); // Rough estimate: 4 chars per token
  }
}

/**
 * Estimate the total token count for a chat history
 * @param chatHistory The chat history to count tokens for
 * @returns The estimated total token count
 */
export function countChatHistoryTokens(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
): number {
  let totalTokens = 0;

  for (const historyItem of chatHistory) {
    totalTokens += countChatHistoryItemTokens(historyItem, model);
  }

  // Add some overhead for message structure (roughly 3 tokens per message)
  totalTokens += chatHistory.length * 3;

  return totalTokens;
}

/**
 * Calculate the percentage of context used
 * @param tokenCount Current token count
 * @param modelName The model name
 * @returns The percentage of context used (0-100)
 */
export function calculateContextUsagePercentage(
  tokenCount: number,
  model: ModelConfig,
): number {
  const limit = getModelContextLimit(model);
  return Math.min(100, Math.round((tokenCount / limit) * 100));
}

/**
 * Count tokens for a single parameter field in a tool definition.
 * @param fields The field definition object
 * @returns Token count for this field
 */
function countParameterFieldTokens(
  fields: Record<string, unknown> | undefined,
): number {
  if (!fields) {
    return 0;
  }

  let tokens = 0;
  const fieldType = fields["type"];
  const fieldDesc = fields["description"];
  const fieldEnum = fields["enum"];

  if (fieldType && typeof fieldType === "string") {
    tokens += 2; // Structure overhead for type
    tokens += encode(fieldType).length;
  }

  if (fieldDesc && typeof fieldDesc === "string") {
    tokens += 2; // Structure overhead for description
    tokens += encode(fieldDesc).length;
  }

  if (fieldEnum && Array.isArray(fieldEnum) && fieldEnum.length > 0) {
    tokens -= 3;
    for (const e of fieldEnum) {
      tokens += 3;
      tokens += typeof e === "string" ? encode(e).length : 5;
    }
  }

  return tokens;
}

/**
 * Count tokens for a single tool's function definition.
 * @param tool The ChatCompletionTool to count
 * @returns Token count for this tool
 */
function countSingleToolTokens(tool: ChatCompletionTool): number {
  let tokens = encode(tool.function.name).length;

  if (tool.function.description) {
    tokens += encode(tool.function.description).length;
  }

  const params = tool.function.parameters as
    | { properties?: Record<string, unknown> }
    | undefined;
  const props = params?.properties;

  if (props) {
    for (const key in props) {
      tokens += encode(key).length;
      tokens += countParameterFieldTokens(
        props[key] as Record<string, unknown> | undefined,
      );
    }
  }

  return tokens;
}

/**
 * Count tokens for tool definitions sent to the API.
 * Based on OpenAI's token counting for function calling.
 * @see https://community.openai.com/t/how-to-calculate-the-tokens-when-using-function-call/266573/10
 * @param tools Array of ChatCompletionTool objects
 * @returns Estimated token count for all tool definitions
 */
export function countToolDefinitionTokens(tools: ChatCompletionTool[]): number {
  if (!tools || tools.length === 0) {
    return 0;
  }

  // Base overhead for the tools array structure
  let numTokens = 12;

  for (const tool of tools) {
    numTokens += countSingleToolTokens(tool);
  }

  // Additional overhead for the tools wrapper
  return numTokens + 12;
}

/**
 * Parameters for calculating total input tokens including all components
 */
export interface TotalInputTokenParams {
  chatHistory: ChatHistoryItem[];
  model: ModelConfig;
  systemMessage?: string;
  tools?: ChatCompletionTool[];
}

/**
 * Calculate total input tokens including chat history, system message, and tool definitions.
 * This provides a complete picture of tokens that will be sent to the API.
 * @param params Object containing chatHistory, optional systemMessage, optional tools, and optional modelName
 * @returns Total estimated input token count
 */
export function countTotalInputTokens(params: TotalInputTokenParams): number {
  const { chatHistory, systemMessage, tools } = params;

  let totalTokens = countChatHistoryTokens(chatHistory, params.model);

  // Add system message tokens if provided and not already in history
  if (systemMessage) {
    const hasSystemInHistory = chatHistory.some(
      (item) => item.message.role === "system",
    );
    if (!hasSystemInHistory) {
      totalTokens += encode(systemMessage).length;
      totalTokens += 4; // Message structure overhead (role + formatting)
    }
  }

  // Add tool definition tokens
  if (tools && tools.length > 0) {
    totalTokens += countToolDefinitionTokens(tools);
  }

  return totalTokens;
}

/**
 * Parameters for context length validation
 */
export interface ValidateContextLengthParams {
  chatHistory: ChatHistoryItem[];
  model: ModelConfig;
  safetyBuffer?: number;
  systemMessage?: string;
  tools?: ChatCompletionTool[];
}

/**
 * Validates that the input tokens + max_tokens don't exceed context limit.
 * Accounts for system message and tool definitions in the calculation.
 * @param params Object containing chatHistory, model, optional safetyBuffer, systemMessage, and tools
 * @returns Validation result with error details if invalid
 */
export function validateContextLength(params: ValidateContextLengthParams): {
  isValid: boolean;
  error?: string;
  inputTokens?: number;
  contextLimit?: number;
  maxTokens?: number;
} {
  const { chatHistory, model, safetyBuffer = 0, systemMessage, tools } = params;

  const inputTokens = countTotalInputTokens({
    chatHistory,
    systemMessage,
    tools,
    model,
  });
  const contextLimit = getModelContextLimit(model);
  const maxTokens = model.defaultCompletionOptions?.maxTokens || 0;

  // If maxTokens is not set, use 35% default reservation for output
  const reservedForOutput =
    maxTokens > 0 ? maxTokens : Math.ceil(contextLimit * 0.35);
  const totalRequired = inputTokens + reservedForOutput + safetyBuffer;

  if (totalRequired > contextLimit) {
    return {
      isValid: false,
      error: `Context length exceeded: input (${inputTokens.toLocaleString()}) + max_tokens (${reservedForOutput.toLocaleString()})${safetyBuffer > 0 ? ` + buffer (${safetyBuffer})` : ""} = ${totalRequired.toLocaleString()} > context_limit (${contextLimit.toLocaleString()})`,
      inputTokens,
      contextLimit,
      maxTokens: reservedForOutput,
    };
  }

  return {
    isValid: true,
    inputTokens,
    contextLimit,
    maxTokens: reservedForOutput,
  };
}
