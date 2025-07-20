import { type AssistantConfig } from "@continuedev/sdk";
import { hasMultipleOrganizations } from "../auth/workos.js";

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

/**
 * Get all available slash commands including system commands and assistant prompts
 */
export async function getAllSlashCommands(assistant: AssistantConfig): Promise<SlashCommand[]> {
  const hasMultipleOrgs = await hasMultipleOrganizations();
  
  // Filter system commands based on requirements
  const systemCommands = SYSTEM_SLASH_COMMANDS.filter(command => 
    !command.requiresMultipleOrgs || hasMultipleOrgs
  );

  // Get assistant prompt commands
  const assistantCommands: SlashCommand[] = assistant.prompts?.map((prompt) => ({
    name: prompt?.name || "",
    description: prompt?.description || "",
    category: "assistant" as const,
  })) || [];

  return [...systemCommands, ...assistantCommands];
}

/**
 * Get system slash commands only
 */
export async function getSystemSlashCommands(): Promise<SystemCommand[]> {
  const hasMultipleOrgs = await hasMultipleOrganizations();
  
  return SYSTEM_SLASH_COMMANDS.filter(command => 
    !command.requiresMultipleOrgs || hasMultipleOrgs
  );
}

/**
 * Get assistant prompt commands only
 */
export function getAssistantSlashCommands(assistant: AssistantConfig): SlashCommand[] {
  return assistant.prompts?.map((prompt) => ({
    name: prompt?.name || "",
    description: prompt?.description || "",
    category: "assistant" as const,
  })) || [];
}