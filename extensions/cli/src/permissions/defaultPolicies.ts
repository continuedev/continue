import { ToolPermissionPolicy } from "./types.js";

/**
 * Default permission policies for all built-in tools.
 * These policies are applied in order - first match wins.
 */
export const DEFAULT_TOOL_POLICIES: ToolPermissionPolicy[] = [
  // Read-only tools are generally safe to allow
  { tool: "Read", permission: "allow" },
  { tool: "List", permission: "allow" },
  { tool: "Search", permission: "allow" },
  { tool: "Fetch", permission: "allow" },

  // Write operations should require confirmation
  { tool: "Write", permission: "ask" },
  { tool: "Edit", permission: "ask" },
  { tool: "MultiEdit", permission: "ask" },

  // Write to a checklist
  { tool: "Checklist", permission: "allow" },

  // Terminal commands should require confirmation by default
  { tool: "Bash", permission: "ask" },

  // Exit tool is generally safe (headless mode only)
  { tool: "Exit", permission: "allow" },

  // View diff is read-only
  { tool: "Diff", permission: "allow" },

  // Default fallback - ask for any unmatched tools
  { tool: "*", permission: "ask" },
];
