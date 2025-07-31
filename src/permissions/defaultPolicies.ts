import { ToolPermissionPolicy } from "./types.js";

/**
 * Default permission policies for all built-in tools.
 * These policies are applied in order - first match wins.
 */
export const DEFAULT_TOOL_POLICIES: ToolPermissionPolicy[] = [
  // Read-only tools are generally safe to allow
  { tool: "read_file", permission: "allow" },
  { tool: "list_files", permission: "allow" },
  { tool: "search_code", permission: "allow" },
  { tool: "fetch", permission: "allow" },

  // Write operations should require confirmation
  { tool: "write_file", permission: "ask" },
  { tool: "edit_file", permission: "ask" },

  // Write to a checklist
  { tool: "write_checklist", permission: "allow" },

  // Terminal commands should require confirmation by default
  { tool: "run_terminal_command", permission: "ask" },

  // Exit tool is generally safe (headless mode only)
  { tool: "exit", permission: "allow" },

  // View diff is read-only
  { tool: "view_diff", permission: "allow" },

  // Default fallback - ask for any unmatched tools
  { tool: "*", permission: "ask" },
];
