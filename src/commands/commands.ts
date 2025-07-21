import { type AssistantConfig } from "@continuedev/sdk";

export interface SlashCommand {
  name: string;
  description: string;
  category: "system" | "assistant";
}

export interface SystemCommand extends SlashCommand {
  category: "system";
  requiresMultipleOrgs?: boolean;
}

// Central definition of all system slash commands
export const SYSTEM_SLASH_COMMANDS: SystemCommand[] = [
  {
    name: "help",
    description: "Show help message",
    category: "system",
  },
  {
    name: "clear",
    description: "Clear the chat history",
    category: "system",
  },
  {
    name: "exit",
    description: "Exit the chat",
    category: "system",
  },
  {
    name: "login",
    description: "Authenticate with your account",
    category: "system",
  },
  {
    name: "logout",
    description: "Sign out of your current session",
    category: "system",
  },
  {
    name: "whoami",
    description: "Check who you're currently logged in as",
    category: "system",
  },
  {
    name: "org",
    description: "Switch organization",
    category: "system",
    requiresMultipleOrgs: true,
  },
  {
    name: "config",
    description: "Switch configuration",
    category: "system",
  },
];

// Remote mode specific commands
export const REMOTE_MODE_SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "exit",
    description: "Exit the remote environment",
    category: "system",
  },
];

/**
 * Get all available slash commands including system commands and assistant prompts
 */
export function getAllSlashCommands(
  assistant: AssistantConfig,
  options: { isRemoteMode?: boolean; hasMultipleOrgs?: boolean } = {}
): SlashCommand[] {
  const { isRemoteMode = false, hasMultipleOrgs = false } = options;

  // In remote mode, only show the exit command
  if (isRemoteMode) {
    return REMOTE_MODE_SLASH_COMMANDS;
  }

  // Filter system commands based on requirements
  const systemCommands = SYSTEM_SLASH_COMMANDS.filter((cmd) => {
    if (cmd.requiresMultipleOrgs && !hasMultipleOrgs) {
      return false;
    }
    return true;
  });

  // Get assistant prompt commands
  const assistantCommands: SlashCommand[] =
    assistant?.prompts?.map((prompt) => ({
      name: prompt?.name || "",
      description: prompt?.description || "",
      category: "assistant" as const,
    })) || [];

  return [...systemCommands, ...assistantCommands];
}

/**
 * Get assistant prompt commands only
 */
export function getAssistantSlashCommands(
  assistant: AssistantConfig
): SlashCommand[] {
  return (
    assistant?.prompts?.map((prompt) => ({
      name: prompt?.name || "",
      description: prompt?.description || "",
      category: "assistant" as const,
    })) || []
  );
}