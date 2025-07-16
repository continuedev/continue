import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";
import {
  isAuthenticated,
  isAuthenticatedConfig,
  loadAuthConfig,
  login,
  logout,
} from "./auth/workos.js";

export async function handleSlashCommands(
  input: string,
  assistant: AssistantConfig,
  onLoginPrompt?: (promptText: string) => Promise<string>
): Promise<{
  output?: string;
  exit?: boolean;
  newInput?: string;
  clear?: boolean;
} | null> {
  // Only trigger slash commands if slash is the very first character
  if (input.startsWith("/") && input.trim().startsWith("/")) {
    const [command, ...args] = input.slice(1).split(" ");
    switch (command) {
      case "help":
        const helpMessage = [
          "Available commands:",
          "/help - Show this help message",
          "/clear - Clear the chat history",
          "/exit - Exit the chat",
          "/login - Authenticate with your account",
          "/logout - Sign out of your current session",
          "/whoami - Check who you're currently logged in as",
          ...(assistant.prompts?.map(
            (prompt) => `/${prompt?.name} - ${prompt?.description}`
          ) ?? []),
        ].join("\n");
        return { output: helpMessage };
      case "clear":
        return { clear: true, output: "Chat history cleared" };
      case "exit":
        return { exit: true, output: "Goodbye!" };
      case "login":
        login(false, onLoginPrompt)
          .then((config) => {
            if (config && isAuthenticatedConfig(config)) {
              console.info(
                chalk.green(
                  `\nLogged in as ${config.userEmail || config.userId}`
                )
              );
            } else {
              console.info(chalk.green(`\nLogged in successfully`));
            }
          })
          .catch((error) => {
            console.error(chalk.red(`\nLogin failed: ${error.message}`));
          });
        return {
          exit: false,
          output: "Starting login process...",
        };

      case "logout":
        logout();
        return {
          exit: false,
          output: "Logged out successfully",
        };

      case "whoami":
        if (isAuthenticated()) {
          const config = loadAuthConfig();
          if (config && isAuthenticatedConfig(config)) {
            return {
              exit: false,
              output: `Logged in as ${config.userEmail || config.userId}`,
            };
          } else {
            return {
              exit: false,
              output: "Authenticated via environment variable",
            };
          }
        } else {
          return {
            exit: false,
            output: "Not logged in. Use /login to authenticate.",
          };
        }

      default:
        const assistantPrompt = assistant.prompts?.find(
          (prompt) => prompt?.name === command
        );
        if (assistantPrompt) {
          const newInput = assistantPrompt.prompt + args.join(" ");
          return { newInput };
        }
        return { output: `Unknown command: ${command}` };
    }
  }
  return null;
}