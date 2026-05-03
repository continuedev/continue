import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const grepSearchTool: Tool = {
  type: "function",
  displayTitle: "Grep Search",
  wouldLikeTo: 'search for "{{{ query }}}"',
  isCurrently: 'searching for "{{{ query }}}"',
  hasAlready: 'searched for "{{{ query }}}"',
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.GrepSearch,
    description:
      "Performs a regular expression (regex) search over the repository using ripgrep. Prefer this over shelling out to grep or rg. Supports include globs, case-sensitive search, multiline matching, and configurable context lines. Output may be truncated, so use targeted queries.",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description:
            "The regex pattern to search for within file contents. Use regex with alternation (e.g., 'word1|word2|word3') or character classes to find multiple potential words in a single search.",
        },
        includePattern: {
          type: "string",
          description:
            "Optional glob that restricts which files are searched, for example '*.ts' or 'src/**'.",
        },
        maxResults: {
          type: "number",
          description:
            "Optional maximum number of matches to return. Defaults to 100.",
        },
        caseSensitive: {
          type: "boolean",
          description:
            "Whether the search should be case-sensitive. Defaults to false.",
        },
        contextLines: {
          type: "number",
          description:
            "Number of lines of surrounding context to include around each match. Defaults to 2.",
        },
        multiline: {
          type: "boolean",
          description:
            "Enable multiline matching so patterns can span across newlines. Defaults to false.",
        },
        splitByFile: {
          type: "boolean",
          description:
            "Return one context item per file instead of a single combined result block.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: `To perform a grep search within the project, call the ${BuiltInToolNames.GrepSearch} tool with the query pattern to match. For example:`,
    exampleArgs: [["query", ".*main_services.*"]],
  },
  toolCallIcon: "MagnifyingGlassIcon",
};
