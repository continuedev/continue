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
    { tool: "TaskList", permission: "allow" },
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

// Plan mode: complete override. Reads are allowed; nothing that can change the
// workspace runs without asking. Write tools are excluded. Bash and MCP tools
// can write too, so they ask (and headless runs, with nobody to ask, are not
// offered them; see getRequestTools). PresentPlan writes only its own plan file
// under .continue/plans and is offered in plan mode only.
export const PLAN_MODE_POLICIES: ToolPermissionPolicy[] = [
  { tool: "Edit", permission: "exclude" },
  { tool: "MultiEdit", permission: "exclude" },
  { tool: "Write", permission: "exclude" },

  { tool: "Bash", permission: "ask" },
  { tool: "PresentPlan", permission: "allow" },
  { tool: "CheckBackgroundJob", permission: "allow" },
  { tool: "AskQuestion", permission: "allow" },
  { tool: "Checklist", permission: "allow" },
  { tool: "TaskList", permission: "allow" },
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

  // MCP tools and anything else not listed
  { tool: "*", permission: "ask" },
];

// Auto mode: Complete override - allow everything without asking
export const AUTO_MODE_POLICIES: ToolPermissionPolicy[] = [
  { tool: "*", permission: "allow" },
];
