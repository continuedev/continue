import { ChatMessage } from "..";

export function messageHasToolCalls(msg: ChatMessage): boolean {
  return msg.role === "assistant" && !!msg.toolCalls;
}

function contentIsEmpty(content: ChatMessage["content"]): boolean {
  if (typeof content === "string") {
    return content.trim() === "";
  }
  if (Array.isArray(content)) {
    return content.every(
      (item) => item.type === "text" && (!item.text || item.text.trim() === ""),
    );
  }
  return !content;
}

export function messageIsEmpty(message: ChatMessage): boolean {
  return contentIsEmpty(message.content);
}

/** Strip empty text parts from array content. */
export function stripEmptyContentParts(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (Array.isArray(message.content)) {
      message.content = message.content.filter(
        (part) =>
          part.type !== "text" ||
          (part.text !== null &&
            part.text !== undefined &&
            part.text.trim() !== ""),
      );
      if (message.content.length === 0) {
        message.content = "";
      }
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
      return contentIsEmpty(message.content);
    case "assistant":
      return contentIsEmpty(message.content) && !message.toolCalls;
    case "thinking":
    case "tool":
      return false;
  }
}
