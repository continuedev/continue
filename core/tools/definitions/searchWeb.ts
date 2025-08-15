import { Tool } from "../..";

import { BuiltInToolNames, HUB_TOOLS_GROUP_NAME } from "../builtIn";

export const searchWebTool: Tool = {
  type: "function",
  displayTitle: "Search Web",
  wouldLikeTo: 'search the web for "{{{ query }}}"',
  isCurrently: 'searching the web for "{{{ query }}}"',
  hasAlready: 'searched the web for "{{{ query }}}"',
  readonly: true,
  group: HUB_TOOLS_GROUP_NAME,
  function: {
    name: BuiltInToolNames.SearchWeb,
    description:
      "Performs a web search, returning top results. Use this tool sparingly - only for questions that require specialized, external, and/or up-to-date knowledge. Common programming questions do not require web search.",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "The natural language search query",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: `To search the web, use the ${BuiltInToolNames.SearchWeb} tool with a natural language query. For example, to search for the current weather, you would respond with:`,
    exampleArgs: [["query", "What is the current weather in San Francisco?"]],
  },
};
