import { AssistantUnrolled } from "@continuedev/config-yaml";

export function handleSlashCommands(
  input: string,
  assistant: AssistantUnrolled,
): {
  output?: string;
  exit?: boolean;
  newInput?: string;
} {
  if (input.startsWith("/")) {
    const [command, ...args] = input.slice(1).split(" ");
    switch (command) {
      case "help":
        const helpMessage = [
          "Available commands:",
          "/help - Show this help message",
          "/exit - Exit the chat",
          ...(assistant.prompts?.map(
            (prompt) => `/${prompt.name} - ${prompt.description}`,
          ) ?? []),
        ].join("\n");
        return { output: helpMessage };
      case "models":
        return {
          output: `Available models:\n• ${assistant.models?.map((model) => model.name)?.join("\n• ") || "None"}`,
        };
      case "exit":
        return { exit: true, output: "Goodbye!" };
      default:
        const assistantPrompt = assistant.prompts?.find(
          (prompt) => prompt.name === command,
        );
        if (assistantPrompt) {
          const newInput = assistantPrompt.prompt + args.join(" ");
          return { newInput };
        }
        return { output: `Unknown command: ${command}` };
    }
  }
  return {};
}
