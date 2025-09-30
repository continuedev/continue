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
      "Perform a search over the repository using ripgrep. Will not include results for many build, cache, secrets dirs/files. Output may be truncated, so use targeted queries",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description:
            "The search query to use. Must be a valid ripgrep regex expression, escaped where needed",
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
