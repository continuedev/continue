import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { createSystemMessageExampleCall } from "../instructionTools/buildXmlToolsSystemMessage";

export const grepSearchTool: Tool = {
  type: "function",
  displayTitle: "Grep Search",
  wouldLikeTo: 'search for "{{{ query }}}" in the repository',
  isCurrently: 'getting search results for "{{{ query }}}"',
  hasAlready: 'retrieved search results for "{{{ query }}}"',
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.GrepSearch,
    description: "Perform a search over the repository using ripgrep.",
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
  systemMessageDescription: createSystemMessageExampleCall(
    BuiltInToolNames.GrepSearch,
    `To perform a grep search within the project, call the ${BuiltInToolNames.GrepSearch} tool with the query pattern to match. For example:`,
    `<query>.*main_services.*</query>`,
  ),
};
