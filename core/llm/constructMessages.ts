import {
  ChatHistoryItem,
  ChatMessage,
  MessagePart,
  ModelDescription,
} from "../";
import { normalizeToMessageParts } from "../util/messageContent";

import { modelSupportsTools } from "./autodetect";

const TOOL_USE_RULES = `<tool_use_rules>
  When using tools, follow the following guidelines:
  - Avoid calling tools unless they are absolutely necessary. For example, if you are asked a simple programming question you do not need web search. As another example, if the user asks you to explain something about code, do not create a new file.
</tool_use_rules>`;

function constructSystemPrompt(
  modelDescription: ModelDescription,
  useTools: boolean,
): string | null {
  let systemMessage = `<important_rules>
  Always include the language and file name in the info string when you write code blocks. If you are editing "src/main.py" for example, your code block should start with '\`\`\`python src/main.py'.
</important_rules>`;
  if (useTools && modelSupportsTools(modelDescription)) {
    systemMessage += "\n\n" + TOOL_USE_RULES;
  }
  return systemMessage;
}

const CANCELED_TOOL_CALL_MESSAGE =
  "This tool call was cancelled by the user. You should clarify next steps, as they don't wish for you to use this tool.";

export function constructMessages(
  history: ChatHistoryItem[],
  modelDescription: ModelDescription,
  useTools: boolean,
): ChatMessage[] {
  const filteredHistory = history.filter(
    (item) => item.message.role !== "system",
  );
  const msgs: ChatMessage[] = [];

  const systemMessage = constructSystemPrompt(modelDescription, useTools);
  if (systemMessage) {
    msgs.push({
      role: "system",
      content: systemMessage,
    });
  }

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
