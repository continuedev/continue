import { ModelConfig } from "@continuedev/config-yaml";
import type { ChatHistoryItem } from "core/index.js";
import { encode } from "gpt-tokenizer";

import { logger } from "./logger.js";

// Global auto-compact threshold (80% of context limit)
// This is intentionally not configurable to ensure consistent behavior
// across all usage scenarios. Change this value only for testing purposes.
export const AUTO_COMPACT_THRESHOLD = 0.8;

const DEFAULT_CONTEXT_LENGTH_FOR_COMPACTION = 200_000;
/**
 * Get the context length limit for a model
 * @param modelName The model name
 * @returns The context length limit in tokens
 */
export function getModelContextLimit(model: ModelConfig): number {
  return (
    model.defaultCompletionOptions?.contextLength ??
    DEFAULT_CONTEXT_LENGTH_FOR_COMPACTION
  );
}

/**
 * Estimate the token count for a single ChatHistoryItem
 * @param historyItem The ChatHistoryItem to count tokens for
 * @returns The estimated token count
 */
export function countChatHistoryItemTokens(
  historyItem: ChatHistoryItem,
): number {
  try {
    let tokenCount = 0;

    const message = historyItem.message;

    // Count tokens in content
    if (typeof message.content === "string") {
      tokenCount += encode(message.content).length;
    } else if (Array.isArray(message.content)) {
      // Handle array content (e.g., multimodal messages)
      for (const part of message.content) {
        if (part.type === "text" && part.text) {
          tokenCount += encode(part.text).length;
        }
        // Images and other content types have their own token costs
        // but we'll use a rough estimate for now
        if (part.type === "imageUrl") {
          tokenCount += 1024; // Rough estimate for image tokens
        }
      }
    }

    // Add tokens for role (roughly 1-2 tokens)
    tokenCount += 2;

    // Add tokens for tool calls if present
    if ("toolCalls" in message && message.toolCalls) {
      for (const toolCall of message.toolCalls) {
        if (!toolCall.function) {
          continue;
        }
        // Function name and structure overhead
        tokenCount += encode(toolCall.function.name ?? "").length + 10;
        // Arguments
        tokenCount += encode(toolCall.function.arguments ?? "").length;
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
 * Estimate the token count for a single message (legacy compatibility)
 * @param message The message to count tokens for
 * @returns The estimated token count
 * @deprecated Use countChatHistoryItemTokens instead
 */
export function countMessageTokens(message: ChatHistoryItem): number {
  return countChatHistoryItemTokens(message);
}

/**
 * Estimate the total token count for a chat history
 * @param chatHistory The chat history to count tokens for
 * @returns The estimated total token count
 */
export function countChatHistoryTokens(chatHistory: ChatHistoryItem[]): number {
  let totalTokens = 0;

  for (const historyItem of chatHistory) {
    totalTokens += countChatHistoryItemTokens(historyItem);
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
 * Check if the chat history exceeds the auto-compact threshold
 * @param chatHistory The chat history to check
 * @param model The model configuration
 * @returns Whether auto-compacting should be triggered
 */
export function shouldAutoCompact(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
): boolean {
  const inputTokens = countChatHistoryTokens(chatHistory);
  const contextLimit = getModelContextLimit(model);
  const maxTokens = model.defaultCompletionOptions?.maxTokens || 0;

  // Calculate available space considering max_tokens reservation
  // If maxTokens is not set, reserve 35% of context for output as a safe default
  // (64k/200k with claude = 32%, round up to give a buffer)
  const reservedForOutput =
    maxTokens > 0 ? maxTokens : Math.ceil(contextLimit * 0.35);
  const availableForInput = contextLimit - reservedForOutput;

  // Ensure we have positive space available for input
  if (availableForInput <= 0) {
    throw new Error(
      `max_tokens is larger than context_length, which should not be possible. Please check your configuration.`,
    );
  }

  const usage = inputTokens / availableForInput;

  logger.debug("Context usage check", {
    inputTokens,
    contextLimit,
    maxTokens,
    reservedForOutput,
    availableForInput,
    usage: `${Math.round(usage * 100)}%`,
    threshold: `${Math.round(AUTO_COMPACT_THRESHOLD * 100)}%`,
    shouldCompact: usage >= AUTO_COMPACT_THRESHOLD,
  });

  return usage >= AUTO_COMPACT_THRESHOLD;
}

/**
 * Get a descriptive message for auto-compaction that shows the context limit
 * @param model The model configuration
 * @returns A descriptive message explaining why compaction is needed
 */
export function getAutoCompactMessage(model: ModelConfig): string {
  const limit = getModelContextLimit(model);
  return `Approaching context limit (${(limit / 1000).toFixed(0)}K tokens). Auto-compacting chat history...`;
}

/**
 * Validates that the input tokens + max_tokens don't exceed context limit
 * @param chatHistory The chat history to validate
 * @param model The model configuration
 * @returns Validation result with error details if invalid
 */
export function validateContextLength(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
): {
  isValid: boolean;
  error?: string;
  inputTokens?: number;
  contextLimit?: number;
  maxTokens?: number;
} {
  const inputTokens = countChatHistoryTokens(chatHistory);
  const contextLimit = getModelContextLimit(model);
  const maxTokens = model.defaultCompletionOptions?.maxTokens || 0;

  // If maxTokens is not set, use 35% default reservation for output
  const reservedForOutput =
    maxTokens > 0 ? maxTokens : Math.ceil(contextLimit * 0.35);
  const totalRequired = inputTokens + reservedForOutput;

  if (totalRequired > contextLimit) {
    return {
      isValid: false,
      error: `Context length exceeded: input (${inputTokens.toLocaleString()}) + max_tokens (${reservedForOutput.toLocaleString()}) = ${totalRequired.toLocaleString()} > context_limit (${contextLimit.toLocaleString()})`,
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
