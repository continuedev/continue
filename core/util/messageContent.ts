import {
  ChatMessage,
  ContextItem,
  MessageContent,
  MessagePart,
} from "../index";

export function stripImages(messageContent: MessageContent): string {
  if (typeof messageContent === "string") {
    return messageContent;
  }

  return messageContent
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function renderChatMessage(message: ChatMessage): string {
  switch (message.role) {
    case "user":
    case "assistant":
    case "system":
      return stripImages(message.content);
    case "tool":
      return message.content;
  }
}

export function renderContextItems(contextItems: ContextItem[]): string {
  return contextItems.map((item) => item.content).join("\n\n");
}

export function normalizeToMessageParts(message: ChatMessage): MessagePart[] {
  switch (message.role) {
    case "user":
    case "assistant":
    case "system":
      return Array.isArray(message.content)
        ? message.content
        : [{ type: "text", text: message.content }];
    case "tool":
      return [{ type: "text", text: message.content }];
  }
}
