import {
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
import {
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";
import { chatMessageIsEmpty } from "core/llm/messages";
import { getSystemMessageWithRules } from "core/llm/rules/getSystemMessageWithRules";
import { RulePolicies } from "core/llm/rules/types";
import { findLastIndex } from "core/util/findLast";
import {
  normalizeToMessageParts,
  renderContextItems,
} from "core/util/messageContent";
import { toolCallStateToContextItems } from "../../pages/gui/ToolCallDiv/toolCallStateToContextItem";

interface MessageWithContextItems {
  ctxItems: ContextItemWithId[];
  message: ChatMessage;
}
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

  const msgs: MessageWithContextItems[] = [];
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
      // This was implemented for APIs that require all tool calls to have
      // A corresponsing tool sent, which means if a user excluded a tool
      // Then sessions with that tool call in the history would fail

      // // First, push a version of the message with any valid tools calls
      // const validToolCalls = item.message.toolCalls?.filter(
      //   (toolCall) =>
      //     toolCall.function?.name &&
      //     toolCall.id &&
      //     validTools.has(toolCall.function.name),
      // );

      // const msgWithValidToolCalls: AssistantChatMessage = {
      //   ...item.message,
      //   toolCalls: validToolCalls,
      // };

      // if (chatMessageIsEmpty(msgWithValidToolCalls)) {
      // msgs.push(...getChatSafeMessagesFromAgentToolCall(item));
      // }

      // Case where no valid tool calls or content are present
      msgs.push({
        ctxItems: item.contextItems,
        message: item.message,
      });

      // Add a tool message for each valid tool call
      // if(validToolCalls?.length) {
      if (item.message.toolCalls?.length) {
        // If the assistant message has tool calls, we need to insert tool messages
        for (const toolCall of item.message.toolCalls) {
          let content: string = "No tool output";
          // TODO toolCallState only supports one tool call per message for now
          if (item.toolCallState?.status === "canceled") {
            content = "The user cancelled this tool call.";
          } else if (
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

// function getChatSafeMessagesFromAgentToolCall(item: ChatHistoryItem): MessageWithContextItems[] {
//   if(item.message.role !== "assistant" || !item.message.toolCalls?.length) {
//     console.error("Misusing getChatSafeMessagesFromAgentToolCall")
//     return []
//   }
//   const assistantItem: MessageWithContextItems = {
//     ctxItems: item.toolCallState?.output ?? [],
//     message: {
//       role: "assistant",
//       content: item.message.content + "\n\n" + item.message.toolCalls.map(tc => tc.function.name).join(", ")
//     }
//   }
//   const userItem: MessageWithContextItems = {
//     ctxItems: item.toolCallState?.output,
//     message: {
//       role: "user",
//       content: item.message.content,
//     }
//   return [item, userItem]

//   if(message)

//   const msgs: MessageWithContextItems[] = [];
//   if (message.message.role === "assistant" && message.message.toolCalls) {
// }
