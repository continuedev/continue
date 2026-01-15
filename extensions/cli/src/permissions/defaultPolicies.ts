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

    { tool: "Checklist", permission: "allow" },
    { tool: "Diff", permission: "allow" },
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

  { tool: "Checklist", permission: "allow" },
  { tool: "Diff", permission: "allow" },
  { tool: "Exit", permission: "allow" },
  { tool: "Fetch", permission: "allow" },
  { tool: "List", permission: "allow" },
  { tool: "Read", permission: "allow" },
  { tool: "ReportFailure", permission: "allow" },
  { tool: "Search", permission: "allow" },
  { tool: "Status", permission: "allow" },
  { tool: "UploadArtifact", permission: "allow" },

  // Allow MCP tools
  { tool: "*", permission: "allow" },
];

// Auto mode: Complete override - allow everything without asking
export const AUTO_MODE_POLICIES: ToolPermissionPolicy[] = [
  { tool: "*", permission: "allow" },
];
