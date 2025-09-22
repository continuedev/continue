import type { ChatHistoryItem } from "core";

import { findLastSafeSplitPoint } from "./messageSplitting.js";

const MAX_HEIGHT_BEFORE_SPLIT = 20;

/**
 * Splits a chat history item into multiple items if its content is too large.
 *
 * This function prevents UI flickering by breaking large messages into manageable chunks.
 * It only splits at safe markdown boundaries (paragraph breaks: \n\n) to preserve formatting.
 *
 * Splitting behavior:
 * - User messages: Split only when they have natural paragraph breaks (\n\n)
 * - Assistant messages: Split when content exceeds height threshold
 * - System messages: Never split
 * - Messages with tool calls: Never split
 *
 * Common use cases:
 * - User pastes multiple paragraphs of text -> Split at paragraph boundaries
 * - User writes one long paragraph -> Keep as single message
 * - Assistant generates long response -> Split at paragraph breaks (\n\n)
 */
function splitChatHistoryItem(
  item: ChatHistoryItem,
  terminalWidth: number,
): ChatHistoryItem[] {
  // Don't split non-text messages or messages with tool calls
  if (item.toolCallStates?.length || typeof item.message.content !== "string") {
    return [item];
  }

  // Don't split system messages
  if (item.message.role === "system") {
    return [item];
  }

  const content = item.message.content;

  if (!shouldSplitContent(content, terminalWidth)) {
    return [item];
  }

  return splitContentIntoHistoryItems(item, content, terminalWidth);
}

/**
 * Splits content into multiple chat history items at safe markdown boundaries.
 */
function splitContentIntoHistoryItems(
  originalItem: ChatHistoryItem,
  content: string,
  terminalWidth: number,
): ChatHistoryItem[] {
  const items: ChatHistoryItem[] = [];
  let remainingContent = content;
  let itemIndex = 0;

  while (remainingContent.length > 0) {
    if (!shouldSplitContent(remainingContent, terminalWidth)) {
      // Remaining content is small enough, add it as the final item
      if (remainingContent.trim()) {
        items.push({
          ...originalItem,
          message: {
            ...originalItem.message,
            content: remainingContent,
          },
        });
      }
      break;
    }

    // Find safe split point
    const splitPoint = findLastSafeSplitPoint(remainingContent);

    if (splitPoint === remainingContent.length) {
      // No safe split point found, add as single large item
      if (remainingContent.trim()) {
        items.push({
          ...originalItem,
          message: {
            ...originalItem.message,
            content: remainingContent,
          },
        });
      }
      break;
    }

    // Split at the safe point
    const beforeText = remainingContent.slice(0, splitPoint).trim();
    remainingContent = remainingContent.slice(splitPoint).trim();

    if (beforeText) {
      items.push({
        ...originalItem,
        message: {
          ...originalItem.message,
          content: beforeText,
        },
      });
    }

    itemIndex++;

    // Prevent infinite loops
    if (itemIndex > 50) {
      console.warn("Message splitting exceeded maximum iterations, stopping");
      if (remainingContent.trim()) {
        items.push({
          ...originalItem,
          message: {
            ...originalItem.message,
            content: remainingContent,
          },
        });
      }
      break;
    }
  }

  return items;
}

/**
 * Processes an entire chat history array, splitting large items into multiple items.
 */
export function splitChatHistory(
  chatHistory: ChatHistoryItem[],
  terminalWidth: number,
): ChatHistoryItem[] {
  const result: ChatHistoryItem[] = [];

  for (const item of chatHistory) {
    const splitItems = splitChatHistoryItem(item, terminalWidth);
    result.push(...splitItems);
  }

  return result;
}

/**
 * Estimates the height in terminal rows that content will take when rendered.
 */
function estimateContentHeight(content: string, terminalWidth: number): number {
  if (!content) return 0;

  const lines = content.split("\n");
  let totalHeight = 0;

  for (const line of lines) {
    if (line.length === 0) {
      totalHeight += 1; // Empty line
    } else {
      // Account for line wrapping
      totalHeight += Math.ceil(line.length / Math.max(terminalWidth - 2, 40));
    }
  }

  return totalHeight;
}

/**
 * Determines if content should be split based on its estimated height.
 */
function shouldSplitContent(content: string, terminalWidth: number): boolean {
  const estimatedHeight = estimateContentHeight(content, terminalWidth);
  return estimatedHeight > MAX_HEIGHT_BEFORE_SPLIT;
}
