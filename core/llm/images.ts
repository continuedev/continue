import { MessageContent } from "../index.js";

export function stripImages(content: MessageContent): string {
    if (Array.isArray(content)) {
      return content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
    }
    return content;
  }