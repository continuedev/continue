import { SlashCommand } from "../../index";

const GitHubCopilotCommand: SlashCommand = {
  name: "github-copilot",
  description: "Interact with GitHub Copilot",
  run: async function* ({ input, llm, history, ide }) {
    // Remove slash command prefix from input
    let userInput = input;
    if (userInput.startsWith(`/github-copilot`)) {
      userInput = userInput.slice("github-copilot".length + 1).trimStart();
    }

    // Render prompt template
    const promptUserInput = userInput;

    const messages = [...history];
    // Find the last chat message with this slash command and replace it with the user input
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const { role, content } = message;
      if (role !== "user") {
        continue;
      }

      if (
        Array.isArray(content) &&
        content.some((part) => part.text?.startsWith(`/github-copilot`))
      ) {
        messages[i] = {
          ...message,
          content: content.map((part) => {
            return part.text?.startsWith(`/github-copilot`)
              ? { ...part, text: promptUserInput }
              : part;
          }),
        };
        break;
      } else if (
        typeof content === "string" &&
        content.startsWith(`/github-copilot`)
      ) {
        messages[i] = { ...message, content: promptUserInput };
        break;
      }
    }

    for await (const chunk of llm.streamChat(
      messages,
      new AbortController().signal,
    )) {
      yield chunk;
    }
  },
};

export default GitHubCopilotCommand;
