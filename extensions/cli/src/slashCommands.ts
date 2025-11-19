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
import { getCurrentSession, updateSessionTitle } from "./session.js";
import { posthogService } from "./telemetry/posthogService.js";
import { telemetryService } from "./telemetry/telemetryService.js";
import { SlashCommandResult } from "./ui/hooks/useChat.types.js";

type CommandHandler = (
  args: string[],
  assistant: AssistantConfig,
  remoteUrl?: string,
  options?: { isRemoteMode?: boolean },
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
  return { output: helpMessage };
}

async function handleLogin() {
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

async function handleWhoami() {
  const authed = await isAuthenticated();
  if (authed) {
    const config = loadAuthConfig(); // TODO duplicate auth config loading
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

function handleTitle(args: string[]) {
  posthogService.capture("useSlashCommand", { name: "title" });

  const title = args.join(" ").trim();
  if (!title) {
    return {
      exit: false,
      output: chalk.yellow(
        "Please provide a title. Usage: /title <your title>",
      ),
    };
  }

  try {
    updateSessionTitle(title);
    return {
      exit: false,
      output: chalk.green(`Session title updated to: "${title}"`),
    };
  } catch (error: any) {
    return {
      exit: false,
      output: chalk.red(`Failed to update title: ${error.message}`),
    };
  }
}

const commandHandlers: Record<string, CommandHandler> = {
  help: handleHelp,
  clear: () => {
    return { clear: true, output: "Chat history cleared" };
  },
  exit: () => {
    return { exit: true, output: "Goodbye!" };
  },
  config: () => {
    return { openConfigSelector: true };
  },
  login: handleLogin,
  logout: handleLogout,
  whoami: handleWhoami,
  info: handleInfoSlashCommand,
  model: () => ({ openModelSelector: true }),
  compact: () => {
    return { compact: true };
  },
  mcp: () => {
    return { openMcpSelector: true };
  },
  resume: () => {
    return { openSessionSelector: true };
  },
  fork: handleFork,
  title: handleTitle,
  init: (args, assistant) => {
    posthogService.capture("useSlashCommand", { name: "init" });
    return handleInit(args, assistant);
  },
  update: () => {
    return { openUpdateSelector: true };
  },
};

export async function handleSlashCommands(
  input: string,
  assistant: AssistantConfig,
  options?: { remoteUrl?: string; isRemoteMode?: boolean },
): Promise<SlashCommandResult | null> {
  // Only trigger slash commands if slash is the very first character
  if (!input.startsWith("/") || !input.trim().startsWith("/")) {
    return null;
  }

  const [command, ...args] = input.slice(1).split(" ");

  telemetryService.recordSlashCommand(command);
  posthogService.capture("useSlashCommand", { name: command });

  const handler = commandHandlers[command];
  if (handler) {
    return await handler(args, assistant, options?.remoteUrl, options);
  }

  // Check for custom assistant prompts
  const assistantPrompt = assistant.prompts?.find(
    (prompt) => prompt?.name === command,
  );
  if (assistantPrompt) {
    const newInput = assistantPrompt.prompt + args.join(" ");
    return { newInput };
  }

  // Check for invokable rules
  const invokableRule = assistant.rules?.find((rule) => {
    // Handle both string rules and rule objects
    if (!rule || typeof rule === "string") {
      return false;
    }
    const ruleObj = rule as any;
    return ruleObj.invokable === true && ruleObj.name === command;
  });
  if (invokableRule) {
    const ruleObj = invokableRule as any;
    const newInput = ruleObj.rule + " " + args.join(" ");
    return { newInput };
  }

  // Check if this command would match any available commands (same logic as UI)
  const allCommands = getAllSlashCommands(assistant, {
    isRemoteMode: options?.isRemoteMode,
  });
  const hasMatches = allCommands.some((cmd) =>
    cmd.name.toLowerCase().includes(command.toLowerCase()),
  );

  // If no commands match, treat this as regular text instead of an unknown command
  if (!hasMatches) {
    return null;
  }

  return { output: `Unknown command: ${command}` };
}
