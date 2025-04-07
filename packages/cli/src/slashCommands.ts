export function handleSlashCommands(input: string): string | null {
  if (input.startsWith("/")) {
    const [command, ...args] = input.split(" ");
    switch (command) {
      case "/help":
        return "Available commands:\n/help - Show this help message\n/exit - Exit the chat";
      case "/exit":
        return "exit";
      default:
        return `Unknown command: ${command}`;
    }
  }
  return null;
}
