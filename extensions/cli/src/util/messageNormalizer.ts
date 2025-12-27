/**
 * Message Normalization for Model-Specific Compatibility
 *
 * Handles model-specific message formatting quirks to ensure compatibility
 * across different LLM providers when using Ollama's OpenAI endpoint.
 *
 * Issues addressed:
 * 1. Mistral/Ministral: "Unexpected role 'system' after role 'tool'"
 * 2. Gemma3: "Invalid 'tool_calls': unknown variant 'index'"
 *
 * GitHub Issue: https://github.com/continuedev/continue/issues/9249
 */

import type { ChatCompletionMessageParam } from "openai/resources";

/**
 * Normalize message list for model-specific requirements.
 *
 * @param messages - List of OpenAI-format messages
 * @param modelName - Model identifier (e.g., 'mistral-large-3:675b-cloud')
 * @returns Normalized message list safe for the target model
 */
export function normalizeMessagesForModel(
  messages: ChatCompletionMessageParam[],
  modelName: string,
): ChatCompletionMessageParam[] {
  const modelLower = modelName.toLowerCase();

  // Detect model family and apply appropriate normalization
  if (modelLower.includes("mistral") || modelLower.includes("ministral")) {
    return normalizeForMistral(messages);
  } else if (modelLower.includes("gemma")) {
    return normalizeForGemma(messages);
  }

  // No normalization needed for other models
  return messages;
}

/**
 * Fix Mistral's "Unexpected role 'system' after role 'tool'" error.
 *
 * Strategy: Move system messages before any tool interactions.
 * If system message appears after tool, convert to user message.
 */
function normalizeForMistral(
  messages: ChatCompletionMessageParam[],
): ChatCompletionMessageParam[] {
  const normalized: ChatCompletionMessageParam[] = [];
  const systemMessages: ChatCompletionMessageParam[] = [];
  let hasToolInteraction = false;

  for (const msg of messages) {
    const role = msg.role;

    if (role === "system") {
      if (hasToolInteraction) {
        // System after tool - convert to user message
        normalized.push({
          role: "user",
          content: `[System instruction]: ${typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)}`,
        });
      } else {
        // System before tool - keep as system
        systemMessages.push(msg);
      }
    } else if (role === "tool") {
      hasToolInteraction = true;
      normalized.push(msg);
    } else {
      normalized.push(msg);
    }
  }

  // Prepend system messages at the start
  return [...systemMessages, ...normalized];
}

/**
 * Fix Gemma's "Invalid 'tool_calls': unknown variant 'index'" error.
 *
 * Strategy: Remove 'index' field from tool_calls if present.
 * Gemma expects only: id, type, function (name, arguments)
 */
function normalizeForGemma(
  messages: ChatCompletionMessageParam[],
): ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    // Only process assistant messages with tool_calls
    if (msg.role !== "assistant" || !("tool_calls" in msg) || !msg.tool_calls) {
      return msg;
    }

    // Remove 'index' field from each tool call
    const cleanedToolCalls = msg.tool_calls.map((call: any) => {
      // Create a new object without the 'index' field
      const { index: _index, ...cleanedCall } = call;
      return cleanedCall;
    });

    return {
      ...msg,
      tool_calls: cleanedToolCalls,
    };
  });
}
