import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const toolSearchTool: Tool = {
  type: "function",
  displayTitle: "Tool Search",
  wouldLikeTo: "search for a tool",
  isCurrently: "searching for tools",
  hasAlready: "searched for tools",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ToolSearch,
    description: `Search for available tools by keyword, or select one by exact name.

Use this when:
- You know a task requires a specific capability but are unsure of the exact tool name.
- You want to confirm which tools are available for a given domain (e.g. "git", "notebook", "cron").
- You need to pick the right tool from several similar-sounding options.

Query forms:
- "select:read_file,grep_search" — fetch these exact tools by name (comma-separated)
- "notebook jupyter" — keyword search, returns up to max_results best matches
- "+git commit" — require "git" in the name or description, rank by remaining terms

The response lists tool names and one-line descriptions. To see a tool's full parameter
schema, call this tool with "select:<name>".`,
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description:
            'Query to find tools. Use "select:<name1>,<name2>" for direct lookup, or keywords to search. Prefix a term with "+" to require it.',
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default: 5).",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
