import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";

import {
  isAuthenticated,
  isAuthenticatedConfig,
  loadAuthConfig,
} from "./auth/workos.js";
import { getAllSlashCommands } from "./commands/commands.js";
import { handleInit } from "./commands/init.js";
import { handleInfoSlashCommand } from "./infoScreen.js";
import { reloadService, SERVICE_NAMES, services } from "./services/index.js";
import { getCurrentSession } from "./session.js";
import { posthogService } from "./telemetry/posthogService.js";
import { telemetryService } from "./telemetry/telemetryService.js";
import { SlashCommandResult } from "./ui/hooks/useChat.types.js";

type CommandHandler = (
  args: string[],
  assistant: AssistantConfig,
) => Promise<SlashCommandResult> | SlashCommandResult;

async function handleHelp(_args: string[], _assistant: AssistantConfig) {
  const helpMessage = [
    chalk.bold("Keyboard Shortcuts:"),
    "",
    chalk.white("Navigation:"),
    `  ${chalk.cyan("↑/↓")}        Navigate command/file suggestions or history`,
    `  ${chalk.cyan("Tab")}        Complete command or file selection`,
    `  ${chalk.cyan("Enter")}      Submit message`,
    `  ${chalk.cyan("Shift+Enter")} New line`,
    `  ${chalk.cyan("\\")}          Line continuation (at end of line)`,
    `  ${chalk.cyan("!")}          Shell mode - run shell commands`,
    "",
    chalk.white("Controls:"),
    `  ${chalk.cyan("Ctrl+C")}     Clear input`,
    `  ${chalk.cyan("Ctrl+D")}     Exit application`,
    `  ${chalk.cyan("Ctrl+L")}     Clear screen`,
    `  ${chalk.cyan("Shift+Tab")}  Cycle permission modes (normal/plan/auto)`,
    `  ${chalk.cyan("Esc")}        Cancel streaming or close suggestions`,
    "",
    chalk.white("Special Characters:"),
    `  ${chalk.cyan("@")}          Search and attach files for context`,
    `  ${chalk.cyan("/")}          Access slash commands`,
    `  ${chalk.cyan("!")}          Execute bash commands directly`,
    "",
    chalk.white("Available Commands:"),
    `  Type ${chalk.cyan("/")} to see available slash commands`,
    `  Type ${chalk.cyan("!")} followed by a command to execute bash directly`,
  ].join("\n");
  posthogService.capture("useSlashCommand", { name: "help" });
  return { output: helpMessage };
}

async function handleLogin() {
  posthogService.capture("useSlashCommand", { name: "login" });
  try {
    const newAuthState = await services.auth.login();
    await reloadService(SERVICE_NAMES.AUTH);

    const userInfo =
      newAuthState.authConfig && isAuthenticatedConfig(newAuthState.authConfig)
        ? newAuthState.authConfig.userEmail || newAuthState.authConfig.userId
        : "user";

    console.info(chalk.green(`\nLogged in as ${userInfo}`));

    return {
      exit: false,
      output: "Login successful! All services updated automatically.",
    };
  } catch (error: any) {
    console.error(chalk.red(`\nLogin failed: ${error.message}`));
    return {
      exit: false,
      output: `Login failed: ${error.message}`,
    };
  }
}

async function handleLogout() {
  posthogService.capture("useSlashCommand", { name: "logout" });
  try {
    await services.auth.logout();
    return {
      exit: true,
      output: "Logged out successfully",
    };
  } catch {
    return {
      exit: true,
      output: "Logged out successfully",
    };
  }
}

function handleWhoami() {
  posthogService.capture("useSlashCommand", { name: "whoami" });
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
}

async function handleFork() {
  posthogService.capture("useSlashCommand", { name: "fork" });

  try {
    const currentSession = getCurrentSession();
    const forkCommand = `cn --fork ${currentSession.sessionId}`;
    // Try to copy to clipboard dynamically to avoid hard dependency in tests
    try {
      const clipboardy = await import("clipboardy");
      await clipboardy.default.write(forkCommand);
      return {
        exit: false,
        output: chalk.gray(`${forkCommand} (copied to clipboard)`),
      };
    } catch {
      return {
        exit: false,
        output: chalk.gray(`${forkCommand}`),
      };
    }
  } catch (error: any) {
    return {
      exit: false,
      output: chalk.red(`Failed to create fork command: ${error.message}`),
    };
  }
}

const commandHandlers: Record<string, CommandHandler> = {
  help: handleHelp,
  clear: () => {
    posthogService.capture("useSlashCommand", { name: "clear" });
    return { clear: true, output: "Chat history cleared" };
  },
  exit: () => {
    posthogService.capture("useSlashCommand", { name: "exit" });
    return { exit: true, output: "Goodbye!" };
  },
  config: () => {
    posthogService.capture("useSlashCommand", { name: "config" });
    return { openConfigSelector: true };
  },
  login: handleLogin,
  logout: handleLogout,
  whoami: handleWhoami,
  info: handleInfoSlashCommand,
  model: () => ({ openModelSelector: true }),
  compact: () => {
    posthogService.capture("useSlashCommand", { name: "compact" });
    return { compact: true };
  },
  mcp: () => {
    posthogService.capture("useSlashCommand", { name: "mcp" });
    return { openMcpSelector: true };
  },
  resume: () => {
    posthogService.capture("useSlashCommand", { name: "resume" });
    return { openSessionSelector: true };
  },
  fork: handleFork,
  init: (args, assistant) => {
    posthogService.capture("useSlashCommand", { name: "init" });
    return handleInit(args, assistant);
  },
};

export async function handleSlashCommands(
  input: string,
  assistant: AssistantConfig,
): Promise<{
  output?: string;
  exit?: boolean;
  newInput?: string;
  clear?: boolean;
  openConfigSelector?: boolean;
  openModelSelector?: boolean;
  openMCPSelector?: boolean;
  openSessionSelector?: boolean;
  compact?: boolean;
} | null> {
  // Only trigger slash commands if slash is the very first character
  if (!input.startsWith("/") || !input.trim().startsWith("/")) {
    return null;
  }

  const [command, ...args] = input.slice(1).split(" ");

  telemetryService.recordSlashCommand(command);
  posthogService.capture("useSlashCommand", { name: command });

  const handler = commandHandlers[command];
  if (handler) {
    return await handler(args, assistant);
  }

  // Check for custom assistant prompts
  const assistantPrompt = assistant.prompts?.find(
    (prompt) => prompt?.name === command,
  );
  if (assistantPrompt) {
    const newInput = assistantPrompt.prompt + args.join(" ");
    return { newInput };
  }

  // Check if this command would match any available commands (same logic as UI)
  const allCommands = getAllSlashCommands(assistant);
  const hasMatches = allCommands.some((cmd) =>
    cmd.name.toLowerCase().includes(command.toLowerCase()),
  );

  // If no commands match, treat this as regular text instead of an unknown command
  if (!hasMatches) {
    return null;
  }

  return { output: `Unknown command: ${command}` };
}
