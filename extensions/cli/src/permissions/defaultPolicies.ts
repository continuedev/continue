import { ToolPermissionPolicy } from "./types.js";

/**
 * Default permission policies for all built-in tools.
 * These policies are applied in order - first match wins.
 */
export function getDefaultToolPolicies(
  isHeadless = false,
): ToolPermissionPolicy[] {
  const policies: ToolPermissionPolicy[] = [
    // Write tools
    { tool: "Edit", permission: "ask" },
    { tool: "MultiEdit", permission: "ask" },
    { tool: "Write", permission: "ask" },
    { tool: "CheckBackgroundJob", permission: "allow" },
    { tool: "AskQuestion", permission: "allow" },
    { tool: "Checklist", permission: "allow" },
    { tool: "Diff", permission: "allow" },
    { tool: "Skills", permission: "allow" },
    { tool: "Exit", permission: "allow" }, // Exit tool is generally safe (headless mode only)
    { tool: "Fetch", permission: "allow" }, // Technically not read only but edge casey to post w query params
    { tool: "List", permission: "allow" },
    { tool: "Read", permission: "allow" },
    { tool: "Search", permission: "allow" },
    { tool: "Status", permission: "allow" },
    { tool: "ReportFailure", permission: "allow" },
    { tool: "UploadArtifact", permission: "allow" },
  ];

  // MCP and Bash are ask in TUI mode, auto in headless
  if (isHeadless) {
    policies.push({ tool: "Bash", permission: "allow" });
    policies.push({ tool: "*", permission: "allow" });
  } else {
    policies.push({ tool: "Bash", permission: "ask" });
    policies.push({ tool: "*", permission: "ask" });
  }

  return policies;
}

// Plan mode: Complete override - exclude all write operations, allow only reads and bash
export const PLAN_MODE_POLICIES: ToolPermissionPolicy[] = [
  { tool: "Edit", permission: "exclude" },
  { tool: "MultiEdit", permission: "exclude" },
  { tool: "Write", permission: "exclude" },

  // TODO address bash read only concerns, maybe make permissions more granular
  { tool: "Bash", permission: "allow" },
  { tool: "CheckBackgroundJob", permission: "allow" },
  { tool: "AskQuestion", permission: "allow" },
  { tool: "Checklist", permission: "allow" },
  { tool: "Diff", permission: "allow" },
  { tool: "Exit", permission: "allow" },
  { tool: "Fetch", permission: "allow" },
  { tool: "List", permission: "allow" },
  { tool: "Read", permission: "allow" },
  { tool: "ReportFailure", permission: "allow" },
  { tool: "Search", permission: "allow" },
  { tool: "Skills", permission: "allow" },
  { tool: "Status", permission: "allow" },
  { tool: "UploadArtifact", permission: "allow" },

  // Allow MCP tools
  { tool: "*", permission: "allow" },
];

// Auto mode: Complete override - allow everything without asking
export const AUTO_MODE_POLICIES: ToolPermissionPolicy[] = [
  { tool: "*", permission: "allow" },
];

/**
 * Coordinator mode: The agent acts as an orchestrator that spawns and delegates
 * to worker agents. It can read/inspect code, run analysis tools, and invoke
 * the Subagent tool — but is blocked from directly writing files or running
 * destructive shell commands (those are delegated to workers).
 */
export const COORDINATOR_MODE_POLICIES: ToolPermissionPolicy[] = [
  // Coordination tools
  { tool: "Subagent", permission: "allow" },
  { tool: "AskQuestion", permission: "allow" },
  { tool: "Checklist", permission: "allow" },
  { tool: "Status", permission: "allow" },
  { tool: "ReportFailure", permission: "allow" },
  { tool: "Exit", permission: "allow" },
  { tool: "Skills", permission: "allow" },

  // Read-only tools (coordinator can inspect but not write)
  { tool: "Read", permission: "allow" },
  { tool: "List", permission: "allow" },
  { tool: "Search", permission: "allow" },
  { tool: "Diff", permission: "allow" },
  { tool: "Fetch", permission: "allow" },

  // Bash is restricted to read-only operations in coordinator mode
  { tool: "Bash", permission: "ask" },

  // Write tools are excluded — workers handle mutations
  { tool: "Edit", permission: "exclude" },
  { tool: "MultiEdit", permission: "exclude" },
  { tool: "Write", permission: "exclude" },

  // MCP tools allowed (coordinator may need to query external services)
  { tool: "*", permission: "allow" },
];
