import { ToolPermissionPolicy } from "./types.js";

/**
 * Default permission policies for all built-in tools.
 * These policies are applied in order - first match wins.
 */
export const DEFAULT_TOOL_POLICIES: ToolPermissionPolicy[] = [
  // Read-only tools are generally safe to allow
  { tool: "readFile", permission: "allow" },
  { tool: "listFiles", permission: "allow" },
  { tool: "searchCode", permission: "allow" },
  { tool: "fetch", permission: "allow" },

  // Write operations should require confirmation
  { tool: "writeFile", permission: "ask" },

  // Terminal commands should require confirmation by default
  { tool: "runTerminalCommand", permission: "ask" },

  // Exit tool is generally safe (headless mode only)
  { tool: "exit", permission: "allow" },

  // Default fallback - ask for any unmatched tools
  { tool: "*", permission: "ask" },
];
