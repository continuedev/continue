/**
 * Maps common variations to standardized tool names
 */
const TOOL_NAME_MAPPINGS: Record<string, string> = {
  // Standard tool names (passthrough)
  Read: "Read",
  Write: "Write",
  List: "List",
  Search: "Search",
  Bash: "Bash",
  Fetch: "Fetch",
  Exit: "Exit",
  Diff: "Diff",
  Edit: "Edit",
  Checklist: "Checklist",

  // Common variations (case insensitive)
  read: "Read",
  write: "Write",
  list: "List",
  search: "Search",
  bash: "Bash",
  terminal: "Bash",
  Terminal: "Bash",
  cmd: "Bash",
  command: "Bash",
  fetch: "Fetch",
  exit: "Exit",
  diff: "Diff",
  edit: "Edit",
  checklist: "Checklist",
};

/**
 * Normalizes a tool name from various formats (variations, legacy names) to the standardized tool name
 */
export function normalizeToolName(input: string): string {
  // First try exact match (case sensitive)
  if (TOOL_NAME_MAPPINGS[input]) {
    return TOOL_NAME_MAPPINGS[input];
  }

  // Try case insensitive match
  const lowerInput = input.toLowerCase();
  for (const [key, value] of Object.entries(TOOL_NAME_MAPPINGS)) {
    if (key.toLowerCase() === lowerInput) {
      return value;
    }
  }

  // If no mapping found, return as-is (might be an MCP tool or future tool)
  return input;
}

/**
 * Gets the display name for a tool name
 * Since we now use display names as the primary names, this mostly returns the input
 * but handles any remaining edge cases
 */
export function getDisplayName(toolName: string): string {
  // Simply normalize and return - the tool name is already the display name
  return normalizeToolName(toolName);
}
