import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";

import {
  isAuthenticated,
  isAuthenticatedConfig,
  loadAuthConfig,
} from "./auth/workos.js";
import { getAllSlashCommands } from "./commands/commands.js";
import { reloadService, SERVICE_NAMES, services } from "./services/index.js";
import { getSessionFilePath } from "./session.js";
import { posthogService } from "./telemetry/posthogService.js";
import { SlashCommandResult } from "./ui/hooks/useChat.types.js";
import { getVersion } from "./version.js";

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
    "",
    chalk.white("Available Commands:"),
    `  Type ${chalk.cyan("/")} to see available slash commands`,
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

async function handleInfo() {
  posthogService.capture("useSlashCommand", { name: "info" });

  const infoLines = [];

  // Version and working directory info
  const version = getVersion();
  const cwd = process.cwd();

  infoLines.push(chalk.white("CLI Information:"));
  infoLines.push(`  Version: ${chalk.green(version)}`);
  infoLines.push(`  Working Directory: ${chalk.blue(cwd)}`);

  // Auth info
  if (isAuthenticated()) {
    const config = loadAuthConfig();
    if (config && isAuthenticatedConfig(config)) {
      const email = config.userEmail || config.userId;
      const org = "(no org)"; // Organization info not available in AuthenticatedConfig
      infoLines.push("");
      infoLines.push(chalk.white("Authentication:"));
      infoLines.push(`  Email: ${chalk.green(email)}`);
      infoLines.push(`  Organization: ${chalk.cyan(org)}`);
    } else {
      infoLines.push("");
      infoLines.push(chalk.white("Authentication:"));
      infoLines.push(
        `  ${chalk.yellow("Authenticated via environment variable")}`,
      );
    }
  } else {
    infoLines.push("");
    infoLines.push(chalk.white("Authentication:"));
    infoLines.push(`  ${chalk.red("Not logged in")}`);
  }

  // Config info
  try {
    const configState = services.config.getState();
    infoLines.push("");
    infoLines.push(chalk.white("Configuration:"));
    if (configState.config) {
      infoLines.push(`  ${chalk.gray(`Using ${configState.config?.name}`)}`);
    } else {
      infoLines.push(`  ${chalk.red(`Config not found`)}`);
    }
    if (configState.configPath) {
      infoLines.push(`  Path: ${chalk.blue(configState.configPath)}`);
    }

    // Add current model info
    try {
      const modelInfo = services.model?.getModelInfo();
      if (modelInfo) {
        infoLines.push(`  Model: ${chalk.cyan(modelInfo.name)}`);
      } else {
        infoLines.push(`  Model: ${chalk.red("Not available")}`);
      }
    } catch {
      infoLines.push(`  Model: ${chalk.red("Error retrieving model info")}`);
    }
  } catch {
    infoLines.push("");
    infoLines.push(chalk.white("Configuration:"));
    infoLines.push(`  ${chalk.red("Configuration service not available")}`);
  }

  // Session history path
  infoLines.push("");
  infoLines.push(chalk.white("Session History:"));
  const sessionFilePath = getSessionFilePath();

  infoLines.push(`  File: ${chalk.blue(sessionFilePath)}`);

  return {
    exit: false,
    output: infoLines.join("\n"),
  };
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
  info: handleInfo,
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
