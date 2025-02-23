export function updateChatHistory(
  history: any[],
  commandName: string,
  renderedPrompt: string,
  systemMessage?: string,
) {
  const messages = [...history];

  for (let i = messages.length - 1; i >= 0; i--) {
    const { role, content } = messages[i];
    if (role !== "user") {
      continue;
    }

    if (Array.isArray(content)) {
      if (content.some((part) => part.text?.startsWith(`/${commandName}`))) {
        messages[i] = updateArrayContent(
          messages[i],
          commandName,
          renderedPrompt,
        );
        break;
      }
    } else if (
      typeof content === "string" &&
      content.startsWith(`/${commandName}`)
    ) {
      messages[i] = { ...messages[i], content: renderedPrompt };
      break;
    }
  }

  if (systemMessage) {
    messages[0]?.role === "system"
      ? (messages[0].content = systemMessage)
      : messages.unshift({ role: "system", content: systemMessage });
  }

  return messages;
}

function updateArrayContent(
  message: any,
  commandName: string,
  renderedPrompt: string,
) {
  return {
    ...message,
    content: message.content.map((part: any) =>
      part.text?.startsWith(`/${commandName}`)
        ? { ...part, text: renderedPrompt }
        : part,
    ),
  };
}
