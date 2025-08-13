import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";

import {
  isAuthenticated,
  isAuthenticatedConfig,
  loadAuthConfig,
} from "./auth/workos.js";
import { getAllSlashCommands } from "./commands/commands.js";
import { reloadService, SERVICE_NAMES, services } from "./services/index.js";
import { posthogService } from "./telemetry/posthogService.js";
import { SlashCommandResult } from "./ui/hooks/useChat.types.js";

// Helper function to handle org list command
async function handleOrgList(services: any): Promise<SlashCommandResult> {
  try {
    const orgs = await services.auth.getAvailableOrganizations();
    if (!orgs || orgs.length === 0) {
      return {
        exit: false,
        output: "No organizations available or using environment auth",
      };
    }

    const orgList = orgs
      .map((org: any) => `  ${org.id}: ${org.name}`)
      .join("\n");
    return {
      exit: false,
      output: `Available organizations:\n${orgList}`,
    };
  } catch (error: any) {
    return {
      exit: false,
      output: `Failed to list organizations: ${error.message}`,
    };
  }
}

// Helper function to handle org switch command
async function handleOrgSwitch(
  orgId: string,
  services: any,
  reloadService: any,
  SERVICE_NAMES: any,
): Promise<SlashCommandResult> {
  try {
    await services.auth.switchOrganization(orgId);

    // Automatically cascade reload from auth service - this will reload
    // API_CLIENT -> CONFIG -> MODEL/MCP in the correct dependency order
    await reloadService(SERVICE_NAMES.AUTH);

    return {
      exit: false,
      output: `Switched to organization: ${orgId}. All services updated automatically.`,
    };
  } catch (error: any) {
    return {
      exit: false,
      output: `Failed to switch organization: ${error.message}`,
    };
  }
}

type CommandHandler = (
  args: string[],
  assistant: AssistantConfig,
) => Promise<SlashCommandResult> | SlashCommandResult;

async function handleHelp(args: string[], assistant: AssistantConfig) {
  const allCommands = getAllSlashCommands(assistant);
  const helpMessage = [
    chalk.cyan("Slash commands:"),
    ...allCommands.map(
      (cmd) =>
        `- ${chalk.white(`/${cmd.name}:`)} ${chalk.gray(cmd.description)}`,
    ),
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

async function handleOrg(args: string[]) {
  posthogService.capture("useSlashCommand", { name: "org" });

  if (args.length === 0) {
    return {
      exit: false,
      output: "Usage: /org <organization-id> or /org list",
    };
  }

  const subCommand = args[0];
  if (subCommand === "list") {
    return await handleOrgList(services);
  } else {
    return await handleOrgSwitch(
      subCommand,
      services,
      reloadService,
      SERVICE_NAMES,
    );
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
  model: () => ({ openModelSelector: true }),
  compact: () => {
    posthogService.capture("useSlashCommand", { name: "compact" });
    return { compact: true };
  },
  mcp: () => {
    posthogService.capture("useSlashCommand", { name: "mcp" });
    return { openMcpSelector: true };
  },
  org: handleOrg,
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

  return { output: `Unknown command: ${command}` };
}
