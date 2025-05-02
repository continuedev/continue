import chalk from "chalk";
import {
  isAuthenticated,
  loadAuthConfig,
  login,
  logout,
} from "./auth/workos.js";
import { type AssistantConfig } from "@continuedev/sdk";

export function handleSlashCommands(
  input: string,
  assistant: AssistantConfig
): {
  output?: string;
  exit?: boolean;
  newInput?: string;
} | null {
  if (input.startsWith("/")) {
    const [command, ...args] = input.slice(1).split(" ");
    switch (command) {
      case "help":
        const helpMessage = [
          "Available commands:",
          "/help - Show this help message",
          "/exit - Exit the chat",
          "/login - Authenticate with your account",
          "/logout - Sign out of your current session",
          "/whoami - Check who you're currently logged in as",
          "/models - List available AI models",
          ...(assistant.prompts?.map(
            (prompt) => `/${prompt?.name} - ${prompt?.description}`
          ) ?? []),
        ].join("\n");
        return { output: helpMessage };
      case "models":
        return {
          output: `Available models:\n• ${
            assistant.models?.map((model) => model?.name)?.join("\n• ") ||
            "None"
          }`,
        };
      case "exit":
        return { exit: true, output: "Goodbye!" };
      case "login":
        login()
          .then((config) => {
            console.info(
              chalk.green(`\nLogged in as ${config.userEmail || config.userId}`)
            );
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
          return {
            exit: false,
            output: `Logged in as ${config.userEmail || config.userId}`,
          };
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
