import { ChatMessage } from "../..";

export function replaceSlashCommandWithPromptInChatHistory(
  history: ChatMessage[],
  commandName: string,
  renderedPrompt: string,
  systemMessageOverride?: string,
  originalPrompt?: string,
): ChatMessage[] {
  const newMessages: ChatMessage[] = [];
  for (const message of history) {
    if (message.role === "system") {
      if (systemMessageOverride) {
        newMessages.push({
          role: "system",
          content: systemMessageOverride,
        });
      } else {
        newMessages.push(message);
      }
    } else if (message.role === "user") {
      if (typeof message.content === "string") {
        if (message.content.startsWith(`/${commandName}`)) {
          newMessages.push({
            ...message,
            content: renderedPrompt,
          });
        } else {
          newMessages.push(message);
        }
      } else {
        if (
          message.content.some(
            (part) =>
              part.type === "text" && part.text?.startsWith(`/${commandName}`),
          )
        ) {
          newMessages.push({
            ...message,
            content: message.content.map((part: any) =>
              part.text?.startsWith(`/${commandName}`)
                ? { ...part, text: renderedPrompt }
                : part,
            ),
          });
        } else {
          newMessages.push(message);
        }
      }
    } else {
      newMessages.push(message);
    }
  }

  if (
    systemMessageOverride &&
    !newMessages.find((msg) => msg.role === "system")
  ) {
    newMessages.unshift({
      role: "system",
      content: systemMessageOverride,
    });
  }

  return newMessages;
}
