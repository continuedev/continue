import { getServiceSync } from "../services/index.js";
import { SERVICE_NAMES } from "../services/types.js";
import type { ToolPermissionServiceState } from "../services/types.js";
import { DEFAULT_TOOL_POLICIES } from "./defaultPolicies.js";
import {
  PermissionCheckResult,
  ToolCallRequest,
  ToolPermissions,
} from "./types.js";

/**
 * Checks if a tool name matches a pattern.
 * Supports wildcards (*) for pattern matching.
 * Also handles special Bash command patterns like "Bash(ls*)"
 */
export function matchesToolPattern(
  toolName: string, 
  pattern: string, 
  toolArguments?: Record<string, any>
): boolean {
  if (pattern === "*") return true;
  if (pattern === toolName) return true;

  // Handle special Bash command patterns like "Bash(ls*)"
  const bashCommandMatch = pattern.match(/^Bash\((.+)\)$/);
  if (bashCommandMatch) {
    // Check if this is a bash/terminal tool (either normalized name or display name)
    const isBashTool = toolName === "run_terminal_command" || toolName === "Bash";
    if (isBashTool && toolArguments?.command) {
      const commandPattern = bashCommandMatch[1];
      const command = toolArguments.command;
      
      // Handle command patterns with wildcards
      if (commandPattern.includes("*") || commandPattern.includes("?")) {
        // Escape all regex metacharacters except * and ?
        const escaped = commandPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        // Convert * and ? to their regex equivalents
        const regexPattern = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(command);
      }
      
      // Exact command match
      return command === commandPattern;
    }
    return false;
  }

  // Handle regular wildcard patterns like "mcp__*"
  if (pattern.includes("*") || pattern.includes("?")) {
    // Escape all regex metacharacters except * and ?
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    // Convert * and ? to their regex equivalents
    const regexPattern = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(toolName);
  }

  return false;
}

/**
 * Checks if tool call arguments match the specified patterns.
 */
export function matchesArguments(
  args: Record<string, any>,
  patterns?: Record<string, any>
): boolean {
  if (!patterns) return true;

  for (const [key, pattern] of Object.entries(patterns)) {
    const argValue = args[key];

    if (pattern === "*") continue; // Wildcard matches anything

    // Exact match
    if (argValue !== pattern) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates a tool call request against a set of permission policies.
 * Returns the permission for the first matching policy.
 */
export function checkToolPermission(
  toolCall: ToolCallRequest,
  permissions?: ToolPermissions
): PermissionCheckResult {
  // Get permissions from service if not provided
  let policies = permissions?.policies;
  
  if (!policies) {
    try {
      const serviceResult = getServiceSync<ToolPermissionServiceState>(
        SERVICE_NAMES.TOOL_PERMISSIONS
      );
      policies = serviceResult.value?.permissions.policies || DEFAULT_TOOL_POLICIES;
    } catch {
      // Service not initialized yet, use defaults
      policies = DEFAULT_TOOL_POLICIES;
    }
  }

  for (const policy of policies) {
    if (
      matchesToolPattern(toolCall.name, policy.tool, toolCall.arguments) &&
      matchesArguments(toolCall.arguments, policy.argumentMatches)
    ) {
      return {
        permission: policy.permission,
        matchedPolicy: policy,
      };
    }
  }

  // Fallback to "ask" if no policy matches
  return {
    permission: "ask",
  };
}

/**
 * Filters out tools that have "exclude" permission from a list of tool names.
 */
export function filterExcludedTools(
  toolNames: string[],
  permissions?: ToolPermissions
): string[] {
  return toolNames.filter((toolName) => {
    const result = checkToolPermission(
      { name: toolName, arguments: {} },
      permissions
    );
    return result.permission !== "exclude";
  });
}
