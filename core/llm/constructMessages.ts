import { ChatHistory, ChatMessage, MessagePart } from "../index.js";

export function constructMessages(history: ChatHistory): ChatMessage[] {
  const msgs = [];

  for (let i = 0; i < history.length; i++) {
    const historyItem = history[i];

    let content = Array.isArray(historyItem.message.content)
      ? historyItem.message.content
      : [{ type: "text", text: historyItem.message.content } as MessagePart];

    const ctxItems = historyItem.contextItems.map((ctxItem) => {
      return { type: "text", text: `${ctxItem.content}\n` } as MessagePart;
    });

    content = [...ctxItems, ...content];

    msgs.push({
      role: historyItem.message.role,
      content,
    });
  }

  return msgs;
}
