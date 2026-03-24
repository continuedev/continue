import { type AssistantConfig } from "@continuedev/sdk";

// Export command functions
export { chat } from "./chat.js";
export { listSessionsCommand } from "./ls.js";
export { review } from "./review.js";
export { serve } from "./serve.js";

export interface SlashCommand {
  name: string;
  description: string;
  category: "system" | "assistant";
}

export interface SystemCommand extends SlashCommand {
  category: "system";
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
    name: "update",
    description: "Update the Continue CLI",
    category: "system",
  },
  {
    name: "info",
    description: "Show session information",
    category: "system",
  },
  {
    name: "model",
    description: "Switch between available chat models",
    category: "system",
  },
  {
    name: "config",
    description: "Switch configuration",
    category: "system",
  },
  {
    name: "mcp",
    description: "Manage MCP server connections",
    category: "system",
  },
  {
    name: "init",
    description: "Create an AGENTS.md file",
    category: "system",
  },
  {
    name: "compact",
    description: "Summarize chat history into a compact form",
    category: "system",
  },
  {
    name: "resume",
    description: "Resume a previous chat session",
    category: "system",
  },
  {
    name: "fork",
    description: "Start a forked chat session from the current history",
    category: "system",
  },
  {
    name: "title",
    description: "Set the title for the current session",
    category: "system",
  },
  {
    name: "rename",
    description: "Rename the current session",
    category: "system",
  },
  {
    name: "exit",
    description: "Exit the chat",
    category: "system",
  },
  {
    name: "jobs",
    description: "List background jobs",
    category: "system",
  },
];

/**
 * Get all available slash commands including system commands and assistant prompts
 */
export function getAllSlashCommands(
  assistant: AssistantConfig,
): SlashCommand[] {
  // All system commands are available
  const systemCommands = SYSTEM_SLASH_COMMANDS;

  // Get assistant prompt commands
  const assistantCommands: SlashCommand[] =
    assistant?.prompts?.map((prompt) => ({
      name: prompt?.name || "",
      description: prompt?.description || "",
      category: "assistant" as const,
    })) || [];

  // Get invokable rule commands
  const invokableRuleCommands = getInvokableRuleSlashCommands(assistant);

  return [...systemCommands, ...assistantCommands, ...invokableRuleCommands];
}

/**
 * Get assistant prompt commands only
 */
export function getAssistantSlashCommands(
  assistant: AssistantConfig,
): SlashCommand[] {
  return (
    assistant?.prompts?.map((prompt) => ({
      name: prompt?.name || "",
      description: prompt?.description || "",
      category: "assistant" as const,
    })) || []
  );
}

/**
 * Get invokable rule commands from assistant config
 */
export function getInvokableRuleSlashCommands(
  assistant: AssistantConfig,
): SlashCommand[] {
  if (!assistant?.rules) {
    return [];
  }

  return assistant.rules
    .filter((rule) => {
      // Handle both string rules and rule objects
      if (!rule || typeof rule === "string") {
        return false;
      }
      // Only include rules with invokable: true
      return rule.invokable === true;
    })
    .map((rule) => {
      // TypeScript now knows rule is an object with invokable: true
      const ruleObj = rule as any;
      return {
        name: ruleObj.name || "",
        description: ruleObj.description || "",
        category: "assistant" as const,
      };
    });
}
