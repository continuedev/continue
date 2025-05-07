import {
  ChatHistoryItem,
  ChatMessage,
  RuleWithSource,
  TextMessagePart,
  ToolResultChatMessage,
  UserChatMessage,
} from "../";
import { findLast } from "../util/findLast";
import { normalizeToMessageParts } from "../util/messageContent";
import { isUserOrToolMsg, messageHasToolCallId } from "./messages";
import { getSystemMessageWithRules } from "./rules/getSystemMessageWithRules";
import { BuiltInToolNames } from "../tools/builtIn";

export const DEFAULT_CHAT_SYSTEM_MESSAGE_URL =
  "https://github.com/continuedev/continue/blob/main/core/llm/constructMessages.ts";

export const DEFAULT_AGENT_SYSTEM_MESSAGE_URL =
  "https://github.com/continuedev/continue/blob/main/core/llm/constructMessages.ts";

const EDIT_MESSAGE = `\
  Always include the language and file name in the info string when you write code blocks.
  If you are editing "src/main.py" for example, your code block should start with '\`\`\`python src/main.py'

  When addressing code modification requests, present a concise code snippet that
  emphasizes only the necessary changes and uses abbreviated placeholders for
  unmodified sections. For example:

  \`\`\`language /path/to/file
  // ... existing code ...

  {{ modified code here }}

  // ... existing code ...

  {{ another modification }}

  // ... rest of code ...
  \`\`\`

  In existing files, you should always restate the function or class that the snippet belongs to:

  \`\`\`language /path/to/file
  // ... existing code ...

  function exampleFunction() {
    // ... existing code ...

    {{ modified code here }}

    // ... rest of function ...
  }

  // ... rest of code ...
  \`\`\`

  Since users have access to their complete file, they prefer reading only the
  relevant modifications. It's perfectly acceptable to omit unmodified portions
  at the beginning, middle, or end of files using these "lazy" comments. Only
  provide the complete file when explicitly requested. Include a concise explanation
  of changes unless the user specifically asks for code only.
`

export const DEFAULT_CHAT_SYSTEM_MESSAGE = `\
<important_rules>
  You are in chat mode.

  If the user asks to make changes to files offer that they can use the Apply Button on the code block, or switch to Agent Mode to make the suggested updates automatically.
  If needed consisely explain to the user they can switch to agent mode using the Mode Selector dropdown and provide no other details.

${EDIT_MESSAGE}
</important_rules>`;

export const DEFAULT_AGENT_SYSTEM_MESSAGE = `\
<important_rules>
  You are in agent mode.

${EDIT_MESSAGE}
</important_rules>`;

export function constructMessages(
  messageMode: string,
  history: ChatHistoryItem[],
  baseChatOrAgentSystemMessage: string | undefined,
  rules: RuleWithSource[],
): ChatMessage[] {
  const filteredHistory = history.filter(
    (item) => item.message.role !== "system",
  );
  const msgs: ChatMessage[] = [];
  const toolCallIdsToRemove: string[] = [];

  for (let i = 0; i < filteredHistory.length; i++) {
    const historyItem = filteredHistory[i];

    if (messageMode === "chat") {
      if (historyItem.toolCallState?.toolCallId) {
        // remove all tool calls from the history
        toolCallIdsToRemove.push(historyItem.toolCallState.toolCall.id);
        continue;
      }

      const toolMessage: ToolResultChatMessage = historyItem.message as ToolResultChatMessage;
      if (toolMessage.toolCallId && toolCallIdsToRemove.includes(toolMessage.toolCallId)) {
        // remove toolcall responses from the history
        continue;
      }
    }

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
    } else {
      msgs.push(historyItem.message);
    }
  }

  const lastUserMsg = findLast(msgs, isUserOrToolMsg) as
    | UserChatMessage
    | ToolResultChatMessage
    | undefined;

  const systemMessage = getSystemMessageWithRules({
    baseSystemMessage: baseChatOrAgentSystemMessage,
    rules,
    userMessage: lastUserMsg,
  });

  if (systemMessage.trim()) {
    msgs.unshift({
      role: "system",
      content: systemMessage,
    });
  }

  // Remove the "id" from all of the messages
  return msgs.map((msg) => {
    const { id, ...rest } = msg as any;
    return rest;
  });
}
