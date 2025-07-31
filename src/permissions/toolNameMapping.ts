/**
 * Maps common display names and variations to actual tool names
 */
const TOOL_NAME_MAPPINGS: Record<string, string> = {
  // Display name mappings
  Read: "read_file",
  Write: "write_file",
  List: "list_files",
  Search: "search_code",
  Bash: "run_terminal_command",
  Terminal: "run_terminal_command",
  Fetch: "fetch",
  Exit: "exit",
  Diff: "view_diff",
  Edit: "edit_file",
  Checklist: "write_checklist",

  // Common variations (case insensitive)
  read: "read_file",
  write: "write_file",
  list: "list_files",
  search: "search_code",
  bash: "run_terminal_command",
  terminal: "run_terminal_command",
  cmd: "run_terminal_command",
  command: "run_terminal_command",
  fetch: "fetch",
  exit: "exit",
  diff: "view_diff",
  edit: "edit_file",
  checklist: "write_checklist",

  // Actual tool names (passthrough)
  read_file: "read_file",
  write_file: "write_file",
  list_files: "list_files",
  search_code: "search_code",
  run_terminal_command: "run_terminal_command",
  view_diff: "view_diff",
  edit_file: "edit_file",
  write_checklist: "write_checklist",
};

/**
 * Normalizes a tool name from various formats (display name, variations) to the actual tool name
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
 * Gets the display name for a normalized tool name
 * Returns the preferred display name (e.g., "read_file" -> "Read")
 */
export function getDisplayName(normalizedName: string): string {
  // Create a reverse mapping from normalized names to display names
  const reverseMapping: Record<string, string> = {
    read_file: "Read",
    write_file: "Write",
    list_files: "List",
    search_code: "Search",
    run_terminal_command: "Bash",
    fetch: "Fetch",
    exit: "Exit",
    view_diff: "Diff",
    write_checklist: "Checklist",
  };

  return reverseMapping[normalizedName] || normalizedName;
}
