import { AssistantChatMessage, ThinkingChatMessage } from "core";
import { renderChatMessage } from "core/util/messageContent";
import { v4 as uuidv4 } from "uuid";
import { addToolCallDeltaToState } from "../../util/toolCallState";
import { ChatHistoryItemWithMessageId } from "./sessionSlice";

export function mergeAssistantMessageToChatHistoryItem(
  lastItem: ChatHistoryItemWithMessageId,
  incomingMessage: AssistantChatMessage,
) {
  const lastMessage = lastItem.message as AssistantChatMessage;

  const newContent = renderChatMessage(incomingMessage);

  if (lastItem.reasoning?.active) {
    if (newContent.includes("</think>")) {
      const [reasoningEnd, answerStart] = newContent.split("</think>");
      lastItem.reasoning.text += reasoningEnd.trimEnd();
      lastItem.reasoning.active = false;
      lastItem.reasoning.endAt = Date.now();
      lastMessage.content += answerStart.trimStart();
    } else {
      lastItem.reasoning.text += newContent;
    }
  } else if (newContent.includes("<think>")) {
    lastItem.reasoning = {
      startAt: Date.now(),
      active: true,
      text: newContent.replace("<think>", "").trim(),
    };
  } else {
    // normal non reasoning message cause
    lastMessage.content = renderChatMessage(lastMessage) + newContent;
  }

  if (!!incomingMessage.toolCalls?.length) {
    // Only support one tool call at a time for now
    const toolCallDelta = incomingMessage.toolCalls[0];
    const newToolCallState = addToolCallDeltaToState(
      toolCallDelta,
      lastItem.toolCallState,
    );
    lastItem.toolCallState = newToolCallState;
    lastMessage.toolCalls = [newToolCallState.toolCall];
  }
}

export function createAssistantChatHistoryItem(
  incomingMessage: AssistantChatMessage,
): ChatHistoryItemWithMessageId {
  const newMessage: AssistantChatMessage = {
    role: "assistant",
    content: "",
    toolCalls: incomingMessage.toolCalls,
  };

  const newItem: ChatHistoryItemWithMessageId = {
    contextItems: [],
    message: {
      ...newMessage,
      id: uuidv4(),
    },
  };

  const newContent = renderChatMessage(incomingMessage);

  if (newContent.includes("<think>")) {
    newItem.reasoning = {
      startAt: Date.now(),
      active: true,
      text: newContent.replace("<think>", "").trim(),
    };
  } else {
    // normal non reasoning message cause
    newItem.message.content = renderChatMessage(incomingMessage);
  }

  if (!!incomingMessage.toolCalls?.length) {
    const toolCallDelta = incomingMessage.toolCalls[0];
    const newToolCallState = addToolCallDeltaToState(toolCallDelta, undefined);
    newItem.toolCallState = newToolCallState;
    (newItem.message as AssistantChatMessage).toolCalls = [
      newToolCallState.toolCall,
    ];
  }
  return newItem;
}

const REDACTED_THINKING_CONTENT =
  "Internal reasoning is hidden due to safety reasons";
export function createThinkingChatHistoryItem(
  newMessage: ThinkingChatMessage,
): ChatHistoryItemWithMessageId {
  return {
    contextItems: [],
    message: {
      role: "thinking",
      id: uuidv4(),
      content: newMessage.redactedThinking
        ? REDACTED_THINKING_CONTENT
        : newMessage.content,
      signature: newMessage.signature,
      redactedThinking: newMessage.redactedThinking,
    },
  };
}

export function mergeThinkingMessageToChatHistoryItem(
  lastItem: ChatHistoryItemWithMessageId,
  incomingMessage: ThinkingChatMessage,
) {
  const lastMessage = lastItem.message as ThinkingChatMessage;
  // Signature overrides
  if (incomingMessage.signature) {
    lastMessage.signature = incomingMessage.signature;
  }
  // Redacted thinking appends and replaces content
  if (incomingMessage.redactedThinking) {
    lastMessage.redactedThinking =
      (lastMessage.redactedThinking ?? "") + incomingMessage.redactedThinking;
    lastMessage.content = REDACTED_THINKING_CONTENT;
  } else if (incomingMessage.content) {
    lastMessage.content =
      renderChatMessage(lastMessage) + incomingMessage.content;
  }
}
