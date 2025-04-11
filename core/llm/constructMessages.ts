import {
  ChatHistoryItem,
  ChatMessage,
  RuleWithSource,
  TextMessagePart,
  UserChatMessage,
} from "../";
import { findLast } from "../util/findLast";
import { normalizeToMessageParts } from "../util/messageContent";
import { messageIsEmpty } from "./countTokens";
import { getSystemMessageWithRules } from "./rules/getSystemMessageWithRules";

export const DEFAULT_CHAT_SYSTEM_MESSAGE_URL =
  "https://github.com/continuedev/continue/blob/main/core/llm/constructMessages.ts#L8";

export const DEFAULT_CHAT_SYSTEM_MESSAGE = `\
<important_rules>
  Always include the language and file name in the info string when you write code blocks. 
  If you are editing "src/main.py" for example, your code block should start with '\`\`\`python src/main.py'

  When addressing code modification requests, present a concise code snippet that
  emphasizes only the necessary changes and uses abbreviated placeholders for
  unmodified sections. For instance:

  \`\`\`typescript /path/to/file
  // ... rest of code here ...

  {{ modified code here }}

  // ... rest of code here ...

  {{ another modification }}

  // ... rest of code here ...
  \`\`\`

  Since users have access to their complete file, they prefer reading only the
  relevant modifications. It's perfectly acceptable to omit unmodified portions
  at the beginning, middle, or end of files using these "lazy" comments. Only
  provide the complete file when explicitly requested. Include a concise explanation
  of changes unless the user specifically asks for code only.
</important_rules>`;

const CANCELED_TOOL_CALL_MESSAGE =
  "This tool call was cancelled by the user. You should clarify next steps, as they don't wish for you to use this tool.";

export function constructMessages(
  history: ChatHistoryItem[],
  baseChatSystemMessage: string | undefined,
  rules: RuleWithSource[],
  modelName: string,
): ChatMessage[] {
  const filteredHistory = history.filter(
    (item) => item.message.role !== "system",
  );
  const msgs: ChatMessage[] = [];

  for (let i = 0; i < filteredHistory.length; i++) {
    const historyItem = filteredHistory[i];

    if (historyItem.message.role === "user") {
      // Gather context items for user messages
      let content = normalizeToMessageParts(historyItem.message);

      const ctxItems = historyItem.contextItems
        .map((ctxItem) => {
          return {
            type: "text",
            text: `${ctxItem.content}\n`,
          } as TextMessagePart;
        })
        .filter((part) => !!part.text.trim());

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

  const userMessage = findLast(msgs, (msg) => msg.role === "user") as
    | UserChatMessage
    | undefined;
  const systemMessage = getSystemMessageWithRules({
    baseSystemMessage: baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE,
    rules,
    userMessage,
    currentModel: modelName,
  });
  if (systemMessage.trim()) {
    msgs.unshift({
      role: "system",
      content: systemMessage,
    });
  }

  // We dispatch an empty assistant chat message to the history on submission. Don't send it
  const lastMessage = msgs.at(-1);
  if (
    lastMessage &&
    lastMessage.role === "assistant" &&
    messageIsEmpty(lastMessage)
  ) {
    msgs.pop();
  }

  // Remove the "id" from all of the messages
  return msgs.map((msg) => {
    const { id, ...rest } = msg as any;
    return rest;
  });
}
