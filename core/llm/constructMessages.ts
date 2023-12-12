import { ChatHistory, ChatMessage } from "./types";

export function constructMessages(history: ChatHistory): ChatMessage[] {
  const msgs: ChatMessage[] = [];

  for (const historyItem of history) {
    for (const ctxItem of historyItem.contextItems) {
      msgs.push({
        role: historyItem.message.role,
        content: ctxItem.content,
      });
    }
    msgs.push(historyItem.message);
  }

  return msgs;
}
