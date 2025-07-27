import path from "path";
import { getToolDisplayName } from "./index.js";

/**
 * Formats a tool call with its arguments for display
 * @param toolName The name of the tool
 * @param args The tool arguments
 * @returns A formatted string like "ToolName(arg)" or just "ToolName" if no args
 */
export function formatToolCall(toolName: string, args?: any): string {
  const displayName = getToolDisplayName(toolName);
  
  if (!args || Object.keys(args).length === 0) {
    return displayName;
  }

  // Get the first argument value
  const firstValue = Object.values(args)[0];
  const formattedValue = formatToolArgument(firstValue);
  
  return `${displayName}(${formattedValue})`;
}

/**
 * Formats a single tool argument for display
 * @param value The argument value
 * @returns A formatted string representation of the value
 */
export function formatToolArgument(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Convert absolute paths to relative paths
  if (typeof value === "string" && path.isAbsolute(value)) {
    const workspaceRoot = process.cwd();
    const relativePath = path.relative(workspaceRoot, value);
    return relativePath || value;
  }

  // Return other values as strings
  return String(value);
}