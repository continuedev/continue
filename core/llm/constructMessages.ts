import { ChatHistoryItem, ChatMessage, MessagePart } from "../";
import { normalizeToMessageParts } from "../util/messageContent";

const DEFAULT_SYSTEM_MESSAGE = `<important_rules>
  Always include the language and file name in the info string when you write code blocks. If you are editing "src/main.py" for example, your code block should start with '\`\`\`python src/main.py'.
</important_rules>`;

const CANCELED_TOOL_CALL_MESSAGE =
  "This tool call was cancelled by the user. You should clarify next steps, as they don't wish for you to use this tool.";

export function constructMessages(
  history: ChatHistoryItem[],
  baseChatSystemMessage: string | undefined,
): ChatMessage[] {
  const filteredHistory = history.filter(
    (item) => item.message.role !== "system",
  );
  const msgs: ChatMessage[] = [];

  msgs.push({
    role: "system",
    content: baseChatSystemMessage ?? DEFAULT_SYSTEM_MESSAGE,
  });

  for (let i = 0; i < filteredHistory.length; i++) {
    const historyItem = filteredHistory[i];

    if (historyItem.message.role === "user") {
      // Gather context items for user messages
      let content = normalizeToMessageParts(historyItem.message);

      const ctxItems = historyItem.contextItems.map((ctxItem) => {
        return { type: "text", text: `${ctxItem.content}\n` } as MessagePart;
      });

      content = [...ctxItems, ...content];
      msgs.push({
        ...historyItem.message,
        content,
      });
    } else if (historyItem.toolCallState?.status === "canceled") {
      // Canceled tool call
      msgs.push({
        ...historyItem.message,
        content: CANCELED_TOOL_CALL_MESSAGE,
      });
    } else {
      msgs.push(historyItem.message);
    }
  }

  // Remove the "id" from all of the messages
  return msgs.map((msg) => {
    const { id, ...rest } = msg as any;
    return rest;
  });
}
