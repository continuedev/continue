import { ChatMessage } from "..";

export function messageHasToolCalls(msg: ChatMessage): boolean {
  return msg.role === "assistant" && !!msg.toolCalls;
}

export function messageIsEmpty(message: ChatMessage): boolean {
  if (typeof message.content === "string") {
    return message.content.trim() === "";
  }
  if (Array.isArray(message.content)) {
    return message.content.every(
      (item) => item.type === "text" && item.text?.trim() === "",
    );
  }
  return false;
}

// some providers don't support empty messages
export function addSpaceToAnyEmptyMessages(
  messages: ChatMessage[],
): ChatMessage[] {
  return messages.map((message) => {
    if (messageIsEmpty(message)) {
      message.content = " ";
    }
    return message;
  });
}

export function isUserOrToolMsg(msg: ChatMessage | undefined): boolean {
  if (!msg) {
    return false;
  }
  return msg.role === "user" || msg.role === "tool";
}

export function isToolMessageForId(
  msg: ChatMessage | undefined,
  toolCallId: string,
): boolean {
  return !!msg && msg.role === "tool" && msg.toolCallId === toolCallId;
}

export function messageHasToolCallId(
  msg: ChatMessage | undefined,
  toolCallId: string,
): boolean {
  return (
    !!msg &&
    msg.role === "assistant" &&
    !!msg.toolCalls?.find((call) => call.id === toolCallId)
  );
}

export function chatMessageIsEmpty(message: ChatMessage): boolean {
  switch (message.role) {
    case "system":
    case "user":
      return (
        typeof message.content === "string" && message.content.trim() === ""
      );
    case "assistant":
      return (
        typeof message.content === "string" &&
        message.content.trim() === "" &&
        !message.toolCalls
      );
    case "thinking":
    case "tool":
      return false;
  }
}
