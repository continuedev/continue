import {
  ChatHistoryItem,
  ChatMessage,
  ContextItemWithId,
  ModelDescription,
  RuleWithSource,
  TextMessagePart,
  ToolResultChatMessage,
  UserChatMessage,
} from "core";
import {
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
  DEFAULT_PLAN_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";
import { chatMessageIsEmpty } from "core/llm/messages";
import { getSystemMessageWithRules } from "core/llm/rules/getSystemMessageWithRules";
import { RulePolicies } from "core/llm/rules/types";
import { findLast, findLastIndex } from "core/util/findLast";
import {
  normalizeToMessageParts,
  renderContextItems,
} from "core/util/messageContent";
import { toolCallStateToContextItems } from "../../pages/gui/ToolCallDiv/utils";

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
): {
  messages: ChatMessage[];
  appliedRules: RuleWithSource[];
  appliedRuleIndex: number;
} {
  // Find the most recent conversation summary and filter history accordingly
  let summaryContent = "";
  let filteredHistory = history;

  for (let i = history.length - 1; i >= 0; i--) {
    const summary = history[i].conversationSummary;
    if (summary) {
      summaryContent = summary;
      // Only include messages that come AFTER the message with the summary
      filteredHistory = history.slice(i + 1);
      break;
    }
  }

  const historyCopy = [...filteredHistory];

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
      msgs.push({
        ctxItems: item.contextItems,
        message: item.message,
      });

      // Add a tool message for each tool call
      if (item.message.toolCalls?.length) {
        // If the assistant message has tool calls, we need to insert tool messages
        for (const toolCall of item.message.toolCalls) {
          let content: string = NO_TOOL_CALL_OUTPUT_MESSAGE;

          // Find the corresponding tool call state for this specific tool call
          const toolCallState = item.toolCallStates?.find(
            (state) => state.toolCallId === toolCall.id,
          );

          if (toolCallState?.status === "canceled") {
            content = CANCELLED_TOOL_CALL_MESSAGE;
          } else if (toolCallState?.output) {
            content = renderContextItems(toolCallState.output);
          }

          msgs.push({
            ctxItems: toolCallStateToContextItems(toolCallState),
            message: {
              role: "tool",
              content,
              toolCallId: toolCall.id!,
            },
          });
        }
      } else if (item.toolCallStates && item.toolCallStates.length > 0) {
        // This case indicates a potential mismatch - we have tool call states but no message.toolCalls
        console.error(
          "ERROR constructMessages: Assistant message has toolCallStates but no message.toolCalls:",
          {
            toolCallStates: item.toolCallStates.length,
            toolCallIds: item.toolCallStates.map((s) => s.toolCallId),
            messageContent:
              typeof item.message.content === "string"
                ? item.message.content?.substring(0, 50) + "..."
                : "Non-string content",
          },
        );
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

  // Append conversation summary to system message if it exists
  let finalSystemMessage = systemMessage;
  if (summaryContent) {
    finalSystemMessage = systemMessage
      ? `${systemMessage}\n\nPrevious conversation summary:\n\n ${summaryContent}`
      : `Previous conversation summary:\n\n ${summaryContent}`;
  }

  if (finalSystemMessage.trim()) {
    msgs.unshift({
      ctxItems: [],
      message: {
        role: "system",
        content: finalSystemMessage,
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

export function getBaseSystemMessage(
  messageMode: string,
  model: ModelDescription,
): string {
  if (messageMode === "agent") {
    return model.baseAgentSystemMessage ?? DEFAULT_AGENT_SYSTEM_MESSAGE;
  } else if (messageMode === "plan") {
    return model.basePlanSystemMessage ?? DEFAULT_PLAN_SYSTEM_MESSAGE;
  } else {
    return model.baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE;
  }
}
