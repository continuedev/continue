import {
  ChatHistoryItem,
  ChatMessage,
  ModelDescription,
  RuleWithSource,
  TextMessagePart,
  ToolResultChatMessage,
  UserChatMessage,
} from "../";
import { findLastIndex } from "../util/findLast";
import { normalizeToMessageParts } from "../util/messageContent";
import { getSystemMessageWithRules } from "./rules/getSystemMessageWithRules";
import { RulePolicies } from "./rules/types";

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
`;

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
  model: ModelDescription,
  availableRules: RuleWithSource[],
  rulePolicies: RulePolicies,
): {
  messages: ChatMessage[];
  appliedRules: RuleWithSource[];
  lastMessageIndex: number;
} {
  const filteredHistory = history.filter(
    (item) => item.message.role !== "system",
  );
  const msgs: ChatMessage[] = [];

  for (let i = 0; i < filteredHistory.length; i++) {
    const historyItem = filteredHistory[i];

    if (messageMode === "chat") {
      const toolMessage: ToolResultChatMessage =
        historyItem.message as ToolResultChatMessage;
      if (historyItem.toolCallState?.toolCallId || toolMessage.toolCallId) {
        // remove all tool calls from the history
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

  let baseChatOrAgentSystemMessage: string | undefined;
  if (messageMode === "agent") {
    baseChatOrAgentSystemMessage =
      model.baseAgentSystemMessage ?? DEFAULT_AGENT_SYSTEM_MESSAGE;
  } else {
    baseChatOrAgentSystemMessage =
      model.baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE;
  }

  // Determine which rules apply to this message
  const lastUserOrToolItemIdx = findLastIndex(
    history,
    (item) => item.message.role === "user" || item.message.role === "tool",
  );
  const lastUserOrToolHistoryItem = history[lastUserOrToolItemIdx];
  // const lastUserOrToolItem = lastUserOrToolItemIdx === -1 ? undefined
  const lastUserOrToolMessage = lastUserOrToolHistoryItem?.message as
    | UserChatMessage
    | ToolResultChatMessage
    | undefined;

  // Get context items for the last user message
  const { systemMessage, appliedRules } = getSystemMessageWithRules({
    baseSystemMessage: baseChatOrAgentSystemMessage,
    availableRules,
    userMessage: lastUserOrToolMessage,
    contextItems: lastUserOrToolHistoryItem?.contextItems ?? [],
    rulePolicies,
  });

  if (systemMessage.trim()) {
    msgs.unshift({
      role: "system",
      content: systemMessage,
    });
  }

  // Remove the "id" from all of the messages
  const messages = msgs.map((msg) => {
    const { id, ...rest } = msg as any;
    return rest;
  });
  return {
    messages,
    appliedRules,
    lastMessageIndex: lastUserOrToolItemIdx,
  };
}
