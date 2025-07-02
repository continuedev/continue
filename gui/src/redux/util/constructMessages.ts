import {
  ChatHistoryItem,
  ChatMessage,
  ContextItemWithId,
  RuleWithSource,
  TextMessagePart,
  ToolResultChatMessage,
  UserChatMessage,
} from "core";
import { chatMessageIsEmpty } from "core/llm/messages";
import { getSystemMessageWithRules } from "core/llm/rules/getSystemMessageWithRules";
import { RulePolicies } from "core/llm/rules/types";
import { convertToolCallStateToXmlCallsAndOutput } from "core/tools/systemMessageTools/textifyXmlTools";
import { findLast, findLastIndex } from "core/util/findLast";
import {
  normalizeToMessageParts,
  renderContextItems,
} from "core/util/messageContent";

export const NO_TOOL_CALL_OUTPUT_MESSAGE = "No tool output";
export const CANCELLED_TOOL_CALL_MESSAGE = "The user cancelled this tool call.";

interface MessageWithContextItems {
  ctxItems: ContextItemWithId[];
  message: ChatMessage;
}
export function constructMessages(
  history: ChatHistoryItem[],
  baseSystemMessage: string | undefined,
  availableRules: RuleWithSource[],
  rulePolicies: RulePolicies,
  useSystemMessageTools = false,
): {
  messages: ChatMessage[];
  appliedRules: RuleWithSource[];
  appliedRuleIndex: number;
} {
  const historyCopy = [...history];

  const msgs: MessageWithContextItems[] = [];
  let appliedRuleIndex = -1;
  let index = -1;
  for (const item of historyCopy) {
    index++;
    if (
      item.message.role === "system" ||
      item.message.role === "tool" ||
      chatMessageIsEmpty(item.message)
    ) {
      // Tool messages will be re-inserted
      continue;
    }

    if (item.message.role === "user") {
      appliedRuleIndex = index;
      // Gather context items for user messages
      let content = normalizeToMessageParts(item.message);

      const ctxItemParts = item.contextItems
        .map((ctxItem) => {
          return {
            type: "text",
            text: `${ctxItem.content}\n`,
          } as TextMessagePart;
        })
        .filter((part) => !!part.text.trim());

      content = [...ctxItemParts, ...content];
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
      if (item.toolCallState && useSystemMessageTools) {
        const { userMessage, assistantMessage } =
          convertToolCallStateToXmlCallsAndOutput(
            item.message,
            item.toolCallState,
          );
        msgs.push({
          message: assistantMessage,
          ctxItems: [],
        });
        msgs.push({
          message: userMessage,
          ctxItems: [],
        });
      } else {
        msgs.push({
          ctxItems: item.contextItems,
          message: item.message,
        });

        // If the assistant message has tool calls, insert tool messages for each call
        // Or for system message tools add one user message with tool outputs
        if (item.message.toolCalls?.length) {
          for (const toolCall of item.message.toolCalls) {
            let content: string = NO_TOOL_CALL_OUTPUT_MESSAGE;
            // TODO parallel tool calls: toolCallState only supports one tool call per message for now
            if (item.toolCallState?.status === "canceled") {
              content = CANCELLED_TOOL_CALL_MESSAGE;
            } else if (
              item.toolCallState?.toolCallId === toolCall.id &&
              item.toolCallState?.output
            ) {
              content = renderContextItems(item.toolCallState.output);
            }
            msgs.push({
              // ctxItems: toolCallStateToContextItems(item.toolCallState),
              ctxItems: [],
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
  }

  // Some rules only apply to the last user or tool message
  const lastUserOrToolMsg = findLast(
    msgs,
    (item) => item.message.role === "user" || item.message.role === "tool",
  )?.message as UserChatMessage | ToolResultChatMessage;

  // Some rules apply to all context items since the last user message, inclusiv
  const lastUserMsgIndex = findLastIndex(
    msgs,
    (item) => item.message.role === "user",
  );
  const itemsBackToLastUserMessage = msgs
    .slice(lastUserMsgIndex, msgs.length)
    .filter(
      (item) => item.message.role === "tool" || item.message.role === "user",
    );
  const rulesContextItems = itemsBackToLastUserMessage
    .map((item) => item.ctxItems)
    .flat();

  const { systemMessage, appliedRules } = getSystemMessageWithRules({
    baseSystemMessage,
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
    appliedRules,
    appliedRuleIndex,
  };
}
