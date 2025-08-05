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

export async function handleSlashCommands(
  input: string,
  assistant: AssistantConfig
): Promise<{
  output?: string;
  exit?: boolean;
  newInput?: string;
  clear?: boolean;
  openConfigSelector?: boolean;
  openModelSelector?: boolean;
  compact?: boolean;
} | null> {
  // Only trigger slash commands if slash is the very first character
  if (input.startsWith("/") && input.trim().startsWith("/")) {
    const [command, ...args] = input.slice(1).split(" ");
    switch (command) {
      case "help":
        const allCommands = getAllSlashCommands(assistant);
        const helpMessage = [
          chalk.cyan("Slash commands:"),
          ...allCommands.map((cmd) => `- ${chalk.white(`/${cmd.name}:`)} ${chalk.gray(cmd.description)}`),
        ].join("\n");
        posthogService.capture("useSlashCommand", {
          name: "help",
        });
        return { output: helpMessage };
      case "clear":
        posthogService.capture("useSlashCommand", {
          name: "clear",
        });
        return { clear: true, output: "Chat history cleared" };
      case "exit":
        posthogService.capture("useSlashCommand", {
          name: "exit",
        });
        return { exit: true, output: "Goodbye!" };
      case "config":
        posthogService.capture("useSlashCommand", {
          name: "config",
        });
        return { openConfigSelector: true };
      case "login":
        posthogService.capture("useSlashCommand", {
          name: "login",
        });
        try {
          const newAuthState = await services.auth.login();

          // Automatically cascade reload from auth service - this will reload
          // API_CLIENT -> CONFIG -> MODEL/MCP in the correct dependency order
          await reloadService(SERVICE_NAMES.AUTH);

          const userInfo =
            newAuthState.authConfig &&
            isAuthenticatedConfig(newAuthState.authConfig)
              ? newAuthState.authConfig.userEmail ||
                newAuthState.authConfig.userId
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

      case "logout":
        posthogService.capture("useSlashCommand", {
          name: "logout",
        });
        try {
          await services.auth.logout();

          // Logout should exit the application since many services will be invalid
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

      case "whoami":
        posthogService.capture("useSlashCommand", {
          name: "whoami",
        });
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

      case "model":
        // Open model selector UI
        return { openModelSelector: true };

      case "compact":
        posthogService.capture("useSlashCommand", {
          name: "compact",
        });
        return { compact: true };

      case "org":
        posthogService.capture("useSlashCommand", {
          name: "org",
        });
        // Organization switching command
        if (args.length === 0) {
          return {
            exit: false,
            output: "Usage: /org <organization-id> or /org list",
          };
        }

        const subCommand = args[0];
        if (subCommand === "list") {
          try {
            const orgs = await services.auth.getAvailableOrganizations();
            if (!orgs || orgs.length === 0) {
              return {
                exit: false,
                output: "No organizations available or using environment auth",
              };
            }

            const orgList = orgs
              .map((org) => `  ${org.id}: ${org.name}`)
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
        } else {
          // Switch to specific organization
          const orgId = subCommand;
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
