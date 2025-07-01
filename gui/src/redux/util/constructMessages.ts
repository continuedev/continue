import {
  AssistantChatMessage,
  ChatHistoryItem,
  ChatMessage,
  ContextItemWithId,
  ModelDescription,
  RuleWithSource,
  TextMessagePart,
  Tool,
  ToolResultChatMessage,
  UserChatMessage,
} from "core";
import { chatMessageIsEmpty } from "core/llm/messages";
import { getSystemMessageWithRules } from "core/llm/rules/getSystemMessageWithRules";
import { RulePolicies } from "core/llm/rules/types";
import { findLastIndex } from "core/util/findLast";
import {
  normalizeToMessageParts,
  renderContextItems,
} from "core/util/messageContent";
import { toolCallStateToContextItems } from "../../pages/gui/ToolCallDiv/toolCallStateToContextItem";

export const DEFAULT_CHAT_SYSTEM_MESSAGE_URL =
  "https://github.com/continuedev/continue/blob/main/gui/src/redux/util/constructMessages.ts";

export const DEFAULT_AGENT_SYSTEM_MESSAGE_URL =
  "https://github.com/continuedev/continue/blob/main/gui/src/redux/util/constructMessages.ts";

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
  tools: Tool[],
): {
  messages: ChatMessage[];
  appliedRulesIndex: number;
  appliedRules: RuleWithSource[];
} {
  const historyCopy = [...history];
  const validTools = new Set(tools.map((tool) => tool.function.name));

  const msgs: {
    ctxItems: ContextItemWithId[];
    message: ChatMessage;
  }[] = [];
  for (const item of historyCopy) {
    if (
      item.message.role === "system" ||
      item.message.role === "tool" ||
      chatMessageIsEmpty(item.message)
    ) {
      // Tool messages will be re-inserted
      continue;
    }

    if (item.message.role === "user") {
      // Gather context items for user messages
      let content = normalizeToMessageParts(item.message);

      const ctxItems = item.contextItems
        .map((ctxItem) => {
          return {
            type: "text",
            text: `${ctxItem.content}\n`,
          } as TextMessagePart;
        })
        .filter((part) => !!part.text.trim());

      content = [...ctxItems, ...content];
      msgs.push({
        ctxItems: item.contextItems,
        message: {
          ...item.message,
          content,
        },
      });
    } else if (item.message.role === "thinking") {
      msgs.push({
        ctxItems: item.contextItems,
        message: item.message,
      });
    } else if (item.message.role === "assistant") {
      // First, push a version of the message with any valid tools calls
      const validToolCalls = item.message.toolCalls?.filter(
        (toolCall) =>
          toolCall.function?.name &&
          toolCall.id &&
          validTools.has(toolCall.function.name),
      );

      const msgWithValidToolCalls: AssistantChatMessage = {
        ...item.message,
        toolCalls: validToolCalls,
      };

      if (chatMessageIsEmpty(msgWithValidToolCalls)) {
        msgs.push({
          ctxItems: [],
          message: {
            role: "assistant",
            content: "Tool call message redacted in chat mode", // TODO this might be confusing, edge case situation where tools are excluded
          },
        });
      }

      // This was implemented for APIs that require all tool calls to have
      // A corresponsing tool sent, which means if a user excluded a tool
      // Then sessions with that tool call in the history would fail

      // Case where no valid tool calls or content are present
      msgs.push({
        ctxItems: item.contextItems,
        message: msgWithValidToolCalls,
      });

      // Add a tool message for each valid tool call
      if (validToolCalls?.length) {
        // If the assistant message has tool calls, we need to insert tool messages
        for (const toolCall of validToolCalls) {
          let content: string = "No tool output";
          // TODO toolCallState only supports one tool call per message for now
          if (
            item.toolCallState?.toolCallId === toolCall.id &&
            item.toolCallState?.output
          ) {
            content = renderContextItems(item.toolCallState.output);
          }
          msgs.push({
            ctxItems: toolCallStateToContextItems(item.toolCallState),
            message: {
              role: "tool",
              content,
              toolCallId: toolCall.id!,
            },
          });
        }
      }
    }
  }

  const lastUserMsgIndex = findLastIndex(
    msgs,
    (item) => item.message.role === "user",
  );
  const lastUserOrToolMsgIndex = findLastIndex(
    msgs,
    (item) => item.message.role === "user" || item.message.role === "tool",
  );
  const lastUserOrToolMsg = msgs[lastUserOrToolMsgIndex]?.message as
    | UserChatMessage
    | ToolResultChatMessage;
  const itemsBackToLastUserMessage = msgs
    .slice(lastUserMsgIndex, msgs.length)
    .filter(
      (item) => item.message.role === "tool" || item.message.role === "user",
    );
  const rulesContextItems = itemsBackToLastUserMessage
    .map((item) => item.ctxItems)
    .flat();

  // Get system message
  let baseChatOrAgentSystemMessage: string | undefined;
  if (messageMode === "agent") {
    baseChatOrAgentSystemMessage =
      model.baseAgentSystemMessage ?? DEFAULT_AGENT_SYSTEM_MESSAGE;
  } else {
    baseChatOrAgentSystemMessage =
      model.baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE;
  }

  const { systemMessage } = getSystemMessageWithRules({
    baseSystemMessage: baseChatOrAgentSystemMessage,
    availableRules,
    userMessage: lastUserOrToolMsg,
    contextItems: rulesContextItems,
    rulePolicies,
  });

  if (systemMessage.trim()) {
    msgs.unshift({
      ctxItems: [],
      message: {
        role: "system",
        content: systemMessage,
      },
    });
  }

  const messages = msgs.map((m) => m.message);
  return {
    messages,
    appliedRulesIndex: lastUserOrToolMsgIndex,
    appliedRules: availableRules,
  };
}
