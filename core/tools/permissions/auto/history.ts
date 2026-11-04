import type { ChatHistoryItem } from "../../..";
import type { ReviewHistory } from "./prompt";

/**
 * What the reviewer is shown of a conversation: the user's own messages and
 * the earlier tool calls (name and arguments), never the agent's prose or any
 * tool output.
 */
export function buildReviewHistory(history: ChatHistoryItem[]): ReviewHistory {
  const userMessages: string[] = [];
  const toolCalls: ReviewHistory["toolCalls"] = [];
  for (const item of history) {
    const { message } = item;
    if (message.role === "user") {
      const text =
        typeof message.content === "string"
          ? message.content
          : message.content
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
      if (text.trim()) userMessages.push(text);
    }
    for (const call of item.toolCallStates ?? []) {
      toolCalls.push({
        name: call.toolCall.function.name,
        args: call.parsedArgs,
      });
    }
  }
  return { userMessages, toolCalls };
}
