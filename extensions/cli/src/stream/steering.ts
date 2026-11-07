import type { ChatHistoryItem } from "core/index.js";

import { services } from "../services/index.js";
import { logger } from "../util/logger.js";

import type { StreamCallbacks } from "./streamChatResponse.types.js";

/**
 * At a tool boundary (a round of tool calls has finished, the next model
 * request has not started), append the message the person steered with.
 *
 * It goes in as an ordinary user message after the assistant message that
 * holds the tool calls. Converted for the provider that becomes:
 * - OpenAI-style APIs: assistant(tool_calls), tool..., user. A user message
 *   after the tool messages is valid; the tool messages still directly follow
 *   the assistant message that called them.
 * - Anthropic and Bedrock: the adapters fold consecutive tool and user
 *   messages into one user turn, so the result is [tool_result..., text]:
 *   every tool_result first, the text after them, which is the order the
 *   Anthropic Messages API requires.
 */
export async function injectSteeringMessage(
  callbacks: StreamCallbacks | undefined,
  chatHistory: ChatHistoryItem[],
): Promise<{ chatHistory: ChatHistoryItem[]; injected: boolean }> {
  if (!callbacks?.onToolBoundary) {
    return { chatHistory, injected: false };
  }
  const item = await callbacks.onToolBoundary();
  if (!item) {
    return { chatHistory, injected: false };
  }

  const chatHistorySvc = services.chatHistory;
  if (
    typeof chatHistorySvc?.isReady === "function" &&
    chatHistorySvc.isReady()
  ) {
    chatHistorySvc.addHistoryItem(item);
    chatHistory = chatHistorySvc.getHistory();
  } else {
    chatHistory = [...chatHistory, item];
  }
  logger.debug("Steering message added at tool boundary");
  return { chatHistory, injected: true };
}
